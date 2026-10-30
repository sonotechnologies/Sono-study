import { createHash } from "node:crypto";
import { and, desc, eq, gt, inArray, isNotNull, isNull, lt, or } from "drizzle-orm";
import type { Db } from "@/db";
import { paymentAlerts, payments, users, type Payment, type PaymentAlert, type PaymentMethod } from "@/db/schema";
import { extendProUntil } from "./billing";
import { applySuccessfulPayment } from "./payments";
import { PASSES, type PassProduct } from "./plans";
import { addDays } from "./time";

/**
 * Passes paid by transfer to Sono's own OPay / PalmPay account, confirmed automatically.
 *
 * 1. The student picks OPay or PalmPay and sees the account, an exact amount (the price plus
 *    ₦1–₦99 unique to them, e.g. ₦503) and a code for the transfer note (SONO-K3F7Q2).
 * 2. "I've sent it" gives them the pass at once ("claimed"), for up to 24 hours.
 * 3. A phone signed in to the OPay / PalmPay apps forwards every "you received ₦503 from …"
 *    notification to /api/payments/alert. The code, or failing that the exact amount, finds the
 *    payment and confirms it.
 * 4. A claim with no matching alert after 24 hours expires and the pass is taken back; a late
 *    alert still confirms it. The few that can't be matched wait on /admin/payments.
 * Someone whose claim expired or was rejected in the last 30 days waits for confirmation instead.
 */
export type TransferMethod = Exclude<PaymentMethod, "paystack">;
export const TRANSFER_METHODS: TransferMethod[] = ["opay", "palmpay"];
export const METHOD_NAMES: Record<TransferMethod, string> = { opay: "OPay", palmpay: "PalmPay" };

/** How long a claimed pass lasts before its transfer must be found. */
export const CLAIM_GRACE_MS = 24 * 3600_000;
/** A payment's amount and code stay reserved this long, and late alerts still match it. */
const OPEN_DAYS = 7;
const NO_TRUST_DAYS = 30;

export interface TransferAccount {
  method: TransferMethod;
  name: string;
  accountNumber: string;
  accountName: string;
}

/** Sono's receiving accounts, from env. In local dev without them, clearly fake demo accounts. */
export function transferAccounts(): TransferAccount[] {
  const fromEnv = TRANSFER_METHODS.flatMap((method) => {
    const prefix = method.toUpperCase();
    const accountNumber = process.env[`${prefix}_ACCOUNT_NUMBER`]?.trim();
    const accountName = process.env[`${prefix}_ACCOUNT_NAME`]?.trim();
    return accountNumber && accountName ? [{ method, name: METHOD_NAMES[method], accountNumber, accountName }] : [];
  });
  if (fromEnv.length || process.env.NODE_ENV === "production" && !process.env.ALLOW_DEMO) return fromEnv;
  return TRANSFER_METHODS.map((method) => ({ method, name: METHOD_NAMES[method], accountNumber: "0000000000", accountName: "Sono Study (demo)" }));
}

export function transferAccount(method: TransferMethod): TransferAccount | null {
  return transferAccounts().find((a) => a.method === method) ?? null;
}

export class TransferError extends Error {}

function newCode(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  return "SONO-" + Array.from(crypto.getRandomValues(new Uint8Array(6)), (b) => alphabet[b % alphabet.length]).join("");
}

const openSince = (now: Date) => addDays(now, -OPEN_DAYS);

/** Shows transfer details: reuses the student's open request for the same pass and app, or makes one. */
export async function startTransfer(db: Db, userId: string, product: PassProduct, method: TransferMethod, now = new Date()): Promise<Payment> {
  if (!transferAccount(method)) throw new TransferError(`${METHOD_NAMES[method]} payments aren't set up yet.`);
  const [open] = await db
    .select()
    .from(payments)
    .where(and(eq(payments.userId, userId), eq(payments.product, product), eq(payments.method, method), eq(payments.status, "pending"), isNull(payments.claimedAt), gt(payments.createdAt, addDays(now, -1))))
    .orderBy(desc(payments.createdAt))
    .limit(1);
  if (open) return open;

  const price = PASSES[product].amountKobo;
  for (let attempt = 0; attempt < 5; attempt++) {
    // Amounts in use by other open transfers to this account can't be told apart, so skip them.
    const taken = new Set(
      (
        await db
          .select({ amount: payments.transferAmountKobo })
          .from(payments)
          .where(and(eq(payments.method, method), inArray(payments.status, ["pending", "claimed", "expired"]), gt(payments.createdAt, openSince(now)), isNotNull(payments.transferAmountKobo)))
      ).map((r) => r.amount),
    );
    const free: number[] = [];
    for (let naira = 1; free.length === 0 || naira <= 99; naira++) if (!taken.has(price + naira * 100)) free.push(price + naira * 100);
    // Keep the extra small: one of the ten lowest free amounts (usually ₦1–₦10 over the price).
    const transferAmountKobo = free[Math.floor(Math.random() * Math.min(free.length, 10))];
    const [row] = await db
      .insert(payments)
      .values({ userId, product, method, amountKobo: price, transferAmountKobo, code: newCode(), reference: `TRF-${crypto.randomUUID()}` })
      .onConflictDoNothing()
      .returning();
    if (row) return row;
  }
  throw new TransferError("Couldn't start the payment. Try again.");
}

export type ClaimResult = { granted: true; proUntil: Date } | { granted: false };

/**
 * "I've sent it". Grants the pass straight away unless this student has an unconfirmed claim
 * already, or one that expired or was rejected recently; then it waits for the money.
 */
export async function claimTransfer(db: Db, userId: string, reference: string, now = new Date()): Promise<ClaimResult> {
  return db.transaction(async (tx) => {
    const [p] = await tx.select().from(payments).where(and(eq(payments.reference, reference), eq(payments.userId, userId))).for("update");
    if (!p || p.method === "paystack") throw new TransferError("Payment not found.");
    if (p.status === "success") return { granted: false } as const;
    if (p.status === "claimed") {
      const [u] = await tx.select({ proUntil: users.proUntil }).from(users).where(eq(users.id, userId));
      return { granted: true, proUntil: u.proUntil ?? now } as const;
    }
    if (p.status !== "pending") throw new TransferError("This payment request has closed. Start a new one.");

    const untrusted = await tx
      .select({ id: payments.id })
      .from(payments)
      .where(
        and(
          eq(payments.userId, userId),
          or(eq(payments.status, "claimed"), and(inArray(payments.status, ["expired", "failed"]), isNotNull(payments.claimedAt), gt(payments.claimedAt, addDays(now, -NO_TRUST_DAYS)))),
        ),
      )
      .limit(1);
    if (untrusted.length) {
      await tx.update(payments).set({ claimedAt: now }).where(eq(payments.id, p.id));
      return { granted: false } as const;
    }
    const [u] = await tx.select({ proUntil: users.proUntil }).from(users).where(eq(users.id, userId)).for("update");
    const proUntil = extendProUntil(u.proUntil, p.product, now);
    await tx.update(payments).set({ status: "claimed", claimedAt: now }).where(eq(payments.id, p.id));
    await tx.update(users).set({ proUntil, plan: "pro" }).where(eq(users.id, userId));
    return { granted: true, proUntil } as const;
  });
}

/** Takes back the days a claim granted. */
async function revoke(tx: Parameters<Parameters<Db["transaction"]>[0]>[0], p: Payment, status: "expired" | "failed") {
  const [u] = await tx.select({ proUntil: users.proUntil }).from(users).where(eq(users.id, p.userId)).for("update");
  const proUntil = u.proUntil ? addDays(u.proUntil, -PASSES[p.product].days) : null;
  await tx.update(users).set({ proUntil }).where(eq(users.id, p.userId));
  await tx.update(payments).set({ status }).where(eq(payments.id, p.id));
}

/** Cron step: claims whose money hasn't been found within the grace period lose their pass. */
export async function expireClaims(db: Db, now = new Date()): Promise<number> {
  const due = await db
    .select()
    .from(payments)
    .where(and(eq(payments.status, "claimed"), lt(payments.claimedAt, new Date(now.getTime() - CLAIM_GRACE_MS))));
  let n = 0;
  for (const p of due) {
    await db.transaction(async (tx) => {
      const [fresh] = await tx.select().from(payments).where(eq(payments.id, p.id)).for("update");
      if (fresh?.status !== "claimed") return;
      await revoke(tx, fresh, "expired");
      n++;
    });
  }
  return n;
}

// ── Alerts ───────────────────────────────────────────────────────────────────

export interface AlertInput {
  /** Android package or app name, when the forwarder sends it. */
  app?: string | null;
  title?: string | null;
  text: string;
}

export interface ParsedAlert {
  source: TransferMethod | "unknown";
  isCredit: boolean;
  amountKobo: number | null;
  senderName: string | null;
  code: string | null;
}

const CREDIT = /\b(received|credited|credit alert|money in|incoming|deposit(ed)?|sent you|has sent)\b/i;
const DEBIT = /\b(debited|you sent|you paid|transfer(red)? to|paid to|purchase|airtime|withdraw(al|n)?|bill payment)\b/i;
// "₦503.00", "NGN 503", "N503" (an "N" right before the digits; "ON 25" is not money).
const AMOUNT = /(?:₦|NGN\s?|\bN(?=\d))\s?(\d{1,3}(?:,\d{3})+|\d+)(?:\.(\d{1,2}))?/i;
const CODE = /SONO[\s_-]?([A-Z0-9]{6})(?![A-Z0-9])/i;
const SENDER = /\bfrom\s+([A-Za-z][A-Za-z .,'&-]{1,60}?)(?=\s*(?:\(|\bvia\b|\bon\b|\bat\b|\bwith\b|\bto\b|\bhas\b|\bref|[.!:;\n]|$))/i;

export function parseAlert(input: AlertInput): ParsedAlert {
  const all = `${input.title ?? ""}\n${input.text}`;
  const hint = `${input.app ?? ""} ${all}`.toLowerCase();
  const source = /palm\s?pay|transsnet/.test(hint) ? "palmpay" : /\bopay\b|team\.opay|opay\.|opay-inc/.test(hint) ? "opay" : "unknown";
  // Money in says so ("received", "credited"); otherwise "from someone" with no sign of money out.
  const isCredit = CREDIT.test(all) || (!DEBIT.test(all) && /\bfrom\b/i.test(all));
  const m = all.match(AMOUNT);
  const amountKobo = m ? Number(m[1].replace(/,/g, "")) * 100 + Number((m[2] ?? "0").padEnd(2, "0")) : null;
  const code = all.match(CODE);
  const sender = all.match(SENDER)?.[1]?.trim().replace(/[ ,.]+$/, "") ?? null;
  return { source, isCredit, amountKobo, senderName: sender, code: code ? `SONO-${code[1].toUpperCase()}` : null };
}

const NOT_STORED = "(not money in: not stored)";

export type AlertResult = { status: "duplicate" } | { status: "ignored"; alert: PaymentAlert } | { status: "unmatched"; alert: PaymentAlert } | { status: "matched"; alert: PaymentAlert; payment: Payment };

/** Stores a forwarded notification and, if it's money in that matches an open transfer, confirms it. */
export async function recordAlert(db: Db, input: AlertInput, now = new Date()): Promise<AlertResult> {
  const parsed = parseAlert(input);
  // The same notification forwarded twice (retries, two forwarders) within 10 minutes counts once.
  const dedupeKey = createHash("sha256")
    .update(`${parsed.source}|${input.title ?? ""}|${input.text}|${Math.floor(now.getTime() / 600_000)}`)
    .digest("hex");
  const [alert] = await db
    .insert(paymentAlerts)
    .values(
      parsed.isCredit
        ? { source: parsed.source, title: input.title ?? null, text: input.text.slice(0, 2000), isCredit: true, amountKobo: parsed.amountKobo, senderName: parsed.senderName, code: parsed.code, dedupeKey, receivedAt: now }
        : // The account may be someone's personal one: keep only that a notification came (phone health), not what it said.
          { source: parsed.source, title: null, text: NOT_STORED, isCredit: false, amountKobo: null, senderName: null, code: null, dedupeKey, receivedAt: now },
    )
    .onConflictDoNothing()
    .returning();
  if (!alert) return { status: "duplicate" };
  if (!alert.isCredit || !alert.amountKobo) return { status: "ignored", alert };
  const payment = await findPaymentForAlert(db, alert, now);
  if (!payment) return { status: "unmatched", alert };
  const linked = await confirmWithAlert(db, payment, alert, now);
  return linked ? { status: "matched", alert, payment: linked } : { status: "unmatched", alert };
}

async function findPaymentForAlert(db: Db, alert: PaymentAlert, now: Date): Promise<Payment | null> {
  const methods: TransferMethod[] = alert.source === "unknown" ? TRANSFER_METHODS : [alert.source as TransferMethod];
  const open = and(inArray(payments.method, methods), inArray(payments.status, ["pending", "claimed", "expired"]), gt(payments.createdAt, openSince(now)));
  if (alert.code) {
    // The code is in the transfer note: trust it if at least the price arrived.
    const [byCode] = await db.select().from(payments).where(and(open, eq(payments.code, alert.code)));
    if (byCode && alert.amountKobo! >= byCode.amountKobo) return byCode;
  }
  const byAmount = await db.select().from(payments).where(and(open, eq(payments.transferAmountKobo, alert.amountKobo!)));
  // Two open requests for one amount can't happen for one account; across "unknown" sources it can.
  return byAmount.length === 1 ? byAmount[0] : null;
}

async function confirmWithAlert(db: Db, payment: Payment, alert: PaymentAlert, now: Date): Promise<Payment | null> {
  const claimed = await db
    .update(paymentAlerts)
    .set({ paymentId: payment.id })
    .where(and(eq(paymentAlerts.id, alert.id), isNull(paymentAlerts.paymentId)))
    .returning({ id: paymentAlerts.id });
  if (!claimed.length) return null;
  const res = await applySuccessfulPayment(db, payment.reference, alert.amountKobo!, now, "alert");
  if (res.ok) return res.payment;
  await db.update(paymentAlerts).set({ paymentId: null }).where(eq(paymentAlerts.id, alert.id));
  return null;
}

// ── Admin ────────────────────────────────────────────────────────────────────

/** Confirms a transfer by hand (the admin saw the money). */
export async function adminConfirm(db: Db, paymentId: string, alertId: string | null, now = new Date()) {
  const [p] = await db.select().from(payments).where(eq(payments.id, paymentId));
  if (!p || p.method === "paystack") throw new TransferError("Payment not found.");
  if (alertId) await db.update(paymentAlerts).set({ paymentId }).where(and(eq(paymentAlerts.id, alertId), isNull(paymentAlerts.paymentId)));
  return applySuccessfulPayment(db, p.reference, p.transferAmountKobo ?? p.amountKobo, now, "admin");
}

/** Rejects a claim (no money arrived): takes back any pass it granted. */
export async function adminReject(db: Db, paymentId: string) {
  await db.transaction(async (tx) => {
    const [p] = await tx.select().from(payments).where(eq(payments.id, paymentId)).for("update");
    if (!p || p.method === "paystack" || p.status === "success" || p.status === "failed") return;
    if (p.status === "claimed") await revoke(tx, p, "failed");
    else await tx.update(payments).set({ status: "failed" }).where(eq(payments.id, p.id));
  });
}

export interface TransferQueue {
  /** Students who said they paid, not yet confirmed. */
  waiting: (Payment & { userName: string | null; userEmail: string | null })[];
  /** Money in that matched nothing. */
  unmatched: PaymentAlert[];
  /** When the phone last forwarded anything: shows whether the forwarder is still running. */
  lastAlertAt: Date | null;
}

export async function transferQueue(db: Db, now = new Date()): Promise<TransferQueue> {
  const [waiting, unmatched, [last]] = await Promise.all([
    db
      .select({ payment: payments, userName: users.name, userEmail: users.email })
      .from(payments)
      .innerJoin(users, eq(users.id, payments.userId))
      .where(and(inArray(payments.status, ["pending", "claimed", "expired"]), isNotNull(payments.claimedAt), gt(payments.createdAt, openSince(now))))
      .orderBy(desc(payments.claimedAt)),
    db
      .select()
      .from(paymentAlerts)
      .where(and(eq(paymentAlerts.isCredit, true), isNull(paymentAlerts.paymentId), gt(paymentAlerts.receivedAt, openSince(now))))
      .orderBy(desc(paymentAlerts.receivedAt))
      .limit(50),
    db.select({ at: paymentAlerts.receivedAt }).from(paymentAlerts).orderBy(desc(paymentAlerts.receivedAt)).limit(1),
  ]);
  return { waiting: waiting.map((r) => ({ ...r.payment, userName: r.userName, userEmail: r.userEmail })), unmatched, lastAlertAt: last?.at ?? null };
}
