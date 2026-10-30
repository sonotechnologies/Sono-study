import { and, eq, gte, inArray, isNotNull, lte, ne, or, sql } from "drizzle-orm";
import webpush from "web-push";
import type { Db } from "@/db";
import { challenges, challengeSignups, courses, enrollments, pushLog, pushSubscriptions, users, type PushKind } from "@/db/schema";
import { addDays, lagosDate } from "./time";

/**
 * Web Push reminders (VAPID). Every notification is logged under (user, kind, key) before it is
 * sent, so the minute-by-minute cron can run as often as it likes and each one still goes out once.
 * With no VAPID keys set, nothing is sent and the Profile switch stays hidden.
 */
export interface PushPayload {
  title: string;
  body: string;
  /** Opened when the notification is tapped. */
  url: string;
  /** Same tag replaces an older notification on the phone instead of stacking. */
  tag?: string;
}

export interface PushTarget {
  endpoint: string;
  p256dh: string;
  auth: string;
}

/** Sends one message; returns the push service's HTTP status. 404/410 mean the subscription is gone. */
export type PushSender = (target: PushTarget, payload: PushPayload) => Promise<number>;

export function vapidPublicKey(): string | null {
  return process.env.VAPID_PUBLIC_KEY || null;
}

function vapidConfigured() {
  return !!(process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY);
}

const webPushSender: PushSender = async (target, payload) => {
  // web-push encrypts and signs (aes128gcm + VAPID); fetch sends it, with a timeout.
  const req = webpush.generateRequestDetails({ endpoint: target.endpoint, keys: { p256dh: target.p256dh, auth: target.auth } }, JSON.stringify(payload), {
    vapidDetails: {
      subject: process.env.VAPID_SUBJECT || `mailto:${process.env.SUPPORT_EMAIL || "support@sono.study"}`,
      publicKey: process.env.VAPID_PUBLIC_KEY!,
      privateKey: process.env.VAPID_PRIVATE_KEY!,
    },
    TTL: 6 * 3600,
    urgency: "normal",
  });
  const res = await fetch(req.endpoint, { method: req.method, headers: req.headers as Record<string, string>, body: req.body as Buffer<ArrayBuffer>, signal: AbortSignal.timeout(10_000) });
  return res.status;
};

let testSender: PushSender | null = null;
/** Tests swap the sender for a recorder (null restores the real one). */
export function setPushSenderForTests(sender: PushSender | null) {
  testSender = sender;
}
function sender(): PushSender | null {
  return testSender ?? (vapidConfigured() ? webPushSender : null);
}

export async function saveSubscription(db: Db, userId: string, sub: PushTarget) {
  await db
    .insert(pushSubscriptions)
    .values({ ...sub, userId })
    .onConflictDoUpdate({ target: pushSubscriptions.endpoint, set: { userId, p256dh: sub.p256dh, auth: sub.auth } });
}

export async function removeSubscription(db: Db, userId: string, endpoint: string) {
  await db.delete(pushSubscriptions).where(and(eq(pushSubscriptions.endpoint, endpoint), eq(pushSubscriptions.userId, userId)));
}

/** Sends to every device the user has; forgets devices the push service says are gone. Returns deliveries. */
export async function sendPush(db: Db, userId: string, payload: PushPayload): Promise<number> {
  const send = sender();
  if (!send) return 0;
  const subs = await db.select().from(pushSubscriptions).where(eq(pushSubscriptions.userId, userId));
  let delivered = 0;
  for (const s of subs) {
    let status: number;
    try {
      status = await send(s, payload);
    } catch {
      continue; // network trouble: try again with the next notification
    }
    if (status === 404 || status === 410) await db.delete(pushSubscriptions).where(eq(pushSubscriptions.endpoint, s.endpoint));
    else if (status >= 200 && status < 300) delivered++;
  }
  return delivered;
}

/** Sends once per (user, kind, key). Returns whether this call claimed it. */
export async function notifyOnce(db: Db, userId: string, kind: PushKind, key: string, payload: PushPayload): Promise<boolean> {
  if (!sender()) return false;
  const claimed = await db.insert(pushLog).values({ userId, kind, key }).onConflictDoNothing().returning({ key: pushLog.key });
  if (!claimed.length) return false;
  const delivered = await sendPush(db, userId, payload);
  await db
    .update(pushLog)
    .set({ delivered })
    .where(and(eq(pushLog.userId, userId), eq(pushLog.kind, kind), eq(pushLog.key, key)));
  return true;
}

/** "Your questions are ready" — sent when an upload finishes in the background. Never throws. */
export async function notifyUploadReady(db: Db, upload: { id: string; userId: string; title: string; questionsMade: number; flashcardsMade: number }) {
  try {
    const made = [upload.questionsMade && `${upload.questionsMade} questions`, upload.flashcardsMade && `${upload.flashcardsMade} flashcards`].filter(Boolean).join(" and ");
    await notifyOnce(db, upload.userId, "upload_ready", upload.id, {
      title: "Your questions are ready",
      body: `${upload.title}: ${made}. Start a mock while it's fresh.`,
      url: `/upload/${upload.id}`,
      tag: `upload-${upload.id}`,
    });
  } catch {
    // A notification must never fail the upload.
  }
}

const minutesOfDay = (hhmm: string) => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3, 5));
/** Reminders are due from their time until this many minutes after (covers a missed cron run). */
const REMINDER_WINDOW_MIN = 30;
/** From this Lagos time, a streak that hasn't been kept today gets a nudge. */
export const STREAK_NUDGE_AT = "21:00";
/** A challenge's "starts now" is sent up to this long after it opens. */
const CHALLENGE_WINDOW_MS = 30 * 60_000;

export interface ReminderSummary {
  daily: number;
  streak: number;
  challenge: number;
}

/** Cron step: the daily study reminder, the streak nudge and "challenge starts". */
export async function sendDueReminders(db: Db, now = new Date()): Promise<ReminderSummary> {
  const summary: ReminderSummary = { daily: 0, streak: 0, challenge: 0 };
  if (!sender()) return summary;
  const today = lagosDate(now);
  const yesterday = lagosDate(addDays(now, -1));
  const wat = new Date(now.getTime() + 3600_000);
  const minute = wat.getUTCHours() * 60 + wat.getUTCMinutes();
  const subscribed = sql`exists (select 1 from ${pushSubscriptions} where ${pushSubscriptions.userId} = ${users.id})`;

  // Daily reminder at the student's own time, unless they've already studied today.
  const daily = await db
    .select({ id: users.id, reminderTime: users.reminderTime, streakDays: users.streakDays, lastActiveDate: users.lastActiveDate })
    .from(users)
    .where(and(eq(users.notifyDailyReminder, true), subscribed, or(sql`${users.lastActiveDate} is null`, ne(users.lastActiveDate, today))));
  for (const u of daily) {
    const since = minute - minutesOfDay(u.reminderTime);
    if (since < 0 || since >= REMINDER_WINDOW_MIN) continue;
    const kept = u.lastActiveDate === yesterday && u.streakDays > 0;
    const sent = await notifyOnce(db, u.id, "daily_reminder", today, {
      title: "Study time",
      body: kept ? `10 minutes keeps your ${u.streakDays}-day streak going.` : "A quick mock or 10 flashcards. Your plan for today is ready.",
      url: "/home",
      tag: "daily",
    });
    if (sent) summary.daily++;
  }

  // Streak about to break: studied yesterday, not yet today, and it's evening.
  if (minute >= minutesOfDay(STREAK_NUDGE_AT)) {
    const atRisk = await db
      .select({ id: users.id, streakDays: users.streakDays })
      .from(users)
      .where(and(eq(users.notifyStreak, true), subscribed, eq(users.lastActiveDate, yesterday), gte(users.streakDays, 2)));
    for (const u of atRisk) {
      const sent = await notifyOnce(db, u.id, "streak", today, {
        title: `Your ${u.streakDays}-day streak ends at midnight`,
        body: "One quick session keeps it alive.",
        url: "/home",
        tag: "streak",
      });
      if (sent) summary.streak++;
    }
  }

  // Challenge starts: everyone who tapped "Join · remind me", plus enrolled students who opted in.
  const live = await db
    .select({ id: challenges.id, courseId: challenges.courseId, title: challenges.title, questionCount: challenges.questionCount, durationSec: challenges.durationSec, code: courses.code })
    .from(challenges)
    .innerJoin(courses, eq(courses.id, challenges.courseId))
    .where(and(lte(challenges.startsAt, now), gte(challenges.startsAt, new Date(now.getTime() - CHALLENGE_WINDOW_MS)), sql`${challenges.endsAt} > ${now}`));
  for (const c of live) {
    const [joined, optedIn] = await Promise.all([
      db.select({ id: challengeSignups.userId }).from(challengeSignups).where(eq(challengeSignups.challengeId, c.id)),
      db
        .select({ id: users.id })
        .from(enrollments)
        .innerJoin(users, eq(users.id, enrollments.userId))
        .where(and(eq(enrollments.courseId, c.courseId), eq(users.notifyChallenge, true))),
    ]);
    const ids = [...new Set([...joined, ...optedIn].map((r) => r.id))];
    if (!ids.length) continue;
    const reachable = await db
      .selectDistinct({ id: pushSubscriptions.userId })
      .from(pushSubscriptions)
      .where(and(inArray(pushSubscriptions.userId, ids), isNotNull(pushSubscriptions.endpoint)));
    for (const u of reachable) {
      const sent = await notifyOnce(db, u.id, "challenge", c.id, {
        title: `${c.code} ${c.title} is live`,
        body: `${c.questionCount} questions in ${Math.round(c.durationSec / 60)} minutes. Same paper for everyone.`,
        url: `/leaderboard/challenges/${c.id}`,
        tag: `challenge-${c.id}`,
      });
      if (sent) summary.challenge++;
    }
  }
  return summary;
}
