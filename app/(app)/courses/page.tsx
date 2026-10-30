import type { Metadata } from "next";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { getDb } from "@/db";
import { Ring } from "@/components/learn/ring";
import { cn } from "@/lib/cn";
import { courseTopics } from "@/lib/course-data";
import { displayCourseCode } from "@/lib/format";
import { MASTERY_COLOR } from "@/lib/mastery";
import { daysUntilExam, examCountdown, readiness, readinessLabel } from "@/lib/study-plan";
import { requireViewer } from "@/lib/viewer";

export const metadata: Metadata = { title: "Courses" };

const now = () => new Date();

/** Course list: readiness and exam countdown per course; each opens the course page (2d). */
export default async function CoursesPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  const viewer = await requireViewer();
  const db = await getDb();
  const at = now();
  const rows = await Promise.all(
    viewer.courses.map(async (c) => {
      const topics = await courseTopics(db, viewer.id, c.id);
      const score = readiness(topics);
      return { ...c, score, label: score === null ? null : readinessLabel(score), questions: topics.reduce((s, t) => s + t.questions, 0) };
    }),
  );

  return (
    <main className="mx-auto flex max-w-[960px] flex-col gap-5 px-5 pt-4 pb-6 lg:gap-7 lg:px-12 lg:py-10">
      <header className="flex items-end justify-between gap-4">
        <h1 className="font-display text-[22px] font-bold lg:text-[32px]">Your courses</h1>
        <Link href="/onboarding?edit=1&step=3" className="text-sm font-semibold text-accent">
          Edit courses
        </Link>
      </header>
      {error && (
        <p role="alert" className="rounded-2xl border border-border bg-surface p-4 text-[15px] text-wrong">
          {error}
        </p>
      )}
      <ul className="flex flex-col divide-y divide-border rounded-2xl border border-border bg-surface">
        {rows.map((c) => {
          const countdown = examCountdown(c.examDate, at);
          const soon = c.examDate ? daysUntilExam(c.examDate, at) <= 4 : false;
          const pct = c.score === null ? null : Math.round(c.score * 100);
          return (
            <li key={c.id}>
              <Link href={`/courses/${c.id}`} className="flex min-h-[72px] items-center gap-4 px-4 py-3 hover:bg-surface-2 lg:px-5">
                <Ring value={c.score} size={44} stroke={5} color={c.label ? MASTERY_COLOR[c.label] : undefined} />
                <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className="font-display text-lg font-bold">{displayCourseCode(c.code)}</span>
                  <span className="truncate text-[13px] text-ink-muted">{c.title}</span>
                </span>
                <span className="flex flex-col items-end gap-0.5 text-right">
                  <span className="text-[13px]" style={{ color: c.label ? MASTERY_COLOR[c.label] : "var(--ink-muted)" }}>
                    {pct === null ? (c.questions ? "not started" : "no questions yet") : `${pct}% · ${c.label}`}
                  </span>
                  {countdown && <span className={cn("text-[13px]", soon ? "font-semibold text-flag" : "text-ink-muted")}>{countdown}</span>}
                </span>
                <ChevronRight size={20} className="text-ink-muted" aria-hidden />
              </Link>
            </li>
          );
        })}
      </ul>
    </main>
  );
}
