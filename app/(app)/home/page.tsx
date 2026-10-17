import type { Metadata } from "next";
import Link from "next/link";
import { ChevronRight, Flame } from "lucide-react";
import { getDb } from "@/db";
import { PlanCard } from "@/components/learn/plan-card";
import { Ring } from "@/components/learn/ring";
import { InstallPrompt } from "@/components/pwa/install-prompt";
import { buttonClass, ButtonLink, Card, Pill } from "@/components/ui/primitives";
import { cn } from "@/lib/cn";
import { courseSnapshot } from "@/lib/course-dashboard";
import { courseTopics } from "@/lib/course-data";
import { inProgressAttempt } from "@/lib/exam-engine/service";
import { displayCourseCode, formatClock } from "@/lib/format";
import { getCourseBoard } from "@/lib/leaderboard";
import { MASTERY_COLOR } from "@/lib/mastery";
import { daysUntilExam, readiness, readinessLabel } from "@/lib/study-plan";
import { recentUploads } from "@/lib/uploads";
import { requireViewer } from "@/lib/viewer";
import { fixWeakTopicsAction } from "../courses/actions";

export const metadata: Metadata = { title: "Home" };

const now = () => new Date();
const WEEKDAY = new Intl.DateTimeFormat("en-NG", { weekday: "short", timeZone: "UTC" });

function greeting(at: Date) {
  const hour = (at.getUTCHours() + 1) % 24; // Lagos
  return hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
}

function secondsBetween(from: Date, to: Date) {
  return Math.max(0, Math.round((to.getTime() - from.getTime()) / 1000));
}

/** "Next exam · Mon 9:00", "Next exam · tomorrow", or the focus course when no date is set. */
function examLine(examDate: string | null, examTime: string | null, at: Date) {
  if (!examDate) return "Your focus course";
  const d = daysUntilExam(examDate, at);
  const when = d === 0 ? "today" : d === 1 ? "tomorrow" : d < 7 ? WEEKDAY.format(new Date(`${examDate}T00:00:00Z`)) : `in ${d} days`;
  return `Next exam · ${when}${examTime && d < 7 ? ` ${examTime.replace(/^0/, "")}` : ""}`;
}

/**
 * Home (design 1e "Readiness ring", with 1d's Today's plan below the fold; desktop 4b
 * puts them side by side). The focus course is the next exam, or the first course.
 */
export default async function HomePage() {
  const viewer = await requireViewer();
  const at = now();
  const first = (viewer.name ?? viewer.handle ?? "there").split(" ")[0];
  const db = await getDb();
  const upcoming = viewer.courses.filter((c) => c.examDate && daysUntilExam(c.examDate, at) >= 0);
  const focus = upcoming[0] ?? viewer.courses[0];

  const [snap, running, [latest], others, board] = await Promise.all([
    focus ? courseSnapshot(db, viewer, focus, at) : null,
    inProgressAttempt(db, viewer.id),
    recentUploads(db, viewer.id, 1),
    Promise.all(
      viewer.courses.map(async (c) => {
        const score = readiness(await courseTopics(db, viewer.id, c.id));
        return { ...c, score, label: score === null ? null : readinessLabel(score) };
      }),
    ),
    focus ? getCourseBoard(db, { courseId: focus.id, scope: "week", viewer, limit: 1 }) : null,
  ]);
  const runningCourse = running ? viewer.courses.find((c) => c.id === running.courseId) : null;
  const runningLeft = running?.endsAt ? secondsBetween(at, running.endsAt) : null;
  // The upload a student walked away from: still cooking, or finished in the last day.
  const upload =
    latest && (latest.status !== "ready" && latest.status !== "failed" ? true : latest.completedAt && secondsBetween(latest.completedAt, at) < 86_400) ? latest : null;
  const weak = snap ? snap.topics.filter((t) => t.label === "weak" || t.label === "shaky") : [];
  const sortedCourses = [...others].sort((a, b) => (a.score ?? 2) - (b.score ?? 2));
  const pct = snap?.readiness == null ? null : Math.round(snap.readiness * 100);
  const code = focus ? displayCourseCode(focus.code) : "";

  return (
    <main className="flex flex-col gap-4 px-5 pt-3 pb-6 lg:gap-7 lg:px-12 lg:py-10">
      <header className="flex items-center justify-between gap-4">
        <h1 className="font-display text-lg font-bold lg:text-[40px]">
          <span className="lg:hidden">Hey {first}</span>
          <span className="hidden lg:inline">
            {greeting(at)}, {first}
          </span>
        </h1>
        <div className="flex gap-2.5">
          <Pill className="h-8 gap-1.5 px-2.5 text-sm font-bold text-spark lg:h-10 lg:px-3.5 lg:text-base">
            <Flame size={16} strokeWidth={1.75} aria-hidden />
            {viewer.streakDays}
            <span className="font-normal text-ink-muted lg:hidden">· {viewer.xp.toLocaleString("en-NG")} XP</span>
          </Pill>
          <Pill className="hidden lg:inline-flex">{viewer.xp.toLocaleString("en-NG")} XP</Pill>
        </div>
      </header>

      {running && (
        <section aria-label="Continue mock" className="flex items-center gap-4 rounded-2xl bg-accent-soft p-4 lg:p-5">
          <div className="flex flex-1 flex-col gap-0.5">
            <span className="font-display text-lg font-bold">Continue {running.mode === "challenge" ? "challenge" : running.mode === "practice" ? "practice" : "mock"}</span>
            <span className="text-sm text-ink-muted">
              {runningCourse ? displayCourseCode(runningCourse.code) : ""} · Q{running.currentIndex + 1} of {running.questionIds.length}
              {runningLeft !== null && ` · ${formatClock(runningLeft)} left`}
            </span>
          </div>
          <ButtonLink href={`/mock/${running.id}`}>Resume</ButtonLink>
        </section>
      )}

      {upload && (
        <Link href={`/upload/${upload.id}`} className="flex items-center gap-4 rounded-2xl border border-border bg-surface p-4 hover:border-accent lg:p-5">
          <span className="flex min-w-0 flex-1 flex-col gap-0.5">
            <span className="font-display text-lg font-bold">
              {upload.status === "ready" ? `${upload.questionsMade} new questions ready` : upload.status === "failed" ? "Your upload didn't work" : "Cooking your questions…"}
            </span>
            <span className="truncate text-sm text-ink-muted">
              {displayCourseCode(upload.courseCode)} · {upload.title}
            </span>
          </span>
          <ChevronRight size={20} className="text-ink-muted" aria-hidden />
        </Link>
      )}

      {focus && snap && (
        <div className="grid gap-4 lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)] lg:gap-6">
          <section aria-label={`${code} readiness`} className="flex flex-col items-center gap-3 rounded-2xl border border-border bg-surface p-4 lg:p-6">
            <Link href={`/courses/${focus.id}`} className="flex flex-col items-center gap-0.5">
              <span className="text-[13px] text-ink-muted">{examLine(focus.examDate, focus.examTime, at)}</span>
              <span className="font-display text-[22px] font-bold">{code}</span>
            </Link>
            <Ring value={snap.readiness} size={140} stroke={12} label={pct === null ? "No readiness yet" : `${pct}% ready, ${snap.label}`}>
              <span className="font-display text-[36px] font-bold leading-none">{pct === null ? "–" : `${pct}%`}</span>
              <span className="text-[13px] text-ink-muted">{snap.label ? `ready · ${snap.label}` : "take a mock"}</span>
            </Ring>
            {snap.trend !== null && snap.trend !== 0 && (
              <span className={cn("text-[13px] font-semibold", snap.trend > 0 ? "text-spark" : "text-ink-muted")}>
                {snap.trend > 0 ? "+" : ""}
                {snap.trend}% this week
              </span>
            )}
            <ButtonLink href={`/courses/${focus.id}/mock?count=30`} size="lg" className="w-full">
              Start 30-question mock
            </ButtonLink>
            {weak.length > 0 ? (
              <form action={fixWeakTopicsAction.bind(null, focus.id)} className="w-full">
                <button type="submit" className={buttonClass("secondary", "md", "w-full")}>
                  Fix {Math.min(3, weak.length)} weak topic{Math.min(3, weak.length) === 1 ? "" : "s"}
                </button>
              </form>
            ) : (
              <ButtonLink href={`/courses/${focus.id}`} variant="secondary" className="w-full">
                Practise a topic
              </ButtonLink>
            )}
          </section>
          <div className="flex flex-col gap-4">
            <div className="flex gap-2">
              <Link href={`/cards/${focus.id}`} className="flex flex-1 items-center justify-between rounded-[12px] border border-border bg-surface p-3 hover:border-accent">
                <span className="text-sm">Cards due</span>
                <span className="font-display font-bold">{snap.cards.total}</span>
              </Link>
              <a href="#plan" className="flex flex-1 items-center justify-between rounded-[12px] border border-border bg-surface p-3 hover:border-accent">
                <span className="text-sm">Plan</span>
                <span className="font-display font-bold">
                  {snap.plan.doneCount}/{snap.plan.items.length}
                </span>
              </a>
            </div>
            <div id="plan" className="scroll-mt-4">
              <PlanCard plan={snap.plan} courseId={focus.id} courseCode={code} hasExamDate={!!focus.examDate} />
            </div>
          </div>
        </div>
      )}

      <InstallPrompt />

      <div className="grid gap-4 lg:grid-cols-2 lg:gap-6">
        {sortedCourses.length > 0 && (
          <section aria-label="Your courses" className="flex flex-col">
            <h2 className="pb-1.5 text-[13px] text-ink-muted">Your courses</h2>
            <ul className="flex flex-col">
              {sortedCourses.map((c) => (
                <li key={c.id}>
                  <Link href={`/courses/${c.id}`} className="flex min-h-11 items-center gap-3 py-1">
                    <Ring value={c.score} size={28} stroke={4} color={c.label ? MASTERY_COLOR[c.label] : undefined} />
                    <span className="flex-1 text-[15px]">{displayCourseCode(c.code)}</span>
                    <span className="text-[13px]" style={{ color: c.label ? MASTERY_COLOR[c.label] : "var(--ink-muted)" }}>
                      {c.score === null ? "not started" : `${Math.round(c.score * 100)}% · ${c.label}`}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}
        {focus && (
          <Link href={`/leaderboard?course=${focus.id}`}>
            <Card className="flex items-center gap-4 p-5 hover:border-accent">
              <div className="flex flex-1 flex-col gap-1">
                <span className="text-[13px] text-ink-muted">{code} · this week</span>
                <span className="font-display text-[22px] font-bold">{board?.viewer ? `You're #${board.viewer.rank} of ${board.total}` : "Not on the board yet"}</span>
                <span className="text-sm text-ink-muted">{board?.viewer ? "Beat your best to climb before Sunday's reset." : "Finish a 20+ question mock to get ranked."}</span>
              </div>
              <ChevronRight className="text-ink-muted" aria-hidden />
            </Card>
          </Link>
        )}
      </div>
    </main>
  );
}
