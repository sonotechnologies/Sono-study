import { createECDH, createHash, randomBytes } from "node:crypto";
import { mkdtemp } from "node:fs/promises";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import webpush from "web-push";
import { createPgliteDb, type Db } from "@/db";
import { challenges, challengeSignups, enrollments, pushLog, pushSubscriptions, users } from "@/db/schema";
import { seed } from "@/db/seed";
import { setAiProvidersForTests } from "@/lib/ai";
import { fakeProvider } from "@/lib/ai/fake";
import { notifyOnce, saveSubscription, sendDueReminders, sendPush, setPushSenderForTests, type PushPayload } from "@/lib/push";
import { putObject } from "@/lib/storage";
import { confirmUpload, prepareUpload, processQueue } from "@/lib/uploads";
import { makeNotesPdf } from "./fixtures/notes";

const SEED_NOW = new Date("2026-10-19T09:00:00Z"); // Monday 10:00 Lagos
let db: Db;
let sent: { endpoint: string; payload: PushPayload }[] = [];
let status = 201;

beforeAll(async () => {
  process.env.LOCAL_STORAGE_DIR = await mkdtemp(path.join(tmpdir(), "sono-push-"));
  db = await createPgliteDb();
  await seed(db, SEED_NOW);
  setAiProvidersForTests([fakeProvider("fake")]);
});
afterAll(() => {
  setPushSenderForTests(null);
  setAiProvidersForTests(null);
});
beforeEach(() => {
  sent = [];
  status = 201;
  setPushSenderForTests(async (t, payload) => {
    sent.push({ endpoint: t.endpoint, payload });
    return status;
  });
});

let n = 0;
async function student(fields: Partial<typeof users.$inferInsert> = {}, subscribe = true) {
  const id = `push-${++n}`;
  await db.insert(users).values({ id, name: id, email: `${id}@example.com`, schoolId: "sch-unilag", onboardedAt: SEED_NOW, ...fields });
  await db.insert(enrollments).values({ userId: id, courseId: "crs-gst111" });
  if (subscribe) await saveSubscription(db, id, { endpoint: `https://push.example/${id}`, p256dh: "p256dh-key-0123456789", auth: "auth-0123" });
  return id;
}
const to = (id: string) => sent.filter((s) => s.endpoint.endsWith(`/${id}`));

describe("push delivery", () => {
  it("sends each (kind, key) once, and forgets devices that are gone", async () => {
    const id = await student();
    const payload = { title: "Hi", body: "There", url: "/home" };
    expect(await notifyOnce(db, id, "daily_reminder", "2026-10-19", payload)).toBe(true);
    expect(await notifyOnce(db, id, "daily_reminder", "2026-10-19", payload)).toBe(false);
    expect(to(id)).toHaveLength(1);
    const [log] = await db.select().from(pushLog).where(eq(pushLog.userId, id));
    expect(log.delivered).toBe(1);

    status = 410;
    expect(await sendPush(db, id, payload)).toBe(0);
    expect(await db.select().from(pushSubscriptions).where(eq(pushSubscriptions.userId, id))).toHaveLength(0);
  });

  it("does nothing without VAPID keys", async () => {
    setPushSenderForTests(null);
    delete process.env.VAPID_PUBLIC_KEY;
    const id = await student();
    expect(await notifyOnce(db, id, "streak", "x", { title: "", body: "", url: "/" })).toBe(false);
    expect(await sendDueReminders(db, new Date())).toEqual({ daily: 0, streak: 0, challenge: 0 });
  });

  it("speaks the Web Push protocol (VAPID + aes128gcm) to the push service", async () => {
    const received: { headers: Record<string, string | string[] | undefined>; body: Buffer }[] = [];
    const server = createServer((req, res) => {
      const parts: Buffer[] = [];
      req.on("data", (c) => parts.push(c));
      req.on("end", () => {
        received.push({ headers: req.headers, body: Buffer.concat(parts) });
        res.statusCode = received.length === 1 ? 201 : 410;
        res.end();
      });
    });
    await new Promise<void>((r) => server.listen(0, r));
    const port = (server.address() as { port: number }).port;
    const keys = webpush.generateVAPIDKeys();
    Object.assign(process.env, { VAPID_PUBLIC_KEY: keys.publicKey, VAPID_PRIVATE_KEY: keys.privateKey, VAPID_SUBJECT: "mailto:test@example.com" });
    setPushSenderForTests(null);
    try {
      const browser = createECDH("prime256v1");
      browser.generateKeys();
      const id = await student({}, false);
      // web-push only checks the endpoint is a URL; http to localhost stands in for the push service.
      await saveSubscription(db, id, { endpoint: `http://localhost:${port}/send/abc`, p256dh: browser.getPublicKey("base64url"), auth: randomBytes(16).toString("base64url") });
      expect(await sendPush(db, id, { title: "Your questions are ready", body: "GST 111", url: "/upload/x" })).toBe(1);
      const [msg] = received;
      expect(msg.headers["content-encoding"]).toBe("aes128gcm");
      expect(String(msg.headers.authorization)).toMatch(/^vapid t=.+, k=/);
      expect(Number(msg.headers.ttl)).toBe(6 * 3600);
      expect(msg.body.includes(Buffer.from("Your questions"))).toBe(false); // encrypted
      // The push service says the subscription expired: it's removed.
      expect(await sendPush(db, id, { title: "x", body: "y", url: "/" })).toBe(0);
      expect(await db.select().from(pushSubscriptions).where(eq(pushSubscriptions.userId, id))).toHaveLength(0);
    } finally {
      server.close();
      delete process.env.VAPID_PUBLIC_KEY;
      delete process.env.VAPID_PRIVATE_KEY;
    }
  });
});

describe("reminders", () => {
  it("daily reminder at the student's own time, once, and not after they've studied", async () => {
    const due = await student({ reminderTime: "20:00", lastActiveDate: "2026-10-19", streakDays: 4 });
    const studied = await student({ reminderTime: "20:00", lastActiveDate: "2026-10-20" });
    const off = await student({ reminderTime: "20:00", notifyDailyReminder: false });
    const later = await student({ reminderTime: "21:30" });
    const unsubscribed = await student({ reminderTime: "20:00" }, false);

    await sendDueReminders(db, new Date("2026-10-20T18:59:00Z")); // 19:59 Lagos: too early
    expect(to(due)).toHaveLength(0);
    await sendDueReminders(db, new Date("2026-10-20T19:05:00Z")); // 20:05 Lagos
    await sendDueReminders(db, new Date("2026-10-20T19:06:00Z"));
    expect(to(due)).toHaveLength(1);
    expect(to(due)[0].payload.body).toMatch(/4-day streak/);
    for (const id of [studied, off, later, unsubscribed]) expect(to(id)).toHaveLength(0);
  });

  it("streak nudge from 21:00 for a streak that hasn't been kept today", async () => {
    const atRisk = await student({ lastActiveDate: "2026-10-20", streakDays: 6, notifyDailyReminder: false });
    const kept = await student({ lastActiveDate: "2026-10-21", streakDays: 7, notifyDailyReminder: false });
    const lapsed = await student({ lastActiveDate: "2026-10-19", streakDays: 6, notifyDailyReminder: false });
    await sendDueReminders(db, new Date("2026-10-21T18:00:00Z")); // 19:00
    expect(to(atRisk)).toHaveLength(0);
    await sendDueReminders(db, new Date("2026-10-21T20:10:00Z")); // 21:10
    await sendDueReminders(db, new Date("2026-10-21T21:40:00Z")); // 22:40
    expect(to(atRisk).map((s) => s.payload.title)).toEqual(["Your 6-day streak ends at midnight"]);
    expect(to(kept)).toHaveLength(0);
    expect(to(lapsed)).toHaveLength(0);
  });

  it("challenge starts: to everyone who joined, and to opted-in classmates", async () => {
    const [c] = await db.select().from(challenges).where(eq(challenges.id, "chl-gst111-next"));
    const joined = await student({ notifyDailyReminder: false });
    const optedIn = await student({ notifyChallenge: true, notifyDailyReminder: false });
    const neither = await student({ notifyDailyReminder: false });
    await db.insert(challengeSignups).values({ challengeId: c.id, userId: joined });

    await sendDueReminders(db, new Date(c.startsAt.getTime() - 60_000));
    expect(to(joined)).toHaveLength(0);
    await sendDueReminders(db, new Date(c.startsAt.getTime() + 60_000));
    await sendDueReminders(db, new Date(c.startsAt.getTime() + 120_000));
    expect(to(joined)).toHaveLength(1);
    expect(to(joined)[0].payload).toMatchObject({ title: "GST111 Friday Challenge is live", url: `/leaderboard/challenges/${c.id}` });
    expect(to(optedIn)).toHaveLength(1);
    expect(to(neither)).toHaveLength(0);
  });

  it("tells the student when an upload finishes", async () => {
    const id = await student({ notifyDailyReminder: false });
    const bytes = await makeNotesPdf(4);
    const prep = await prepareUpload(db, id, {
      courseId: "crs-gst111",
      contribute: false,
      files: [{ name: "Week 9.pdf", type: "application/pdf", size: bytes.byteLength, hash: createHash("sha256").update(bytes).digest("hex") }],
    });
    if (prep.reused) throw new Error("expected a new upload");
    for (const t of prep.targets) await putObject(t.key, bytes, "application/pdf");
    await confirmUpload(db, id, prep.uploadId);
    for (let i = 0; i < 10 && (await processQueue(db, { budgetMs: 60_000 })).ran; i++);
    expect(to(id)).toHaveLength(1);
    expect(to(id)[0].payload).toMatchObject({ title: "Your questions are ready", url: `/upload/${prep.uploadId}` });
    expect(to(id)[0].payload.body).toMatch(/^Week 9: \d+ questions/);
  });
});
