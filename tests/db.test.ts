import { beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { createPgliteDb, type Db } from "@/db";
import { users } from "@/db/schema";
import { DEMO_USER_ID, seed } from "@/db/seed";
import { getCourseBoard, recordWeeklyResult } from "@/lib/leaderboard";
import { getLastClosedChallenge, getUpcomingChallenge, joinChallenge } from "@/lib/challenges";
import { applySuccessfulPayment, createPendingPayment } from "@/lib/payments";
import { getReferralProgress, getUsage, recordUsage } from "@/lib/usage";

const NOW = new Date("2026-10-16T18:05:00Z"); // Friday, 19:05 Lagos
const viewer = { id: DEMO_USER_ID, schoolId: "sch-unilag", department: "Mass Communication" };
let db: Db;

beforeAll(async () => {
  db = await createPgliteDb();
  await seed(db, NOW);
});

describe("weekly leaderboard", () => {
  it("ranks the course week and pins the viewer", async () => {
    const board = await getCourseBoard(db, { courseId: "crs-gst111", scope: "week", viewer, now: NOW });
    expect(board.rows).toHaveLength(9);
    expect(board.rows[0]).toMatchObject({ rank: 1, name: "@ada_reads", score: 29, timeSec: 768, mocks: 14 });
    expect(board.rows[1].name).toMatch(/^Anonymous /);
    expect(board.viewer).toMatchObject({ rank: 14, name: "@tolu", score: 24, timeSec: 1180, mocks: 6, isViewer: true });
    expect(board.total).toBe(49);
  });

  it("filters to the viewer's department", async () => {
    const board = await getCourseBoard(db, { courseId: "crs-gst111", scope: "department", viewer, now: NOW });
    expect(board.total).toBeLessThan(49);
    expect(board.viewer?.rank).toBeLessThan(14);
  });

  it("takes each student's best week for all time", async () => {
    const board = await getCourseBoard(db, { courseId: "crs-gst111", scope: "all", viewer, now: NOW });
    expect(board.rows[0]).toMatchObject({ score: 30, maxScore: 30 });
    expect(board.viewer).toMatchObject({ score: 24, mocks: 9 });
  });

  it("keeps the best result and counts every mock", async () => {
    const u = "peer-200";
    expect(await recordWeeklyResult(db, { courseId: "crs-mth101", userId: u, score: 10, maxScore: 10, timeSec: 60, now: NOW })).toBe(false);
    await recordWeeklyResult(db, { courseId: "crs-mth101", userId: u, score: 20, maxScore: 30, timeSec: 900, now: NOW });
    await recordWeeklyResult(db, { courseId: "crs-mth101", userId: u, score: 18, maxScore: 30, timeSec: 600, now: NOW });
    await recordWeeklyResult(db, { courseId: "crs-mth101", userId: u, score: 20, maxScore: 30, timeSec: 700, now: NOW });
    const board = await getCourseBoard(db, { courseId: "crs-mth101", scope: "week", viewer: { ...viewer, id: u }, now: NOW });
    expect(board.viewer).toMatchObject({ rank: 1, score: 20, timeSec: 700, mocks: 3 });
  });
});

describe("challenges", () => {
  it("shows the next challenge with sign-ups", async () => {
    const up = await getUpcomingChallenge(db, "crs-gst111", DEMO_USER_ID, NOW);
    expect(up).toMatchObject({ live: false, joined: 218, viewerJoined: false });
    expect(up!.challenge.startsAt.toISOString()).toBe("2026-10-23T17:00:00.000Z");
    await joinChallenge(db, up!.challenge.id, DEMO_USER_ID);
    await joinChallenge(db, up!.challenge.id, DEMO_USER_ID);
    expect(await getUpcomingChallenge(db, "crs-gst111", DEMO_USER_ID, NOW)).toMatchObject({ joined: 219, viewerJoined: true });
  });

  it("reveals the closed challenge result", async () => {
    const last = await getLastClosedChallenge(db, "crs-gst111", DEMO_USER_ID, NOW);
    expect(last).not.toBeNull();
    expect(last!.total).toBe(212);
    expect(last!.viewer).toMatchObject({ rank: 6, score: 26, timeSec: 842, topPercent: 3, reward: { xp: 150, badge: "Top 10" } });
    expect(last!.classAverage).toBeGreaterThanOrEqual(15);
    expect(last!.classAverage).toBeLessThanOrEqual(19);
    expect(last!.standings).toHaveLength(10);
  });
});

describe("payments", () => {
  it("extends Pro once per payment and stacks passes", async () => {
    const p1 = await createPendingPayment(db, DEMO_USER_ID, "week");
    const first = await applySuccessfulPayment(db, p1.reference, 50_000, NOW);
    expect(first).toMatchObject({ ok: true, alreadyApplied: false });
    const again = await applySuccessfulPayment(db, p1.reference, 50_000, NOW);
    expect(again).toMatchObject({ ok: true, alreadyApplied: true });

    const p2 = await createPendingPayment(db, DEMO_USER_ID, "semester");
    expect(await applySuccessfulPayment(db, p2.reference, 100, NOW)).toEqual({ ok: false, reason: "amount_mismatch" });
    await applySuccessfulPayment(db, p2.reference, 200_000, NOW);

    const [u] = await db.select().from(users).where(eq(users.id, DEMO_USER_ID));
    expect(u.proUntil?.toISOString()).toBe(new Date(NOW.getTime() + 157 * 86_400_000).toISOString());
    expect(await applySuccessfulPayment(db, "nope", 1, NOW)).toEqual({ ok: false, reason: "not_found" });
  });
});

describe("usage & referrals", () => {
  it("counts daily usage in Lagos days", async () => {
    expect(await getUsage(db, DEMO_USER_ID, "upload", "free", NOW)).toMatchObject({ used: 2, limit: 2, remaining: 0 });
    await recordUsage(db, DEMO_USER_ID, "tutor_message", 3, NOW);
    await recordUsage(db, DEMO_USER_ID, "tutor_message", 1, NOW);
    expect(await getUsage(db, DEMO_USER_ID, "tutor_message", "free", NOW)).toMatchObject({ used: 4, remaining: 6 });
    const tomorrow = new Date(NOW.getTime() + 86_400_000);
    expect(await getUsage(db, DEMO_USER_ID, "upload", "free", tomorrow)).toMatchObject({ used: 0 });
  });

  it("counts referred classmates who finished a mock", async () => {
    expect(await getReferralProgress(db, DEMO_USER_ID)).toBe(1);
  });
});
