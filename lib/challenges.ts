import { and, asc, count, desc, eq, gt, lte, sql } from "drizzle-orm";
import type { Db } from "@/db";
import { challenges, challengeSignups, leaderboardEntries, type Challenge } from "@/db/schema";
import { getChallengeBoard, type BoardRow } from "./leaderboard";

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
