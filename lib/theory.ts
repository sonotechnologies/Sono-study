import { and, asc, desc, eq, inArray, or, sql } from "drizzle-orm";
import type { Db } from "@/db";
import { chunks, courses, questions, theoryAttempts, topics, uploads } from "@/db/schema";
import { ai, AiError } from "@/lib/ai";
import { displayCourseCode } from "@/lib/format";
import type { PlanName } from "@/lib/plans";
import { getUsage, recordUsage } from "@/lib/usage";
import { verdictFor } from "./theory-copy";

/**
 * Theory/essay grading (brief §8). Each theory question carries a marking guide
 * (rubric: key points with marks), generated once and stored. A student's answer
 * is scored against it: score out of max, points covered, points missed, one tip.
 * Shown as guidance, not an official grade. Capped per day by plan.
 */

export type Rubric = { point: string; marks: number }[];
export type TheoryFeedback = { covered: string[]; missed: string[]; tip: string; verdict: string };

export class TheoryError extends Error {
  constructor(
    message: string,
    readonly code: "limit" | "busy" | "invalid",
  ) {
    super(message);
  }
}

export const MIN_ANSWER_CHARS = 40;
const DEFAULT_MARKS = 10;

/** Theory questions a student can practise on a course, with their latest score. */
export async function theoryQuestions(db: Db, userId: string, courseId: string) {
  const rows = await db
    .select({ id: questions.id, stem: questions.stem, rubric: questions.rubric, topic: topics.name, source: questions.sourceLabel })
    .from(questions)
    .leftJoin(topics, eq(topics.id, questions.topicId))
    .where(
      and(
        eq(questions.courseId, courseId),
        eq(questions.type, "theory"),
        eq(questions.status, "active"),
        or(eq(questions.visibility, "shared"), sql`${questions.sourceUploadId} in (select ${uploads.id} from ${uploads} where ${uploads.userId} = ${userId})`),
      ),
    )
    .orderBy(asc(topics.name), asc(questions.createdAt));
  const last = rows.length
    ? await db
        .select({ questionId: theoryAttempts.questionId, score: theoryAttempts.score, maxScore: theoryAttempts.maxScore, createdAt: theoryAttempts.createdAt })
        .from(theoryAttempts)
        .where(and(eq(theoryAttempts.userId, userId), inArray(theoryAttempts.questionId, rows.map((r) => r.id))))
        .orderBy(desc(theoryAttempts.createdAt))
    : [];
  const latest = new Map<string, { score: number | null; maxScore: number | null }>();
  for (const a of last) if (!latest.has(a.questionId)) latest.set(a.questionId, a);
  return rows.map((r) => ({ ...r, marks: r.rubric?.reduce((s, p) => s + p.marks, 0) ?? DEFAULT_MARKS, last: latest.get(r.id) ?? null }));
}

export async function getTheoryQuestion(db: Db, userId: string, questionId: string) {
  const [q] = await db
    .select({ q: questions, topic: topics.name, code: courses.code, courseTitle: courses.title, owner: uploads.userId })
    .from(questions)
    .innerJoin(courses, eq(courses.id, questions.courseId))
    .leftJoin(topics, eq(topics.id, questions.topicId))
    .leftJoin(uploads, eq(uploads.id, questions.sourceUploadId))
    .where(and(eq(questions.id, questionId), eq(questions.type, "theory"), eq(questions.status, "active")));
  if (!q || (q.q.visibility !== "shared" && q.owner !== userId)) return null;
  return q;
}

/** The stored rubric, or one made now from the question's source notes and stored for next time. */
export async function ensureRubric(db: Db, questionId: string): Promise<Rubric> {
  const [q] = await db
    .select({ q: questions, code: courses.code, title: courses.title })
    .from(questions)
    .innerJoin(courses, eq(courses.id, questions.courseId))
    .where(eq(questions.id, questionId));
  if (!q) throw new TheoryError("Question not found.", "invalid");
  if (q.q.rubric?.length) return q.q.rubric;
  // Notes it came from, for a guide that matches the course.
  const notes = q.q.sourceUploadId
    ? (await db.select({ text: chunks.text }).from(chunks).where(eq(chunks.uploadId, q.q.sourceUploadId)).orderBy(asc(chunks.position)).limit(2)).map((c) => c.text).join("\n\n")
    : null;
  const { value } = await ai.generateRubric(db, { course: { code: displayCourseCode(q.code), title: q.title }, question: q.q.stem, marks: DEFAULT_MARKS, notes });
  const rubric = value.rubric.map((r) => ({ point: r.point.trim().slice(0, 300), marks: r.marks }));
  await db
    .update(questions)
    .set({ rubric, ...(q.q.answer.kind === "theory" && !q.q.answer.modelAnswer && value.modelAnswer ? { answer: { kind: "theory" as const, modelAnswer: value.modelAnswer } } : {}) })
    .where(eq(questions.id, questionId));
  return rubric;
}

export type GradeResult = { attemptId: string; score: number; maxScore: number; feedback: TheoryFeedback; source: string | null };

export async function gradeAnswer(
  db: Db,
  viewer: { id: string; effectivePlan: PlanName },
  questionId: string,
  answerText: string,
  now = new Date(),
): Promise<GradeResult> {
  const answer = answerText.trim();
  if (answer.length < MIN_ANSWER_CHARS) throw new TheoryError("Write a fuller answer first: a few sentences at least.", "invalid");
  if (answer.length > 6000) throw new TheoryError("Keep your answer under 6,000 characters.", "invalid");
  const q = await getTheoryQuestion(db, viewer.id, questionId);
  if (!q) throw new TheoryError("That question isn't available.", "invalid");
  const usage = await getUsage(db, viewer.id, "theory_grading", viewer.effectivePlan, now);
  if (usage.remaining <= 0) throw new TheoryError(`You've used today's ${usage.limit} theory gradings.`, "limit");

  let graded;
  try {
    const rubric = await ensureRubric(db, questionId);
    graded = (await ai.gradeTheory(db, { question: q.q.stem, rubric, answer })).value;
  } catch (err) {
    if (err instanceof TheoryError) throw err;
    if (err instanceof AiError) throw new TheoryError("Grading is very busy right now. Your answer is still here; try again in a minute.", "busy");
    throw err;
  }
  await recordUsage(db, viewer.id, "theory_grading", 1, now);
  const score = Math.round(graded.score * 2) / 2;
  const feedback: TheoryFeedback = { covered: graded.covered, missed: graded.missed, tip: graded.tip, verdict: verdictFor(score, graded.maxScore) };
  const [row] = await db
    .insert(theoryAttempts)
    .values({ userId: viewer.id, questionId, answerText: answer, score, maxScore: graded.maxScore, feedback, createdAt: now })
    .returning({ id: theoryAttempts.id });
  return { attemptId: row.id, score, maxScore: graded.maxScore, feedback, source: q.q.sourceLabel };
}

/** The student's attempts at one question, newest first. */
export async function theoryHistory(db: Db, userId: string, questionId: string) {
  return db
    .select()
    .from(theoryAttempts)
    .where(and(eq(theoryAttempts.userId, userId), eq(theoryAttempts.questionId, questionId)))
    .orderBy(desc(theoryAttempts.createdAt))
    .limit(5);
}

/** The next theory question on the course after this one (for "Next question"). */
export async function nextTheoryQuestion(db: Db, userId: string, courseId: string, afterId: string): Promise<string | null> {
  const list = await theoryQuestions(db, userId, courseId);
  const i = list.findIndex((q) => q.id === afterId);
  const next = list.slice(i + 1).find((q) => !q.last) ?? list.slice(i + 1)[0] ?? list.find((q) => q.id !== afterId && !q.last);
  return next?.id ?? null;
}

