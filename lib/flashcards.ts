import { and, asc, count, eq, gte, inArray, isNull, lte, or, sql } from "drizzle-orm";
import type { Db } from "@/db";
import { cardReviewLog, cardReviews, flashcards, topics, uploads, users, type CardRating } from "@/db/schema";
import { nextStreak } from "./streak";
import { addDays, lagosDate } from "./time";

/**
 * Flashcards with SM-2 style scheduling (brief §6), four buttons as in design 2k:
 *   Again → relearn in under a minute (a lapse), Hard → 6 min / ×1.2,
 *   Good → 1 day / ×ease, Easy → 4 days / ×ease×1.3.
 * Ease starts at 2.5 and never drops below 1.3. Intervals are in days.
 */

export const RATINGS: CardRating[] = ["again", "hard", "good", "easy"];
export const START_EASE = 2.5;
export const MIN_EASE = 1.3;
export const NEW_CARDS_PER_DAY = 20;
export const XP_PER_CARD = 3;

const MINUTE = 1 / (24 * 60);
const AGAIN_DAYS = 0.5 * MINUTE; // "<1 min"
const HARD_NEW_DAYS = 6 * MINUTE;

export type CardState = { ease: number; intervalDays: number; lapses: number };

export function schedule(state: CardState | null, rating: CardRating): CardState {
  const next = scheduleRaw(state, rating);
  return { ...next, ease: Math.round(next.ease * 100) / 100 };
}

function scheduleRaw(state: CardState | null, rating: CardRating): CardState {
  const ease = state?.ease ?? START_EASE;
  const interval = state?.intervalDays ?? 0;
  const lapses = state?.lapses ?? 0;
  const learned = interval >= 1; // graduated to day-scale reviews
  switch (rating) {
    case "again":
      return { ease: Math.max(MIN_EASE, ease - 0.2), intervalDays: AGAIN_DAYS, lapses: learned ? lapses + 1 : lapses };
    case "hard":
      return { ease: Math.max(MIN_EASE, ease - 0.15), intervalDays: learned ? Math.max(1, interval * 1.2) : HARD_NEW_DAYS, lapses };
    case "good":
      return { ease, intervalDays: learned ? Math.max(interval + 1, interval * ease) : 1, lapses };
    case "easy":
      return { ease: ease + 0.15, intervalDays: learned ? Math.max(interval + 1, interval * ease * 1.3) : 4, lapses };
  }
}

/** "<1 min", "6 min", "1 day", "4 days", "2 wk", "3 mo" for the rating buttons. */
export function intervalLabel(days: number): string {
  const minutes = days * 24 * 60;
  if (minutes < 1) return "<1 min";
  if (minutes < 60) return `${Math.round(minutes)} min`;
  if (days < 1) return `${Math.round(days * 24)} h`;
  if (days < 14) return `${Math.round(days)} day${Math.round(days) === 1 ? "" : "s"}`;
  if (days < 60) return `${Math.round(days / 7)} wk`;
  return `${Math.round(days / 30)} mo`;
}

export function previewIntervals(state: CardState | null): Record<CardRating, string> {
  return Object.fromEntries(RATINGS.map((r) => [r, intervalLabel(schedule(state, r).intervalDays)])) as Record<CardRating, string>;
}

/** Cards a student may study on a course: shared ones, ones from their own uploads, and ones they wrote. */
function visibleCards(userId: string, courseId: string) {
  return and(
    eq(flashcards.courseId, courseId),
    or(eq(flashcards.visibility, "shared"), eq(flashcards.createdById, userId), sql`${flashcards.sourceUploadId} in (select ${uploads.id} from ${uploads} where ${uploads.userId} = ${userId})`),
  );
}

const lagosMidnight = (now: Date) => new Date(`${lagosDate(now)}T00:00:00+01:00`);

async function newIntroducedToday(db: Db, userId: string, courseId: string, now: Date): Promise<number> {
  // A card's first-ever review today = a new card introduced today.
  const [row] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(
      db
        .select({ id: cardReviewLog.flashcardId, first: sql`min(${cardReviewLog.reviewedAt})`.as("first") })
        .from(cardReviewLog)
        .where(and(eq(cardReviewLog.userId, userId), eq(cardReviewLog.courseId, courseId)))
        .groupBy(cardReviewLog.flashcardId)
        .as("firsts"),
    )
    .where(sql`first >= ${lagosMidnight(now).toISOString()}`);
  return Number(row?.n ?? 0);
}

export type DueCounts = { review: number; fresh: number; total: number };

/** Due now: reviews whose time has come, plus today's share of new cards (20 a day). */
export async function dueCounts(db: Db, userId: string, courseId: string, now = new Date()): Promise<DueCounts> {
  const [[review], [fresh], introduced] = await Promise.all([
    db
      .select({ n: count() })
      .from(cardReviews)
      .innerJoin(flashcards, eq(flashcards.id, cardReviews.flashcardId))
      .where(and(eq(cardReviews.userId, userId), lte(cardReviews.dueAt, now), visibleCards(userId, courseId))),
    db
      .select({ n: count() })
      .from(flashcards)
      .leftJoin(cardReviews, and(eq(cardReviews.flashcardId, flashcards.id), eq(cardReviews.userId, userId)))
      .where(and(visibleCards(userId, courseId), isNull(cardReviews.flashcardId))),
    newIntroducedToday(db, userId, courseId, now),
  ]);
  const r = Number(review?.n ?? 0);
  const f = Math.min(Number(fresh?.n ?? 0), Math.max(0, NEW_CARDS_PER_DAY - introduced));
  return { review: r, fresh: f, total: r + f };
}

export type StudyCard = {
  id: string;
  front: string;
  back: string;
  topic: string | null;
  source: string | null;
  isNew: boolean;
  /** The student wrote it, or it came from their upload: they may edit it. */
  editable: boolean;
  intervals: Record<CardRating, string>;
};

/** The next cards to study: overdue reviews first (oldest first), then new cards. */
export async function dueQueue(db: Db, userId: string, courseId: string, limit = 20, now = new Date()): Promise<StudyCard[]> {
  const counts = await dueCounts(db, userId, courseId, now);
  const reviewRows = await db
    .select({ f: flashcards, topic: topics.name, ease: cardReviews.ease, interval: cardReviews.intervalDays, lapses: cardReviews.lapses, ownerId: uploads.userId })
    .from(cardReviews)
    .innerJoin(flashcards, eq(flashcards.id, cardReviews.flashcardId))
    .leftJoin(topics, eq(topics.id, flashcards.topicId))
    .leftJoin(uploads, eq(uploads.id, flashcards.sourceUploadId))
    .where(and(eq(cardReviews.userId, userId), lte(cardReviews.dueAt, now), visibleCards(userId, courseId)))
    .orderBy(asc(cardReviews.dueAt))
    .limit(limit);
  const room = Math.max(0, Math.min(limit - reviewRows.length, counts.fresh));
  const newRows = room
    ? await db
        .select({ f: flashcards, topic: topics.name, ownerId: uploads.userId })
        .from(flashcards)
        .leftJoin(cardReviews, and(eq(cardReviews.flashcardId, flashcards.id), eq(cardReviews.userId, userId)))
        .leftJoin(topics, eq(topics.id, flashcards.topicId))
        .leftJoin(uploads, eq(uploads.id, flashcards.sourceUploadId))
        .where(and(visibleCards(userId, courseId), isNull(cardReviews.flashcardId)))
        // Cards the student wrote come first, then the rest in the order they were made.
        .orderBy(sql`(${flashcards.createdById} = ${userId}) desc nulls last`, asc(flashcards.createdAt), asc(flashcards.id))
        .limit(room)
    : [];
  const card = (f: typeof flashcards.$inferSelect, topic: string | null, ownerId: string | null, state: CardState | null): StudyCard => ({
    id: f.id,
    front: f.front,
    back: f.back,
    topic,
    source: f.sourceLabel,
    isNew: !state,
    editable: f.createdById === userId || ownerId === userId,
    intervals: previewIntervals(state),
  });
  return [
    ...reviewRows.map((r) => card(r.f, r.topic, r.ownerId, { ease: r.ease, intervalDays: r.interval, lapses: r.lapses })),
    ...newRows.map((r) => card(r.f, r.topic, r.ownerId, null)),
  ];
}

export class CardError extends Error {}

/** Records a rating: reschedules the card, logs it, adds XP and keeps the streak. */
export async function reviewCard(db: Db, userId: string, flashcardId: string, rating: CardRating, now = new Date()) {
  if (!RATINGS.includes(rating)) throw new CardError("Pick Again, Hard, Good or Easy.");
  const [f] = await db.select({ id: flashcards.id, courseId: flashcards.courseId }).from(flashcards).where(eq(flashcards.id, flashcardId));
  if (!f) throw new CardError("That card no longer exists.");
  return db.transaction(async (tx) => {
    const [prev] = await tx.select().from(cardReviews).where(and(eq(cardReviews.userId, userId), eq(cardReviews.flashcardId, flashcardId)));
    const next = schedule(prev ? { ease: prev.ease, intervalDays: prev.intervalDays, lapses: prev.lapses } : null, rating);
    const dueAt = new Date(now.getTime() + next.intervalDays * 86_400_000);
    await tx
      .insert(cardReviews)
      .values({ userId, flashcardId, ...next, dueAt })
      .onConflictDoUpdate({ target: [cardReviews.userId, cardReviews.flashcardId], set: { ...next, dueAt } });
    await tx.insert(cardReviewLog).values({ userId, flashcardId, courseId: f.courseId, rating, reviewedAt: now });
    const [u] = await tx.select({ streakDays: users.streakDays, lastActiveDate: users.lastActiveDate }).from(users).where(eq(users.id, userId));
    await tx
      .update(users)
      .set({ xp: sql`${users.xp} + ${XP_PER_CARD}`, ...nextStreak(u, lagosDate(now)) })
      .where(eq(users.id, userId));
    return { ...next, dueAt };
  });
}

export type SessionSummary = { counts: Record<CardRating, number>; total: number; xp: number; again: string[]; nextDue: { count: number; when: Date } | null };

/** The 2l summary for reviews since `since`: rating spread, XP, the "Again" cards and when the next batch is due. */
export async function sessionSummary(db: Db, userId: string, courseId: string, since: Date, now = new Date()): Promise<SessionSummary> {
  const rows = await db
    .select({ id: cardReviewLog.flashcardId, rating: cardReviewLog.rating })
    .from(cardReviewLog)
    .where(and(eq(cardReviewLog.userId, userId), eq(cardReviewLog.courseId, courseId), gte(cardReviewLog.reviewedAt, since)))
    .orderBy(asc(cardReviewLog.reviewedAt));
  const last = new Map<string, CardRating>();
  for (const r of rows) last.set(r.id, r.rating);
  const counts = { again: 0, hard: 0, good: 0, easy: 0 } as Record<CardRating, number>;
  for (const r of rows) counts[r.rating]++;
  // Next batch: day-scale reviews due within the coming week, grouped to the first day that has any.
  const soon = await db
    .select({ dueAt: cardReviews.dueAt })
    .from(cardReviews)
    .where(and(eq(cardReviews.userId, userId), gte(cardReviews.dueAt, addDays(now, 0.04)), lte(cardReviews.dueAt, addDays(now, 7)), inArray(cardReviews.flashcardId, db.select({ id: flashcards.id }).from(flashcards).where(eq(flashcards.courseId, courseId)))))
    .orderBy(asc(cardReviews.dueAt));
  let nextDue: SessionSummary["nextDue"] = null;
  if (soon.length) {
    const day = lagosDate(soon[0].dueAt);
    nextDue = { count: soon.filter((s) => lagosDate(s.dueAt) === day).length, when: soon[0].dueAt };
  }
  return { counts, total: rows.length, xp: rows.length * XP_PER_CARD, again: [...last].filter(([, r]) => r === "again").map(([id]) => id), nextDue };
}

/** Cards reviewed today on a course (the study plan's "Review N cards"). */
export async function reviewedToday(db: Db, userId: string, courseId: string, now = new Date()): Promise<number> {
  const [row] = await db
    .select({ n: count() })
    .from(cardReviewLog)
    .where(and(eq(cardReviewLog.userId, userId), eq(cardReviewLog.courseId, courseId), gte(cardReviewLog.reviewedAt, lagosMidnight(now))));
  return Number(row?.n ?? 0);
}

/** "Students can add or edit" cards. New cards are private to the student who wrote them. */
export async function saveCard(
  db: Db,
  userId: string,
  input: { courseId: string; front: string; back: string; topicId?: string | null; cardId?: string | null },
): Promise<string> {
  const front = input.front.trim().slice(0, 500);
  const back = input.back.trim().slice(0, 1000);
  if (front.length < 2 || back.length < 1) throw new CardError("Write both sides of the card.");
  if (input.cardId) {
    const [c] = await db
      .select({ id: flashcards.id, createdById: flashcards.createdById, ownerId: uploads.userId })
      .from(flashcards)
      .leftJoin(uploads, eq(uploads.id, flashcards.sourceUploadId))
      .where(eq(flashcards.id, input.cardId));
    if (!c || (c.createdById !== userId && c.ownerId !== userId)) throw new CardError("You can only edit your own cards.");
    await db.update(flashcards).set({ front, back, ...(input.topicId !== undefined ? { topicId: input.topicId } : {}) }).where(eq(flashcards.id, c.id));
    return c.id;
  }
  const [row] = await db
    .insert(flashcards)
    .values({ courseId: input.courseId, front, back, topicId: input.topicId ?? null, createdById: userId, visibility: "private", sourceLabel: "Your card" })
    .returning({ id: flashcards.id });
  return row.id;
}
