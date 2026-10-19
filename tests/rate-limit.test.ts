import { beforeAll, describe, expect, it } from "vitest";
import { createPgliteDb, type Db } from "@/db";
import { rateLimits } from "@/db/schema";
import { checkRateLimit, hit, ipFrom, pruneRateLimits, RATE_LIMITS, RateLimitError } from "@/lib/rate-limit";

let db: Db;
beforeAll(async () => {
  db = await createPgliteDb();
});

const T = new Date("2026-10-19T09:00:10Z");
const later = (ms: number) => new Date(T.getTime() + ms);

describe("rate limits", () => {
  it("counts per key in one-minute windows", async () => {
    const results = [];
    for (let i = 0; i < 4; i++) results.push(await hit(db, "k", 3, T));
    expect(results).toEqual([true, true, true, false]);
    expect(await hit(db, "other", 3, T)).toBe(true);
    expect(await hit(db, "k", 3, later(50_000))).toBe(true); // next window
  });

  it("limits each user, and each IP across users", async () => {
    const { user, ip } = RATE_LIMITS.payment;
    for (let i = 0; i < user; i++) await checkRateLimit(db, "payment", { userId: "u1", ip: "1.1.1.1" }, T);
    const err = await checkRateLimit(db, "payment", { userId: "u1", ip: "1.1.1.1" }, T).catch((e) => e);
    expect(err).toBeInstanceOf(RateLimitError);
    expect(err.retryAfterSec).toBe(50);
    expect(err.message).toBe("Too many requests. Wait 50 seconds and try again.");
    // Another student on the same network is fine until the IP's own limit.
    await checkRateLimit(db, "payment", { userId: "u2", ip: "1.1.1.1" }, T);
    for (let i = user + 2; i < ip; i++) await checkRateLimit(db, "payment", { userId: `u${i}`, ip: "1.1.1.1" }, T);
    await expect(checkRateLimit(db, "payment", { userId: "fresh", ip: "1.1.1.1" }, T)).rejects.toBeInstanceOf(RateLimitError);
    await checkRateLimit(db, "payment", { userId: "fresh", ip: "2.2.2.2" }, T);
    // A minute later, all clear.
    await checkRateLimit(db, "payment", { userId: "u1", ip: "1.1.1.1" }, later(60_000));
  });

  it("reads the client IP from proxy headers and prunes old windows", async () => {
    expect(ipFrom(new Headers({ "x-forwarded-for": "41.58.1.2, 10.0.0.1" }))).toBe("41.58.1.2");
    expect(ipFrom(new Headers({ "x-real-ip": "41.58.1.3" }))).toBe("41.58.1.3");
    expect(ipFrom(new Headers())).toBeNull();
    await pruneRateLimits(db, later(30 * 60_000));
    expect(await db.select().from(rateLimits)).toHaveLength(0);
  });
});
