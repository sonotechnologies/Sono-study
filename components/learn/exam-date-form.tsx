"use client";

import { useActionState } from "react";
import { ChevronDown } from "lucide-react";
import {
  setExamDateAction,
  type ExamDateState,
} from "@/app/(app)/courses/[courseId]/actions";
import { buttonClass } from "@/components/ui/primitives";
import { formatDate } from "@/lib/format";

const INPUT =
  "h-12 w-full min-w-0 appearance-none rounded-[12px] border border-transparent bg-surface-2 px-3.5 text-base text-ink outline-none focus:border-accent";

/**
 * Exam date + optional start time for one course (paces the study plan). A one-line row
 * ("Exam date · 20 Oct, 9:00 · Change") that opens the form; open already when no date is set.
 */
export function ExamDateForm({
  courseId,
  examDate,
  examTime,
  minDate,
}: {
  courseId: string;
  examDate: string | null;
  examTime: string | null;
  minDate: string;
}) {
  const [state, action, pending] = useActionState<ExamDateState, FormData>(
    setExamDateAction.bind(null, courseId),
    { error: null, saved: false },
  );
  const when = examDate
    ? `${formatDate(new Date(`${examDate}T12:00:00Z`), { year: false })}${examTime ? `, ${examTime.replace(/^0/, "")}` : ""}`
    : null;
  return (
    <details
      id="exam-date"
      open={!examDate}
      className="group scroll-mt-20 rounded-2xl border border-border bg-surface"
    >
      <summary className="flex min-h-14 cursor-pointer list-none items-center gap-3 px-4 [&::-webkit-details-marker]:hidden">
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="font-display text-base font-bold">Exam date</span>
          <span className="text-[13px] text-ink-muted">
            {when ?? "Not set: sets the countdown and paces your plan"}
          </span>
        </span>
        <span className="text-sm font-semibold text-accent group-open:hidden">
          {when ? "Change" : "Set"}
        </span>
        <ChevronDown
          size={18}
          className="hidden text-ink-muted group-open:block group-open:rotate-180"
          aria-hidden
        />
      </summary>
      <form action={action} className="flex flex-col gap-3 px-4 pb-4">
        <div className="grid grid-cols-[3fr_2fr] gap-2">
          <label className="flex min-w-0 flex-col gap-1 text-[13px] text-ink-muted">
            Date
            <input
              type="date"
              name="examDate"
              min={minDate}
              defaultValue={examDate ?? ""}
              className={INPUT}
            />
          </label>
          <label className="flex min-w-0 flex-col gap-1 text-[13px] text-ink-muted">
            Time (optional)
            <input
              type="time"
              name="examTime"
              defaultValue={examTime ?? ""}
              className={INPUT}
            />
          </label>
        </div>
        {state.error && (
          <p role="alert" className="text-sm text-wrong">
            {state.error}
          </p>
        )}
        <button
          type="submit"
          disabled={pending}
          className={buttonClass("secondary", "md")}
        >
          {pending ? "Saving…" : state.saved ? "Saved" : "Save exam date"}
        </button>
      </form>
    </details>
  );
}
