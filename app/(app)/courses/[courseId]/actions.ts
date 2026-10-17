"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { getDb } from "@/db";
import { enrollments } from "@/db/schema";
import { requireViewer } from "@/lib/viewer";

export type ExamDateState = { error: string | null; saved: boolean };

/** Exam date (and optional start time) for one course: drives the countdown and the study plan's pace. */
export async function setExamDateAction(courseId: string, _prev: ExamDateState, form: FormData): Promise<ExamDateState> {
  const viewer = await requireViewer();
  if (!viewer.courses.some((c) => c.id === courseId)) return { error: "Add this course first.", saved: false };
  const date = String(form.get("examDate") ?? "").trim();
  const time = String(form.get("examTime") ?? "").trim();
  if (date && !/^\d{4}-\d{2}-\d{2}$/.test(date)) return { error: "Pick a date.", saved: false };
  if (time && !/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) return { error: "Pick a time, like 09:00.", saved: false };
  const db = await getDb();
  await db
    .update(enrollments)
    .set({ examDate: date || null, examTime: date && time ? time : null })
    .where(and(eq(enrollments.userId, viewer.id), eq(enrollments.courseId, courseId)));
  revalidatePath("/", "layout");
  return { error: null, saved: true };
}
