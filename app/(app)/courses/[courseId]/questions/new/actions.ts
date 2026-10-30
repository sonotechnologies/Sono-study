"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getDb } from "@/db";
import { questions, topics, uploads } from "@/db/schema";
import { toRow } from "@/db/question-bank";
import type { BankQuestion } from "@/db/question-bank/types";
import { requireViewer } from "@/lib/viewer";

const input = z.object({
  courseId: z.string(),
  type: z.enum(["single", "multiple", "true_false", "fill_in"]),
  topic: z.string().trim().min(2, "Name the topic.").max(60),
  stem: z.string().trim().min(5, "Write the question.").max(2000),
  options: z.array(z.string().trim().min(1, "Fill in every option, or remove the empty ones.").max(500)).max(6),
  correct: z.array(z.number().int().min(0)).max(6),
  trueFalse: z.boolean().nullable(),
  accepted: z.array(z.string().trim().min(1)).max(10),
  explanation: z.string().trim().min(5, "Add a short explanation — it's what makes practice useful.").max(2000),
  difficulty: z.union([z.literal(1), z.literal(2), z.literal(3)]),
  share: z.boolean(),
});

export type NewQuestionInput = z.infer<typeof input>;
export type NewQuestionResult = { ok: true } | { ok: false; error: string };

/** Manual question entry (brief milestone 2: for testing before AI generation). */
export async function createQuestion(raw: NewQuestionInput): Promise<NewQuestionResult> {
  return saveQuestion(raw, null);
}

/** Edits a question the student made: typed in, or generated from their own upload (brief: review, edit or delete). */
export async function updateQuestion(questionId: string, raw: NewQuestionInput): Promise<NewQuestionResult> {
  return saveQuestion(raw, questionId);
}

/** Removes it from every bank and future mock. Hidden, not deleted, so past results keep their review. */
export async function hideQuestion(questionId: string): Promise<NewQuestionResult> {
  const viewer = await requireViewer();
  const db = await getDb();
  if (!(await canEdit(db, viewer.id, questionId))) return { ok: false, error: "You can only remove questions from your own notes." };
  await db.update(questions).set({ status: "hidden" }).where(eq(questions.id, questionId));
  revalidatePath("/upload", "layout");
  return { ok: true };
}

async function canEdit(db: Awaited<ReturnType<typeof getDb>>, userId: string, questionId: string) {
  const [q] = await db.select({ createdById: questions.createdById, sourceUploadId: questions.sourceUploadId }).from(questions).where(eq(questions.id, questionId));
  if (!q) return false;
  if (q.createdById === userId) return true;
  if (!q.sourceUploadId) return false;
  const [u] = await db.select({ id: uploads.id }).from(uploads).where(and(eq(uploads.id, q.sourceUploadId), eq(uploads.userId, userId)));
  return !!u;
}

async function saveQuestion(raw: NewQuestionInput, questionId: string | null): Promise<NewQuestionResult> {
  const parsed = input.safeParse(raw);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Check the form." };
  const q = parsed.data;
  const viewer = await requireViewer();
  if (!viewer.courses.some((c) => c.id === q.courseId)) return { ok: false, error: "Add this course first." };

  let authored: BankQuestion;
  if (q.type === "single") {
    if (q.correct.length !== 1) return { ok: false, error: "Tap the one correct option." };
    authored = { t: "single", topic: q.topic, d: q.difficulty, stem: q.stem, options: q.options, correct: q.correct[0], why: q.explanation };
  } else if (q.type === "multiple") {
    if (!q.correct.length) return { ok: false, error: "Mark at least one correct option." };
    authored = { t: "multiple", topic: q.topic, d: q.difficulty, stem: q.stem, options: q.options, correct: q.correct, why: q.explanation };
  } else if (q.type === "true_false") {
    if (q.trueFalse === null) return { ok: false, error: "Choose whether the statement is true or false." };
    authored = { t: "true_false", topic: q.topic, d: q.difficulty, stem: q.stem, correct: q.trueFalse, why: q.explanation };
  } else {
    if (!q.accepted.length) return { ok: false, error: "Add at least one accepted answer." };
    authored = { t: "fill_in", topic: q.topic, d: q.difficulty, stem: q.stem, accepted: q.accepted, why: q.explanation };
  }
  let row: ReturnType<typeof toRow>;
  try {
    row = toRow(authored, "Question");
  } catch (err) {
    const msg = (err as Error).message.replace(/^Question: /, "");
    return { ok: false, error: msg === "duplicate options" ? "Two options are the same." : msg.charAt(0).toUpperCase() + msg.slice(1) + "." };
  }

  const db = await getDb();
  if (questionId && !(await canEdit(db, viewer.id, questionId))) return { ok: false, error: "You can only edit questions from your own notes." };
  const [existing] = await db
    .select({ id: topics.id })
    .from(topics)
    .where(and(eq(topics.courseId, q.courseId), eq(topics.name, q.topic)));
  const topicId = existing?.id ?? (await db.insert(topics).values({ courseId: q.courseId, name: q.topic }).returning({ id: topics.id }))[0].id;
  const values = { ...row, topicId, stem: q.stem, explanation: q.explanation, difficulty: q.difficulty, visibility: q.share ? ("shared" as const) : ("private" as const) };
  if (questionId) {
    await db.update(questions).set(values).where(eq(questions.id, questionId));
    revalidatePath("/upload", "layout");
  } else {
    await db.insert(questions).values({ courseId: q.courseId, createdById: viewer.id, ...values });
  }
  return { ok: true };
}
