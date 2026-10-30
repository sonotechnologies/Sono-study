import { and, asc, count, countDistinct, eq, inArray, isNotNull, ne, or, sql } from "drizzle-orm";
import type { Db } from "@/db";
import { bankRatings, banks, flashcards, mockAttempts, questions, uploads } from "@/db/schema";

/**
 * Course banks (brief milestone 4). Every finished upload becomes a bank,
 * shared with the course (same school + course code, since courses are per
 * school) when the student contributes. Seeded papers are "Verified".
 * Practising a shared bank costs no AI, so it's unlimited on every plan.
 */

/** Creates (or refreshes) the bank for a finished upload. Linked re-uploads have none of their own. */
export async function ensureUploadBank(db: Db, uploadId: string): Promise<string | null> {
  const [u] = await db.select().from(uploads).where(eq(uploads.id, uploadId));
  if (!u || u.status !== "ready") return null;
  const ids = (
    await db
      .select({ id: questions.id })
      .from(questions)
      .where(and(eq(questions.sourceUploadId, u.id), eq(questions.status, "active"), ne(questions.type, "theory")))
      .orderBy(asc(questions.sourceLabel), asc(questions.createdAt))
  ).map((q) => q.id);
  if (!ids.length) return null;
  const [row] = await db
    .insert(banks)
    .values({ courseId: u.courseId, ownerId: u.userId, uploadId: u.id, title: u.title, questionIds: ids, isShared: u.visibility === "contribute" })
    .onConflictDoUpdate({ target: banks.uploadId, set: { questionIds: ids, isShared: u.visibility === "contribute", title: u.title } })
    .returning({ id: banks.id });
  return row.id;
}

/** The contribute toggle after the fact: questions, flashcards and the bank follow the upload. */
export async function setUploadSharing(db: Db, userId: string, uploadId: string, contribute: boolean): Promise<boolean> {
  const [u] = await db.select({ id: uploads.id, reusedFromId: uploads.reusedFromId }).from(uploads).where(and(eq(uploads.id, uploadId), eq(uploads.userId, userId)));
  if (!u) return false;
  const visibility = contribute ? ("shared" as const) : ("private" as const);
  await db.transaction(async (tx) => {
    await tx.update(uploads).set({ visibility: contribute ? "contribute" : "private" }).where(eq(uploads.id, uploadId));
    await tx.update(questions).set({ visibility }).where(eq(questions.sourceUploadId, uploadId));
    await tx.update(flashcards).set({ visibility }).where(eq(flashcards.sourceUploadId, uploadId));
    await tx.update(banks).set({ isShared: contribute }).where(eq(banks.uploadId, uploadId));
  });
  return true;
}

export type BankView = {
  id: string;
  title: string;
  questions: number;
  students: number;
  rating: number | null;
  ratingCount: number;
  verified: boolean;
  mine: boolean;
  isShared: boolean;
  isPastPaper: boolean;
};

/** Banks a student can take on a course: shared ones and their own. Verified first, then best rated, then most used. */
export async function courseBanksView(db: Db, userId: string, courseId: string): Promise<BankView[]> {
  const rows = await db
    .select({
      id: banks.id,
      title: banks.title,
      questionIds: banks.questionIds,
      rating: banks.rating,
      ratingCount: banks.ratingCount,
      verified: banks.verified,
      ownerId: banks.ownerId,
      isShared: banks.isShared,
      isPastPaper: uploads.isPastPaper,
    })
    .from(banks)
    .leftJoin(uploads, eq(uploads.id, banks.uploadId))
    .where(and(eq(banks.courseId, courseId), or(eq(banks.isShared, true), eq(banks.ownerId, userId))));
  if (!rows.length) return [];
  const used = await db
    .select({ bankId: mockAttempts.bankId, n: countDistinct(mockAttempts.userId) })
    .from(mockAttempts)
    .where(and(inArray(mockAttempts.bankId, rows.map((r) => r.id)), isNotNull(mockAttempts.submittedAt)))
    .groupBy(mockAttempts.bankId);
  const students = new Map(used.map((u) => [u.bankId, Number(u.n)]));
  // Count only questions this student can still take (reported or removed ones drop out).
  const allIds = [...new Set(rows.flatMap((r) => r.questionIds))];
  const live = new Set(
    allIds.length
      ? (await db.select({ id: questions.id }).from(questions).where(and(inArray(questions.id, allIds), eq(questions.status, "active")))).map((q) => q.id)
      : [],
  );
  return rows
    .map((r) => ({
      id: r.id,
      title: r.title,
      questions: r.questionIds.filter((id) => live.has(id)).length,
      students: students.get(r.id) ?? 0,
      rating: r.rating,
      ratingCount: r.ratingCount,
      verified: r.verified,
      mine: r.ownerId === userId,
      isShared: r.isShared,
      isPastPaper: !!r.isPastPaper,
    }))
    .filter((b) => b.questions > 0)
    .sort(
      (a, b) =>
        Number(b.verified) - Number(a.verified) ||
        (b.ratingCount >= 3 ? (b.rating ?? 0) : 0) - (a.ratingCount >= 3 ? (a.rating ?? 0) : 0) ||
        b.students - a.students ||
        a.title.localeCompare(b.title),
    );
}

/** The class bank: every question classmates contributed to this course (design 2d "186 Qs · from 23 uploads"). */
export async function classBank(db: Db, courseId: string): Promise<{ questions: number; uploads: number }> {
  const [row] = await db
    .select({ questions: count(questions.id), uploads: countDistinct(questions.sourceUploadId) })
    .from(questions)
    .where(and(eq(questions.courseId, courseId), eq(questions.status, "active"), eq(questions.visibility, "shared"), isNotNull(questions.sourceUploadId), ne(questions.type, "theory")));
  return { questions: Number(row?.questions ?? 0), uploads: Number(row?.uploads ?? 0) };
}

export class BankError extends Error {}

/** 1–5 stars, only after finishing a mock from the bank. Keeps banks.rating as the average. */
export async function rateBank(db: Db, userId: string, bankId: string, stars: number): Promise<{ rating: number; count: number }> {
  const s = Math.round(stars);
  if (!(s >= 1 && s <= 5)) throw new BankError("Pick 1 to 5 stars.");
  const [taken] = await db
    .select({ id: mockAttempts.id })
    .from(mockAttempts)
    .where(and(eq(mockAttempts.userId, userId), eq(mockAttempts.bankId, bankId), isNotNull(mockAttempts.submittedAt)))
    .limit(1);
  if (!taken) throw new BankError("Finish a mock from this bank before rating it.");
  const [own] = await db.select({ ownerId: banks.ownerId }).from(banks).where(eq(banks.id, bankId));
  if (own?.ownerId === userId) throw new BankError("You can't rate your own bank.");
  return db.transaction(async (tx) => {
    await tx
      .insert(bankRatings)
      .values({ bankId, userId, stars: s })
      .onConflictDoUpdate({ target: [bankRatings.bankId, bankRatings.userId], set: { stars: s } });
    const [agg] = await tx
      .select({ avg: sql<number>`avg(${bankRatings.stars})::real`, n: count() })
      .from(bankRatings)
      .where(eq(bankRatings.bankId, bankId));
    const rating = Math.round(Number(agg.avg) * 10) / 10;
    await tx.update(banks).set({ rating, ratingCount: Number(agg.n) }).where(eq(banks.id, bankId));
    return { rating, count: Number(agg.n) };
  });
}

export async function myBankRating(db: Db, userId: string, bankId: string): Promise<number | null> {
  const [r] = await db.select({ stars: bankRatings.stars }).from(bankRatings).where(and(eq(bankRatings.bankId, bankId), eq(bankRatings.userId, userId)));
  return r?.stars ?? null;
}

export function bankSubtitle(b: Pick<BankView, "questions" | "students" | "rating" | "ratingCount">): string {
  const parts = [`${b.questions} Qs`];
  if (b.students) parts.push(`used by ${b.students >= 1000 ? `${(b.students / 1000).toFixed(1)}k` : b.students} student${b.students === 1 ? "" : "s"}`);
  if (b.rating !== null && b.ratingCount >= 3) parts.push(`★ ${b.rating.toFixed(1)}`);
  return parts.join(" · ");
}

