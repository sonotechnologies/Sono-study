"use server";

import { redirect } from "next/navigation";
import { getDb } from "@/db";
import { ExamError, retake, startAttempt, weakestTopics, type StartInput } from "@/lib/exam-engine/service";
import { requireViewer } from "@/lib/viewer";
import type { AttemptConfig } from "@/db/schema";

export interface StartState {
  error: string | null;
}

async function start(input: StartInput): Promise<StartState> {
  const viewer = await requireViewer();
  let id: string;
  try {
    id = (await startAttempt(await getDb(), viewer.id, input)).id;
  } catch (err) {
    if (err instanceof ExamError) return { error: err.message };
    throw err;
  }
  redirect(`/mock/${id}`);
}

/** Mock setup (2h) → start. */
export async function startMockAction(_prev: StartState, form: FormData): Promise<StartState> {
  const courseId = String(form.get("courseId") ?? "");
  const time = String(form.get("time") ?? "");
  const difficulty = String(form.get("difficulty") ?? "mixed");
  const bankId = String(form.get("bankId") ?? "") || null;
  const config: AttemptConfig = {
    count: Number(form.get("count") ?? 30),
    timeLimitSec: time === "none" ? null : Number(time) * 60,
    topicIds: form.getAll("topicId").map(String).filter(Boolean),
    difficulty: difficulty === "easier" || difficulty === "harder" ? difficulty : "mixed",
    bankId,
  };
  if (bankId) config.topicIds = [];
  return start({ mode: "mock", courseId, config });
}

/** Practice a topic (or several). */
export async function startPracticeAction(courseId: string, topicIds: string[]) {
  const res = await start({ mode: "practice", courseId, topicIds });
  if (res.error) redirect(`/courses?error=${encodeURIComponent(res.error)}`);
}

/** "Fix my weak topics": practice from the 3 lowest-mastery topics. */
export async function fixWeakTopicsAction(courseId: string) {
  const viewer = await requireViewer();
  const weak = await weakestTopics(await getDb(), viewer.id, courseId, 3);
  await startPracticeAction(
    courseId,
    weak.map((t) => t.id),
  );
}

export async function startChallengeAction(challengeId: string) {
  const res = await start({ mode: "challenge", challengeId });
  if (res.error) redirect(`/leaderboard?error=${encodeURIComponent(res.error)}`);
}

export async function retakeAction(attemptId: string) {
  const viewer = await requireViewer();
  let id: string;
  try {
    id = (await retake(await getDb(), viewer.id, attemptId)).id;
  } catch (err) {
    if (err instanceof ExamError) redirect(`/results/${attemptId}?error=${encodeURIComponent(err.message)}`);
    throw err;
  }
  redirect(`/mock/${id}`);
}
