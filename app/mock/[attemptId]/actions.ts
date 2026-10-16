"use server";

import { redirect } from "next/navigation";
import { getDb } from "@/db";
import { answerPractice, ExamError, finalizeAttempt, getAttemptFor, type PracticeFeedback } from "@/lib/exam-engine/service";
import type { AttemptResponse } from "@/lib/exam-engine/types";
import { getViewerId } from "@/lib/viewer";

export async function checkPracticeAnswer(
  attemptId: string,
  questionId: string,
  response: AttemptResponse,
): Promise<{ ok: true; feedback: PracticeFeedback } | { ok: false; error: string }> {
  const userId = await getViewerId();
  if (!userId) return { ok: false, error: "Sign in again to keep practising." };
  try {
    return { ok: true, feedback: await answerPractice(await getDb(), userId, attemptId, questionId, response) };
  } catch (err) {
    if (err instanceof ExamError) return { ok: false, error: err.message };
    throw err;
  }
}

export async function finishPractice(attemptId: string) {
  const userId = await getViewerId();
  if (!userId) redirect("/login");
  const db = await getDb();
  const a = await getAttemptFor(db, userId, attemptId);
  if (a && a.status === "in_progress") await finalizeAttempt(db, a, "student");
  redirect(`/results/${attemptId}`);
}
