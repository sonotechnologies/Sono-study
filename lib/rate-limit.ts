import { lt, sql } from "drizzle-orm";
import { headers } from "next/headers";
import type { Db } from "@/db";
import { rateLimits } from "@/db/schema";

/**
 * Abuse limits, separate from the plan's daily allowances: they stop scripts and runaway
 * clicking, never a student studying normally. Fixed one-minute windows counted in Postgres,
 * so they hold across serverless instances. Each bucket is checked per user and per IP.
 */
export const RATE_LIMITS = {
  /** Starting and confirming uploads. */
  upload: { user: 12, ip: 40 },
  /** File bytes sent to local storage (one request per file or photo). */
  uploadFile: { user: 80, ip: 200 },
  /** Tutor messages and theory marking. */
  ai: { user: 20, ip: 60 },
  /** Starting a Paystack checkout. */
  payment: { user: 6, ip: 20 },
  /** Returning from checkout (verifies with Paystack). */
  paymentReturn: { user: 20, ip: 30 },
  /** Email sign-in links. */
  signIn: { user: 5, ip: 10 },
} as const;
export type RateBucket = keyof typeof RATE_LIMITS;

const WINDOW_MS = 60_000;

export class RateLimitError extends Error {
  constructor(readonly retryAfterSec: number) {
    super(`Too many requests. Wait ${retryAfterSec} second${retryAfterSec === 1 ? "" : "s"} and try again.`);
  }
}

/** Counts one request against `key`; true while the count is within `limit`. */
export async function hit(db: Db, key: string, limit: number, now = new Date()): Promise<boolean> {
  const windowStart = new Date(Math.floor(now.getTime() / WINDOW_MS) * WINDOW_MS);
  const [row] = await db
    .insert(rateLimits)
    .values({ key, windowStart, count: 1 })
    .onConflictDoUpdate({ target: [rateLimits.key, rateLimits.windowStart], set: { count: sql`${rateLimits.count} + 1` } })
    .returning({ count: rateLimits.count });
  return row.count <= limit;
}

/** Throws RateLimitError when the user or the IP is over the bucket's limit for this minute. */
export async function checkRateLimit(db: Db, bucket: RateBucket, who: { userId?: string | null; ip?: string | null }, now = new Date()) {
  const rule = RATE_LIMITS[bucket];
  const checks = [
    who.userId ? hit(db, `${bucket}:user:${who.userId}`, rule.user, now) : true,
    who.ip ? hit(db, `${bucket}:ip:${who.ip}`, rule.ip, now) : true,
  ];
  if ((await Promise.all(checks)).every(Boolean)) return;
  throw new RateLimitError(Math.max(1, Math.ceil((WINDOW_MS - (now.getTime() % WINDOW_MS)) / 1000)));
}

/** The caller's IP, from the proxy headers Vercel (or any reverse proxy) sets. */
export function ipFrom(h: Headers): string | null {
  const forwarded = h.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwarded || h.get("x-real-ip") || null;
}

/** For server actions: the current request's IP. */
export async function requestIp(): Promise<string | null> {
  return ipFrom(await headers());
}

/** Cron step: drop counters from earlier windows. */
export async function pruneRateLimits(db: Db, now = new Date()) {
  await db.delete(rateLimits).where(lt(rateLimits.windowStart, new Date(now.getTime() - 10 * WINDOW_MS)));
}
