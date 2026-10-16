import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Check, ChevronRight, Minus, X } from "lucide-react";
import { getDb } from "@/db";
import { retakeAction, startPracticeAction } from "@/app/(app)/courses/actions";
import { ScoreCountUp } from "@/components/exam/score-count-up";
import { ShareResultButton } from "@/components/exam/share-result-button";
import { TopBar } from "@/components/account/top-bar";
import { buttonClass, Card } from "@/components/ui/primitives";
import { cn } from "@/lib/cn";
import { getAttemptFor, getResult } from "@/lib/exam-engine/service";
import { formatScore, resultLine, topicsToFix } from "@/lib/exam-engine/results";
import { displayCourseCode, formatClock } from "@/lib/format";
import { MASTERY_COLOR } from "@/lib/mastery";
import { requireViewer } from "@/lib/viewer";

export const metadata: Metadata = { title: "Results" };

const MODE_LABEL = { mock: "Mock results", practice: "Practice results", challenge: "Challenge results" } as const;

export default async function ResultsPage({ params, searchParams }: { params: Promise<{ attemptId: string }>; searchParams: Promise<{ error?: string }> }) {
  const { attemptId } = await params;
  const { error } = await searchParams;
  const viewer = await requireViewer();
  const db = await getDb();
  const r = await getResult(db, viewer.id, attemptId);
  if (!r) {
    const a = await getAttemptFor(db, viewer.id, attemptId);
    if (a?.status === "in_progress") redirect(`/mock/${a.id}`);
    notFound();
  }
  const a = r.attempt;
  const score = a.score ?? 0;
  const max = a.maxScore ?? r.items.length;
  const fix = topicsToFix(r.topics);
  const newBest = a.mode === "mock" && r.prevBest !== null && score > r.prevBest;
  const line = resultLine({ score, max, prevBest: a.mode === "mock" ? r.prevBest : null, weakTopics: fix.length });
  const missed = r.items.filter((i) => !i.isCorrect);
  const code = displayCourseCode(r.courseCode);
  const pct = max ? Math.round((score / max) * 100) : 0;

  const tiles = newBest
    ? [
        ["Streak", `${viewer.streakDays} day${viewer.streakDays === 1 ? "" : "s"}`, true],
        ["Earned", `+${a.xpEarned ?? 0} XP`, true],
        ["Time", formatClock(r.timeSec), false],
      ]
    : [
        ["Time", formatClock(r.timeSec), false],
        ["Score", `${pct}%`, false],
        ["Earned", `+${a.xpEarned ?? 0} XP`, true],
      ];

  return (
    <main className="flex flex-col pb-6 lg:grid lg:grid-cols-2 lg:items-start lg:gap-8 lg:px-12 lg:py-10">
      <div className="flex flex-col gap-4 px-5 lg:gap-6 lg:px-0">
        <div className="lg:hidden">
          <TopBar back="/home" title={`${code} · ${MODE_LABEL[a.mode]}`} />
        </div>
        <span className="hidden text-[15px] text-ink-muted lg:block">
          {code} · {MODE_LABEL[a.mode]}
        </span>
        {newBest && (
          <span className="relative self-start rounded-full border-[1.5px] border-spark px-3 py-1 font-display text-[13px] font-bold tracking-[0.04em] text-spark">
            NEW BEST
            <span aria-hidden className="absolute -right-3 -top-2 size-2 rotate-45 bg-spark motion-safe:animate-[spark-burst_250ms_ease-out_both]" />
            <span aria-hidden className="absolute -right-5 top-3 size-1.5 rotate-45 bg-accent motion-safe:animate-[spark-burst_250ms_ease-out_80ms_both]" />
            <span aria-hidden className="absolute -left-3 -bottom-1 size-1.5 rotate-45 bg-spark motion-safe:animate-[spark-burst_250ms_ease-out_160ms_both]" />
          </span>
        )}
        <div className="flex items-baseline gap-1.5 lg:gap-2">
          <ScoreCountUp value={score} className="font-display text-[56px] font-bold leading-none tracking-[-0.03em] lg:text-[96px]" />
          <span className="font-display text-[28px] font-semibold text-ink-muted lg:text-[40px]">/{formatScore(max)}</span>
        </div>
        <p className="text-base leading-normal lg:text-xl">{line}</p>
        {a.submitReason === "timeout" && <p className="text-sm text-ink-muted">Time ran out, so your answers were submitted automatically.</p>}
        {error && (
          <p role="alert" className="text-sm text-wrong">
            {error}
          </p>
        )}
        <div className="grid grid-cols-3 gap-2 lg:gap-3">
          {tiles.map(([label, value, spark]) => (
            <Card key={String(label)} className="flex flex-col gap-0.5 rounded-[12px] px-3 py-2.5 lg:gap-1 lg:px-4 lg:py-3.5">
              <span className="text-xs text-ink-muted lg:text-[13px]">{label}</span>
              <span className={cn("font-display text-base font-bold lg:text-xl", spark && "text-spark")}>{value}</span>
            </Card>
          ))}
        </div>

        {fix.length > 0 && (
          <section aria-label="Topics to fix first" className="flex flex-col gap-2">
            <h2 className="font-display text-lg font-bold">
              {fix.length} topic{fix.length === 1 ? "" : "s"} to fix first
            </h2>
            {fix.map((t) => (
              <Card key={t.topicId ?? t.name} className="flex items-center gap-3 p-4">
                <span aria-hidden className="size-2.5 flex-none rounded-full" style={{ background: MASTERY_COLOR[t.label] }} />
                <div className="flex flex-1 flex-col">
                  <span className="text-[15px] font-semibold">{t.name}</span>
                  <span className="text-[13px]" style={{ color: MASTERY_COLOR[t.label] }}>
                    {t.correct}/{t.total} · {t.label}
                  </span>
                </div>
                {t.topicId && (
                  <form action={startPracticeAction.bind(null, a.courseId, [t.topicId])}>
                    <button type="submit" className="min-h-11 px-1 text-sm font-semibold text-accent">
                      Practise 10
                    </button>
                  </form>
                )}
              </Card>
            ))}
          </section>
        )}

        <div className="grid grid-cols-[1fr_2fr] gap-2 lg:flex lg:gap-2.5">
          {newBest ? (
            <>
              <Link href={`/results/${a.id}/review/1`} className={buttonClass("secondary", "lg", "lg:order-2")}>
                Review
              </Link>
              <ShareResultButton attemptId={a.id} text={`New best on ${code}: ${formatScore(score)}/${formatScore(max)} on Sono Study.`} className={buttonClass("primary", "lg", "lg:order-1")}>
                Share to Status
              </ShareResultButton>
            </>
          ) : (
            <>
              {a.mode !== "challenge" ? (
                <form action={retakeAction.bind(null, a.id)} className="contents">
                  <button type="submit" className={buttonClass("secondary", "lg", "lg:order-2")}>
                    Retake
                  </button>
                </form>
              ) : (
                <Link href={`/leaderboard?course=${a.courseId}`} className={buttonClass("secondary", "lg", "lg:order-2")}>
                  Leaderboard
                </Link>
              )}
              <Link
                href={`/results/${a.id}/review/${missed.length ? missed[0].index + 1 : 1}`}
                className={buttonClass("primary", "lg", "lg:order-1")}
              >
                {missed.length ? `Review ${missed.length} missed` : "Review answers"}
              </Link>
            </>
          )}
        </div>
      </div>

      <div className="mt-6 flex flex-col gap-6 px-5 lg:mt-0 lg:px-0">
        <Card className="flex flex-col gap-4 bg-transparent p-0 border-0 lg:border lg:bg-surface lg:p-7">
          <h2 className="font-display text-lg font-bold lg:text-xl">By topic</h2>
          <ul className="flex flex-col gap-3.5">
            {r.topics.map((t) => (
              <li key={t.topicId ?? t.name} className="flex flex-col gap-2">
                <div className="flex justify-between gap-3 text-sm lg:text-[15px]">
                  <span>{t.name}</span>
                  <span className="font-semibold" style={{ color: MASTERY_COLOR[t.label] }}>
                    {t.correct}/{t.total} · {t.label}
                  </span>
                </div>
                <div className="h-1.5 rounded-full bg-surface-2 lg:h-2" aria-hidden>
                  <div className="h-full rounded-full" style={{ width: `${(t.correct / t.total) * 100}%`, background: MASTERY_COLOR[t.label] }} />
                </div>
              </li>
            ))}
          </ul>
          <div className="hidden flex-col gap-2.5 border-t border-border pt-[18px] lg:flex">
            <span className="text-[13px] text-ink-muted">Answer map · click to review</span>
            <ol className="grid grid-cols-[repeat(15,1fr)] gap-1">
              {r.items.map((i) => (
                <li key={i.question.id}>
                  <Link
                    href={`/results/${a.id}/review/${i.index + 1}`}
                    aria-label={`Question ${i.index + 1}: ${i.isCorrect ? "correct" : i.answered ? "wrong" : "skipped"}`}
                    className={cn("block h-6 rounded-md", i.isCorrect ? "bg-correct" : i.answered ? "bg-wrong" : "bg-surface-2")}
                  />
                </li>
              ))}
            </ol>
          </div>
        </Card>

        <section aria-label="All questions" className="lg:hidden">
          <h2 className="pb-1.5 text-[13px] text-ink-muted">All questions</h2>
          <ol>
            {r.items.map((i) => (
              <li key={i.question.id} className="border-b border-border last:border-0">
                <Link href={`/results/${a.id}/review/${i.index + 1}`} className="flex min-h-12 items-center gap-3">
                  <span
                    aria-label={i.isCorrect ? "Correct" : i.answered ? "Wrong" : "Skipped"}
                    className={cn(
                      "grid size-6 flex-none place-items-center rounded-full",
                      i.isCorrect ? "bg-correct text-bg" : i.answered ? "bg-wrong text-bg" : "bg-surface-2 text-ink-muted",
                    )}
                  >
                    {i.isCorrect ? <Check size={14} strokeWidth={3} /> : i.answered ? <X size={14} strokeWidth={3} /> : <Minus size={14} strokeWidth={3} />}
                  </span>
                  <span className="flex-1 truncate text-sm">
                    {i.index + 1}. {i.question.stem}
                  </span>
                  <ChevronRight size={18} className="flex-none text-ink-muted" aria-hidden />
                </Link>
              </li>
            ))}
          </ol>
        </section>
      </div>
    </main>
  );
}
