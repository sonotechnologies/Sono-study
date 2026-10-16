"use server";

import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/db";
import { questions, topics } from "@/db/schema";
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
  const [existing] = await db
    .select({ id: topics.id })
    .from(topics)
    .where(and(eq(topics.courseId, q.courseId), eq(topics.name, q.topic)));
  const topicId = existing?.id ?? (await db.insert(topics).values({ courseId: q.courseId, name: q.topic }).returning({ id: topics.id }))[0].id;
  await db.insert(questions).values({
    courseId: q.courseId,
    topicId,
    createdById: viewer.id,
    ...row,
    stem: q.stem,
    explanation: q.explanation,
    difficulty: q.difficulty,
    visibility: q.share ? "shared" : "private",
  });
  return { ok: true };
}
