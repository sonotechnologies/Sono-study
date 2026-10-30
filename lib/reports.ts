import { and, count, desc, eq, inArray, isNull, sql } from "drizzle-orm";
import type { Db } from "@/db";
import { courses, questionReports, questions, schools, uploads, users } from "@/db/schema";

/**
 * "Report question" (brief: content safety): reasons wrong answer, off-topic,
 * copied, inappropriate. Three students reporting a shared question hides it
 * pending review; an admin restores or removes it.
 */

export const REPORT_REASONS = {
  wrong_answer: "Wrong answer",
  off_topic: "Off-topic",
  copied: "Copied",
  inappropriate: "Inappropriate",
} as const;
export type ReportReason = keyof typeof REPORT_REASONS;

export const AUTO_HIDE_REPORTS = 3;

export class ReportError extends Error {}

export async function reportQuestion(
  db: Db,
  userId: string,
  input: { questionId: string; reason: ReportReason; note?: string | null },
): Promise<{ hidden: boolean; already: boolean }> {
  if (!(input.reason in REPORT_REASONS)) throw new ReportError("Pick a reason.");
  const [q] = await db.select({ id: questions.id, status: questions.status }).from(questions).where(eq(questions.id, input.questionId));
  if (!q) throw new ReportError("That question no longer exists.");
  return db.transaction(async (tx) => {
    const inserted = await tx
      .insert(questionReports)
      .values({ questionId: q.id, userId, reason: input.reason, note: input.note?.trim().slice(0, 500) || null })
      .onConflictDoNothing()
      .returning({ id: questionReports.id });
    if (!inserted.length) return { hidden: q.status === "reported", already: true };
    const [{ open }] = await tx
      .select({ open: count() })
      .from(questionReports)
      .where(and(eq(questionReports.questionId, q.id), isNull(questionReports.resolvedAt)));
    const hide = Number(open) >= AUTO_HIDE_REPORTS && q.status === "active";
    await tx
      .update(questions)
      .set({ reports: sql`${questions.reports} + 1`, ...(hide ? { status: "reported" as const } : {}) })
      .where(eq(questions.id, q.id));
    return { hidden: hide || q.status === "reported", already: false };
  });
}

export type ReportedItem = {
  questionId: string;
  stem: string;
  status: string;
  courseCode: string;
  school: string | null;
  source: string | null;
  uploaderHandle: string | null;
  reasons: { reason: ReportReason; count: number }[];
  notes: string[];
  total: number;
  firstAt: Date;
};

/** Open reports, auto-hidden questions first, then most reported. */
export async function openReports(db: Db): Promise<ReportedItem[]> {
  const rows = await db
    .select({
      questionId: questionReports.questionId,
      reason: questionReports.reason,
      note: questionReports.note,
      createdAt: questionReports.createdAt,
    })
    .from(questionReports)
    .where(isNull(questionReports.resolvedAt))
    .orderBy(desc(questionReports.createdAt));
  if (!rows.length) return [];
  const ids = [...new Set(rows.map((r) => r.questionId))];
  const qs = await db
    .select({
      id: questions.id,
      stem: questions.stem,
      status: questions.status,
      code: courses.code,
      school: schools.shortName,
      source: questions.sourceLabel,
      handle: users.handle,
    })
    .from(questions)
    .innerJoin(courses, eq(courses.id, questions.courseId))
    .leftJoin(schools, eq(schools.id, courses.schoolId))
    .leftJoin(uploads, eq(uploads.id, questions.sourceUploadId))
    .leftJoin(users, eq(users.id, uploads.userId))
    .where(inArray(questions.id, ids));
  return qs
    .map((q) => {
      const mine = rows.filter((r) => r.questionId === q.id);
      const tally = new Map<ReportReason, number>();
      for (const r of mine) tally.set(r.reason, (tally.get(r.reason) ?? 0) + 1);
      return {
        questionId: q.id,
        stem: q.stem,
        status: q.status,
        courseCode: q.code,
        school: q.school,
        source: q.source,
        uploaderHandle: q.handle,
        reasons: [...tally].map(([reason, n]) => ({ reason, count: n })).sort((a, b) => b.count - a.count),
        notes: mine.map((r) => r.note).filter((n): n is string => !!n),
        total: mine.length,
        firstAt: mine.reduce((d, r) => (r.createdAt < d ? r.createdAt : d), mine[0].createdAt),
      };
    })
    .sort((a, b) => Number(b.status === "reported") - Number(a.status === "reported") || b.total - a.total || a.firstAt.getTime() - b.firstAt.getTime());
}

/** Restore: the question was fine. Remove: keep it out of every bank and mock. */
export async function resolveReports(db: Db, questionId: string, action: "restore" | "remove", now = new Date()) {
  await db.transaction(async (tx) => {
    await tx
      .update(questionReports)
      .set({ resolvedAt: now, resolution: action === "restore" ? "restored" : "removed" })
      .where(and(eq(questionReports.questionId, questionId), isNull(questionReports.resolvedAt)));
    if (action === "restore") {
      // Only undo the auto-hide; a question its author deleted stays deleted.
      await tx.update(questions).set({ status: "active" }).where(and(eq(questions.id, questionId), eq(questions.status, "reported")));
    } else {
      await tx.update(questions).set({ status: "hidden" }).where(eq(questions.id, questionId));
    }
  });
}

export async function openReportCount(db: Db): Promise<number> {
  const [r] = await db.select({ n: sql<number>`count(distinct ${questionReports.questionId})::int` }).from(questionReports).where(isNull(questionReports.resolvedAt));
  return Number(r?.n ?? 0);
}
