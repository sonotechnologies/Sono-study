"use server";

import { getDb } from "@/db";
import { askTutor, TutorError, type QuickAction, type TutorReply } from "@/lib/tutor";
import { getUsage } from "@/lib/usage";
import { requireViewer } from "@/lib/viewer";

export type AskResult = { ok: true; reply: TutorReply; remaining: number } | { ok: false; error: string; code: TutorError["code"] };

export async function askTutorAction(courseId: string, input: { text?: string; action?: QuickAction }): Promise<AskResult> {
  const viewer = await requireViewer();
  if (!viewer.courses.some((c) => c.id === courseId)) return { ok: false, error: "Add this course first.", code: "invalid" };
  const db = await getDb();
  try {
    const reply = await askTutor(db, viewer, courseId, input);
    const usage = await getUsage(db, viewer.id, "tutor_message", viewer.effectivePlan);
    return { ok: true, reply, remaining: usage.remaining };
  } catch (err) {
    if (err instanceof TutorError) return { ok: false, error: err.message, code: err.code };
    throw err;
  }
}
