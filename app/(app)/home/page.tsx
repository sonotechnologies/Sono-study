import type { Metadata } from "next";
import Link from "next/link";
import { ChevronRight, Flame } from "lucide-react";
import { getDb } from "@/db";
import { InstallPrompt } from "@/components/pwa/install-prompt";
import { Card, Pill } from "@/components/ui/primitives";
import { displayCourseCode } from "@/lib/format";
import { getCourseBoard } from "@/lib/leaderboard";
import { inProgressAttempt } from "@/lib/exam-engine/service";
import { formatClock } from "@/lib/format";
import { ButtonLink } from "@/components/ui/primitives";
import { requireViewer } from "@/lib/viewer";

export const metadata: Metadata = { title: "Home" };

function greeting(now = new Date()) {
  const hour = (now.getUTCHours() + 1) % 24; // Lagos
  return hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
}

function secondsUntil(d: Date) {
  return Math.max(0, Math.round((d.getTime() - Date.now()) / 1000));
}

function daysUntil(date: string) {
  const ms = new Date(`${date}T00:00:00+01:00`).getTime() - Date.now();
  return Math.max(0, Math.ceil(ms / 86_400_000));
}

/** Interim Home: greeting, streak/XP and the student's standing. The full dashboard lands with the exam engine. */
export default async function HomePage() {
  const viewer = await requireViewer();
  const first = (viewer.name ?? viewer.handle ?? "there").split(" ")[0];
  const course = viewer.courses[0];
  const db = await getDb();
  const [board, running] = await Promise.all([
    course ? getCourseBoard(db, { courseId: course.id, scope: "week", viewer, limit: 1 }) : null,
    inProgressAttempt(db, viewer.id),
  ]);
  const runningCourse = running ? viewer.courses.find((c) => c.id === running.courseId) : null;
  const runningLeft = running?.endsAt ? secondsUntil(running.endsAt) : null;
  const exams = viewer.courses.filter((c) => c.examDate);

  return (
    <main className="flex flex-col gap-4 px-5 pt-3 pb-6 lg:gap-7 lg:px-12 lg:py-10">
      <header className="flex items-center justify-between gap-4">
        <h1 className="font-display text-[22px] font-bold lg:text-[40px]">
          <span className="lg:hidden">Hey {first}</span>
          <span className="hidden lg:inline">
            {greeting()}, {first}
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
            <span className="font-display text-lg font-bold">Continue {running.mode === "challenge" ? "challenge" : "mock"}</span>
            <span className="text-sm text-ink-muted">
              {runningCourse ? displayCourseCode(runningCourse.code) : ""} · Q{running.currentIndex + 1} of {running.questionIds.length}
              {runningLeft !== null && ` · ${formatClock(runningLeft)} left`}
            </span>
          </div>
          <ButtonLink href={`/mock/${running.id}`}>Resume</ButtonLink>
        </section>
      )}

      {!running && course && (
        <div className="flex flex-col gap-2 lg:flex-row">
          <ButtonLink href={`/courses/${course.id}/mock`} size="lg" className="lg:w-auto">
            Start a {displayCourseCode(course.code)} mock
          </ButtonLink>
          <ButtonLink href="/courses" variant="secondary" size="lg" className="lg:w-auto">
            Practise a topic
          </ButtonLink>
        </div>
      )}

      <InstallPrompt />

      <div className="grid gap-3 lg:grid-cols-2 lg:gap-6">
        {course && (
          <Link href={`/leaderboard?course=${course.id}`}>
            <Card className="flex items-center gap-4 p-5 hover:border-accent">
              <div className="flex flex-1 flex-col gap-1">
                <span className="text-[13px] text-ink-muted">{displayCourseCode(course.code)} · this week</span>
                <span className="font-display text-[22px] font-bold">
                  {board?.viewer ? `You're #${board.viewer.rank} of ${board.total}` : "Not on the board yet"}
                </span>
                <span className="text-sm text-ink-muted">
                  {board?.viewer ? "Beat your best to climb before Sunday's reset." : "Finish a 20+ question mock to get ranked."}
                </span>
              </div>
              <ChevronRight className="text-ink-muted" aria-hidden />
            </Card>
          </Link>
        )}
        <Card className="flex flex-col gap-3 p-5">
          <h2 className="font-display text-lg font-bold">Upcoming exams</h2>
          {exams.length === 0 ? (
            <p className="text-sm text-ink-muted">Add exam dates to get countdowns and a daily plan.</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {exams.map((c) => {
                const days = daysUntil(c.examDate!);
                return (
                  <li key={c.id} className="flex items-center justify-between text-[15px]">
                    <span>{displayCourseCode(c.code)}</span>
                    <span className={days <= 4 ? "font-semibold text-flag" : "text-ink-muted"}>
                      {days === 0 ? "Today" : `${days} day${days === 1 ? "" : "s"}`}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
      </div>
    </main>
  );
}
