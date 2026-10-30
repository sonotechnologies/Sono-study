"use server";

import { revalidatePath } from "next/cache";
import { getDb } from "@/db";
import { checkRateLimit, RateLimitError, requestIp } from "@/lib/rate-limit";
import { gradeAnswer, TheoryError, type GradeResult } from "@/lib/theory";
import { getUsage } from "@/lib/usage";
import { requireViewer } from "@/lib/viewer";

export type GradeActionResult = ({ ok: true; remaining: number } & GradeResult) | { ok: false; error: string; code: TheoryError["code"] };

export async function gradeAnswerAction(questionId: string, answer: string): Promise<GradeActionResult> {
  const viewer = await requireViewer();
  const db = await getDb();
  try {
    await checkRateLimit(db, "ai", { userId: viewer.id, ip: await requestIp() });
    const res = await gradeAnswer(db, viewer, questionId, answer);
    const usage = await getUsage(db, viewer.id, "theory_grading", viewer.effectivePlan);
    revalidatePath(`/theory/${questionId}`);
    return { ok: true, remaining: usage.remaining, ...res };
  } catch (err) {
    if (err instanceof TheoryError) return { ok: false, error: err.message, code: err.code };
    if (err instanceof RateLimitError) return { ok: false, error: err.message, code: "busy" };
    throw err;
  }
}
