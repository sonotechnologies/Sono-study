"use client";

import { useActionState } from "react";
import { setExamDateAction, type ExamDateState } from "@/app/(app)/courses/[courseId]/actions";
import { buttonClass } from "@/components/ui/primitives";

const INPUT = "h-12 w-full min-w-0 appearance-none rounded-[12px] border border-transparent bg-surface-2 px-3.5 text-base text-ink outline-none focus:border-accent";

/** Exam date + optional start time for one course (paces the study plan). */
export function ExamDateForm({ courseId, examDate, examTime, minDate }: { courseId: string; examDate: string | null; examTime: string | null; minDate: string }) {
  const [state, action, pending] = useActionState<ExamDateState, FormData>(setExamDateAction.bind(null, courseId), { error: null, saved: false });
  return (
    <form action={action} id="exam-date" className="flex scroll-mt-20 flex-col gap-3 rounded-2xl border border-border bg-surface p-4">
      <div className="flex flex-col gap-0.5">
        <span className="font-display text-lg font-bold">Exam date</span>
        <span className="text-[13px] text-ink-muted">Sets the countdown and paces your plan. Leave it empty if you don&apos;t know yet.</span>
      </div>
      <div className="grid grid-cols-[3fr_2fr] gap-2">
        <label className="flex min-w-0 flex-col gap-1 text-[13px] text-ink-muted">
          Date
          <input type="date" name="examDate" min={minDate} defaultValue={examDate ?? ""} className={INPUT} />
        </label>
        <label className="flex min-w-0 flex-col gap-1 text-[13px] text-ink-muted">
          Time (optional)
          <input type="time" name="examTime" defaultValue={examTime ?? ""} className={INPUT} />
        </label>
      </div>
      {state.error && (
        <p role="alert" className="text-sm text-wrong">
          {state.error}
        </p>
      )}
      <button type="submit" disabled={pending} className={buttonClass("secondary", "md")}>
        {pending ? "Saving…" : state.saved ? "Saved" : "Save exam date"}
      </button>
    </form>
  );
}
