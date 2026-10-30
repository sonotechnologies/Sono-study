import { beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { createPgliteDb, type Db } from "@/db";
import { payments, users } from "@/db/schema";
import { seed } from "@/db/seed";
import { effectivePlan } from "@/lib/billing";
import { addDays } from "@/lib/time";
import { adminConfirm, adminReject, claimTransfer, expireClaims, parseAlert, recordAlert, startTransfer, transferQueue } from "@/lib/transfers";

const NOW = new Date("2026-10-30T10:00:00Z");
const later = (h: number) => new Date(NOW.getTime() + h * 3600_000);
let db: Db;
let n = 0;

beforeAll(async () => {
  db = await createPgliteDb();
  await seed(db, NOW);
});

async function student() {
  const id = `trf-${++n}`;
  await db.insert(users).values({ id, name: `Student ${n}`, email: `${id}@example.com`, schoolId: "sch-unilag", onboardedAt: NOW });
  return id;
}
const proUntil = async (id: string) => (await db.select({ p: users.proUntil }).from(users).where(eq(users.id, id)))[0].p;
const naira = (kobo: number) => (kobo / 100).toFixed(2);

describe("reading forwarded alerts", () => {
  it.each([
    [{ app: "team.opay.pay", title: "Transfer Received", text: "You have received ₦503.00 from JOHN ADEBAYO DOE." }, { source: "opay", isCredit: true, amountKobo: 50300, senderName: "JOHN ADEBAYO DOE" }],
    [{ app: "com.transsnet.palmpay", title: "Money In", text: "NGN 2,017.00 received from Ada Obi via bank transfer. Remark: SONO K3F7Q2" }, { source: "palmpay", isCredit: true, amountKobo: 201700, code: "SONO-K3F7Q2", senderName: "Ada Obi" }],
    [{ text: "OPay: Credit alert N1,500.50 from TUNDE (Ref sono-ab2cd3)" }, { source: "opay", isCredit: true, amountKobo: 150050, code: "SONO-AB2CD3" }],
    [{ app: "team.opay.pay", text: "You sent ₦2,000.00 to MAMA PUT. Transfer to ACCESS BANK successful" }, { isCredit: false }],
    [{ app: "team.opay.pay", text: "Airtime purchase of ₦100 successful" }, { isCredit: false }],
  ])("%#", (input, expected) => {
    expect(parseAlert(input)).toMatchObject(expected);
  });

  it("doesn't read dates or words as money", () => {
    expect(parseAlert({ text: "Login on 25 Oct from a new device" }).amountKobo).toBeNull();
  });
});

describe("transfers", () => {
  it("gives each open request its own amount and code, and reuses an open one", async () => {
    const [a, b] = [await student(), await student()];
    const pa = await startTransfer(db, a, "week", "opay", NOW);
    const pb = await startTransfer(db, b, "week", "opay", NOW);
    expect(pa.transferAmountKobo).toBeGreaterThan(50000);
    expect(pa.transferAmountKobo! - 50000).toBeLessThanOrEqual(1100);
    expect(pa.transferAmountKobo).not.toBe(pb.transferAmountKobo);
    expect(pa.code).toMatch(/^SONO-[A-Z2-9]{6}$/);
    expect((await startTransfer(db, a, "week", "opay", NOW)).id).toBe(pa.id);
    expect((await startTransfer(db, a, "week", "palmpay", NOW)).id).not.toBe(pa.id);
  });

  it("'I've sent it' grants the pass; the matching alert confirms it without adding days twice", async () => {
    const id = await student();
    const p = await startTransfer(db, id, "week", "opay", NOW);
    const claim = await claimTransfer(db, id, p.reference, NOW);
    expect(claim).toEqual({ granted: true, proUntil: addDays(NOW, 7) });
    expect(effectivePlan({ proUntil: await proUntil(id) }, NOW)).toBe("pro");

    const res = await recordAlert(db, { app: "team.opay.pay", text: `You have received ₦${naira(p.transferAmountKobo!)} from STUDENT ONE` }, later(1));
    expect(res.status).toBe("matched");
    expect((await proUntil(id))!.toISOString()).toBe(addDays(NOW, 7).toISOString());
    const [row] = await db.select().from(payments).where(eq(payments.id, p.id));
    expect(row).toMatchObject({ status: "success", confirmedBy: "alert" });

    // The forwarder sends it again: nothing changes.
    expect((await recordAlert(db, { app: "team.opay.pay", text: `You have received ₦${naira(p.transferAmountKobo!)} from STUDENT ONE` }, later(1))).status).toBe("duplicate");
    // Not claimed after expiry either.
    expect(await expireClaims(db, later(48))).toBe(0);
  });

  it("matches by the code in the transfer note even when the amount is just the price", async () => {
    const id = await student();
    const p = await startTransfer(db, id, "semester", "palmpay", NOW);
    const res = await recordAlert(db, { app: "com.transsnet.palmpay", text: `Received ₦2,000.00 from Kemi. Remark: ${p.code}` }, later(2));
    expect(res.status).toBe("matched");
    // Paid before tapping "I've sent it": the pass is added now.
    expect((await proUntil(id))!.toISOString()).toBe(addDays(later(2), 150).toISOString());
  });

  it("an unconfirmed claim expires after 24 hours and loses its pass; a late alert restores it", async () => {
    const id = await student();
    const p = await startTransfer(db, id, "week", "opay", NOW);
    await claimTransfer(db, id, p.reference, NOW);
    expect(await expireClaims(db, later(23))).toBe(0);
    expect(await expireClaims(db, later(25))).toBe(1);
    expect(effectivePlan({ proUntil: await proUntil(id) }, later(25))).toBe("free");

    // Next time they must wait for the money.
    const again = await startTransfer(db, id, "week", "opay", later(26));
    expect(await claimTransfer(db, id, again.reference, later(26))).toEqual({ granted: false });
    expect(effectivePlan({ proUntil: await proUntil(id) }, later(26))).toBe("free");
    expect((await transferQueue(db, later(26))).waiting.map((w) => w.id)).toEqual(expect.arrayContaining([p.id, again.id]));

    // The first transfer's alert turns up late (phone was off): confirmed and granted.
    expect((await recordAlert(db, { text: `OPay: You have received ₦${naira(p.transferAmountKobo!)} from LATE PAYER` }, later(30))).status).toBe("matched");
    expect(effectivePlan({ proUntil: await proUntil(id) }, later(30))).toBe("pro");
  });

  it("unmatched money waits for the admin, who can confirm or reject", async () => {
    const id = await student();
    const p = await startTransfer(db, id, "week", "opay", NOW);
    await claimTransfer(db, id, p.reference, NOW);
    const odd = await recordAlert(db, { app: "team.opay.pay", text: "You have received ₦777.00 from SOMEONE ELSE" }, later(1));
    expect(odd.status).toBe("unmatched");
    expect((await transferQueue(db, later(1))).unmatched.map((a) => a.text)).toContain("You have received ₦777.00 from SOMEONE ELSE");

    await adminReject(db, p.id);
    expect(effectivePlan({ proUntil: await proUntil(id) }, later(1))).toBe("free");

    const other = await student();
    const q = await startTransfer(db, other, "week", "opay", NOW);
    await claimTransfer(db, other, q.reference, NOW);
    const res = await adminConfirm(db, q.id, odd.status === "unmatched" ? odd.alert.id : null, later(2));
    expect(res.ok).toBe(true);
    expect((await proUntil(other))!.toISOString()).toBe(addDays(NOW, 7).toISOString());
    expect((await transferQueue(db, later(2))).unmatched.map((a) => a.text)).not.toContain("You have received ₦777.00 from SOMEONE ELSE");
  });

  it("ignores money going out", async () => {
    const res = await recordAlert(db, { app: "team.opay.pay", title: "Transfer", text: "You sent ₦503.00 to JOHN DOE" }, NOW);
    expect(res.status).toBe("ignored");
    // A personal account's other notifications aren't kept, only that one arrived.
    if (res.status === "ignored") expect(res.alert).toMatchObject({ title: null, text: "(not money in: not stored)", amountKobo: null });
  });
});
