import Link from "next/link";
import { Check, Lock } from "lucide-react";
import { startPlanPracticeAction } from "@/app/(app)/courses/actions";
import { cn } from "@/lib/cn";
import type { DailyPlan, PlanItem } from "@/lib/study-plan";

const WEEKDAY = new Intl.DateTimeFormat("en-NG", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" });

function StartLink({ item, courseId }: { item: PlanItem; courseId: string }) {
  const cls = "flex h-11 items-center px-1 text-[13px] font-semibold text-accent";
  if (item.kind === "mock") {
    return (
      <Link href={`/courses/${courseId}/mock?count=${item.count}`} className={cls}>
        Start
      </Link>
    );
  }
  if (item.kind === "upload") {
    return (
      <Link href={`/upload?course=${courseId}`} className={cls}>
        Start
      </Link>
    );
  }
  return (
    <form action={startPlanPracticeAction.bind(null, courseId, item.topicId!, item.count)}>
      <button type="submit" className={cls}>
        Start
      </button>
    </form>
  );
}

/** Design 1d "Today's plan": done items struck through, the next one gets "Start". */
export function PlanCard({
  plan,
  courseId,
  courseCode,
  hasExamDate,
  className,
}: {
  plan: DailyPlan;
  courseId: string;
  courseCode: string;
  hasExamDate: boolean;
  className?: string;
}) {
  const total = plan.items.length;
  return (
    <section aria-label={`Today's plan for ${courseCode}`} className={cn("flex flex-col gap-3 rounded-2xl border border-border bg-surface p-4 lg:p-5", className)}>
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="font-display text-lg font-bold">Today&apos;s plan</h2>
        <span className="text-[13px] text-ink-muted">
          {plan.doneCount} of {total} done
        </span>
      </div>
      <div className="h-1.5 rounded-full bg-surface-2" role="progressbar" aria-valuemin={0} aria-valuemax={total} aria-valuenow={plan.doneCount} aria-label="Plan progress">
        <div className="h-full rounded-full bg-spark" style={{ width: `${total ? (plan.doneCount / total) * 100 : 0}%` }} />
      </div>
      <ul className="flex flex-col">
        {plan.items.map((item) => {
          const isNext = plan.next?.id === item.id;
          return (
            <li key={item.id} className="flex min-h-11 items-center gap-3">
              {item.done ? (
                <span className="grid size-[22px] flex-none place-items-center rounded-full bg-correct">
                  <Check size={14} strokeWidth={3} className="text-bg" aria-hidden />
                </span>
              ) : (
                <span className={cn("size-[22px] flex-none rounded-full border-2", isNext ? "border-accent" : "border-border")} aria-hidden />
              )}
              <span className={cn("flex-1 text-[15px]", item.done && "text-ink-muted line-through")}>
                {item.label}
                <span className="sr-only">{item.done ? " (done)" : ""}</span>
                {!item.done && item.progress > 0 && item.kind !== "mock" && (
                  <span className="text-[13px] text-ink-muted"> · {Math.round(item.progress * item.count)} so far</span>
                )}
              </span>
              {isNext && <StartLink item={item} courseId={courseId} />}
            </li>
          );
        })}
      </ul>
      {plan.lockedItems > 0 && (
        <Link href="?paywall=1" scroll={false} className="flex min-h-11 items-center gap-2 text-[13px] text-ink-muted">
          <Lock size={14} aria-hidden />
          <span>
            {plan.lockedItems} more step{plan.lockedItems === 1 ? "" : "s"} and a day-by-day plan to your exam with{" "}
            <span className="font-semibold text-accent">Pro</span>
          </span>
        </Link>
      )}
      {!hasExamDate && (
        <Link href={`/courses/${courseId}#exam-date`} className="text-[13px] font-semibold text-accent">
          Set your {courseCode} exam date to pace the plan
        </Link>
      )}
      {plan.week.length > 0 && (
        <details className="group border-t border-border pt-3">
          <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between text-[15px] font-semibold">
            Until your exam
            <span className="text-[13px] font-normal text-ink-muted group-open:hidden">Show</span>
          </summary>
          <ol className="flex flex-col gap-2 pt-1">
            {plan.week.map((d) => (
              <li key={d.date} className="flex gap-3 text-sm">
                <span className="w-[86px] flex-none text-ink-muted">{WEEKDAY.format(new Date(`${d.date}T00:00:00Z`))}</span>
                <span>{d.label}</span>
              </li>
            ))}
          </ol>
        </details>
      )}
    </section>
  );
}
