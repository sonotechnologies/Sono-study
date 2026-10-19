import { and, asc, count, desc, eq, gt, inArray, lte, ne, sql } from "drizzle-orm";
import type { Db } from "@/db";
import { banks, challenges, challengeSignups, leaderboardEntries, questions, type Challenge } from "@/db/schema";
import { seededRandom, shuffle } from "./exam-engine/rules";
import { getChallengeBoard, type BoardRow } from "./leaderboard";
import { addDays } from "./time";

/** Weekly challenge format: Friday 18:00–22:00 Lagos, 20 questions in 15 minutes. */
export const WEEKLY_CHALLENGE = { questionCount: 20, durationSec: 15 * 60, windowMs: 4 * 3600_000 } as const;

/** Friday 18:00 Lagos on or after `now` (or next week's if this week's has passed). */
export function nextFridayChallengeStart(now: Date): Date {
  const watNow = new Date(now.getTime() + 3600_000);
  const daysToFri = (5 - watNow.getUTCDay() + 7) % 7;
  const start = Date.UTC(watNow.getUTCFullYear(), watNow.getUTCMonth(), watNow.getUTCDate() + daysToFri, 17); // 18:00 WAT
  return start > now.getTime() ? new Date(start) : addDays(new Date(start), 7);
}

/**
 * Cron step: makes next Friday's challenge for every course with enough shared questions.
 * Each gets its own fixed question set (a private, ownerless bank), so everyone sits the same
 * paper even if questions are added later. Ids are derived from course + date, so running it
 * again (or twice at once) creates nothing new. Returns the ids it created.
 */
export async function ensureWeeklyChallenges(db: Db, now = new Date()): Promise<string[]> {
  const startsAt = nextFridayChallengeStart(now);
  const day = startsAt.toISOString().slice(0, 10);
  const pool = and(eq(questions.status, "active"), eq(questions.visibility, "shared"), ne(questions.type, "theory"));
  const eligible = await db
    .select({ courseId: questions.courseId })
    .from(questions)
    .where(pool)
    .groupBy(questions.courseId)
    .having(sql`count(*) >= ${WEEKLY_CHALLENGE.questionCount}`);
  if (!eligible.length) return [];
  const scheduled = await db
    .select({ courseId: challenges.courseId })
    .from(challenges)
    .where(and(inArray(challenges.courseId, eligible.map((e) => e.courseId)), eq(challenges.startsAt, startsAt)));
  const have = new Set(scheduled.map((c) => c.courseId));

  const created: string[] = [];
  for (const { courseId } of eligible) {
    if (have.has(courseId)) continue;
    const id = `chl-${courseId}-${day}`;
    const ids = (await db.select({ id: questions.id }).from(questions).where(and(pool, eq(questions.courseId, courseId)))).map((q) => q.id).sort();
    const picked = shuffle(ids, seededRandom(id)).slice(0, WEEKLY_CHALLENGE.questionCount);
    const done = await db.transaction(async (tx) => {
      const [bank] = await tx
        .insert(banks)
        .values({ id: `bank-${id}`, courseId, title: `Friday Challenge · ${day}`, questionIds: picked, isShared: false, verified: true })
        .onConflictDoNothing()
        .returning({ id: banks.id });
      if (!bank) return false;
      await tx.insert(challenges).values({
        id,
        courseId,
        bankId: bank.id,
        title: "Friday Challenge",
        questionCount: picked.length,
        durationSec: WEEKLY_CHALLENGE.durationSec,
        startsAt,
        endsAt: new Date(startsAt.getTime() + WEEKLY_CHALLENGE.windowMs),
      });
      return true;
    });
    if (done) created.push(id);
  }
  return created;
}

export interface ChallengeReward {
  xp: number;
  badge: string | null;
}

/** Rewards revealed when a challenge closes. */
export function challengeReward(rank: number, total: number): ChallengeReward {
  if (rank <= 3) return { xp: 250, badge: "Podium" };
  if (rank <= 10) return { xp: 150, badge: "Top 10" };
  if (total > 0 && rank / total <= 0.25) return { xp: 75, badge: null };
  return { xp: 25, badge: null };
}

/** 6 of 212 → 3 ("Top 3%"). Never shows "Top 0%". */
export function topPercent(rank: number, total: number): number {
  return Math.max(1, Math.ceil((rank / total) * 100));
}

export interface UpcomingChallenge {
  challenge: Challenge;
  live: boolean;
  joined: number;
  viewerJoined: boolean;
}

export interface ClosedChallenge {
  challenge: Challenge;
  total: number;
  classAverage: number;
  viewer: (BoardRow & { reward: ChallengeReward; topPercent: number }) | null;
}

/** The challenge that's live now, or the next one to start. */
export async function getUpcomingChallenge(db: Db, courseId: string, viewerId: string, now = new Date()): Promise<UpcomingChallenge | null> {
  const [challenge] = await db
    .select()
    .from(challenges)
    .where(and(eq(challenges.courseId, courseId), gt(challenges.endsAt, now)))
    .orderBy(asc(challenges.startsAt))
    .limit(1);
  if (!challenge) return null;
  const [[{ joined }], mine] = await Promise.all([
    db.select({ joined: count() }).from(challengeSignups).where(eq(challengeSignups.challengeId, challenge.id)),
    db
      .select({ userId: challengeSignups.userId })
      .from(challengeSignups)
      .where(and(eq(challengeSignups.challengeId, challenge.id), eq(challengeSignups.userId, viewerId))),
  ]);
  return { challenge, live: challenge.startsAt <= now, joined: Number(joined), viewerJoined: mine.length > 0 };
}

export async function getClosedChallenges(db: Db, courseId: string, now = new Date(), limit = 10): Promise<Challenge[]> {
  return db
    .select()
    .from(challenges)
    .where(and(eq(challenges.courseId, courseId), lte(challenges.endsAt, now)))
    .orderBy(desc(challenges.endsAt))
    .limit(limit);
}

/** Results for a closed challenge. Results stay hidden until it closes. */
export async function getClosedChallengeResult(
  db: Db,
  challenge: Challenge,
  viewerId: string,
  standingsLimit = 10,
): Promise<ClosedChallenge & { standings: BoardRow[] }> {
  const [board, [avg]] = await Promise.all([
    getChallengeBoard(db, { challengeId: challenge.id, viewerId, limit: standingsLimit }),
    db
      .select({ avg: sql<number>`coalesce(avg(${leaderboardEntries.score}), 0)::float` })
      .from(leaderboardEntries)
      .where(eq(leaderboardEntries.challengeId, challenge.id)),
  ]);
  const viewer = board.viewer
    ? { ...board.viewer, reward: challengeReward(board.viewer.rank, board.total), topPercent: topPercent(board.viewer.rank, board.total) }
    : null;
  return { challenge, total: board.total, classAverage: Math.round(Number(avg.avg)), viewer, standings: board.rows };
}

export async function getLastClosedChallenge(db: Db, courseId: string, viewerId: string, now = new Date()) {
  const [last] = await getClosedChallenges(db, courseId, now, 1);
  return last ? getClosedChallengeResult(db, last, viewerId) : null;
}

export async function getChallenge(db: Db, id: string): Promise<Challenge | null> {
  const [c] = await db.select().from(challenges).where(eq(challenges.id, id));
  return c ?? null;
}

/** "Join · remind me". Idempotent. */
export async function joinChallenge(db: Db, challengeId: string, userId: string) {
  await db.insert(challengeSignups).values({ challengeId, userId }).onConflictDoNothing();
}
