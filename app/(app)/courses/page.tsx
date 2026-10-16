import type { Metadata } from "next";
import Link from "next/link";
import { getDb } from "@/db";
import { buttonClass, Card } from "@/components/ui/primitives";
import { courseTopics } from "@/lib/course-data";
import { displayCourseCode } from "@/lib/format";
import { MASTERY_COLOR } from "@/lib/mastery";
import { requireViewer } from "@/lib/viewer";
import { fixWeakTopicsAction } from "./actions";

export const metadata: Metadata = { title: "Courses" };

function daysUntil(date: string) {
  return Math.max(0, Math.ceil((new Date(`${date}T00:00:00+01:00`).getTime() - Date.now()) / 86_400_000));
}

/** Interim course list: each course's mock, practice and topics. The full course page (2d) comes with shared banks. */
export default async function CoursesPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  const viewer = await requireViewer();
  const db = await getDb();
  const withTopics = await Promise.all(viewer.courses.map(async (c) => ({ ...c, topics: await courseTopics(db, viewer.id, c.id) })));

  return (
    <main className="flex flex-col gap-5 px-5 pt-4 pb-6 lg:gap-7 lg:px-12 lg:py-10">
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
      <div className="grid gap-4 lg:grid-cols-2 lg:gap-6">
        {withTopics.map((c) => {
          const total = c.topics.reduce((s, t) => s + t.questions, 0);
          const tried = c.topics.filter((t) => t.label);
          return (
            <Card key={c.id} className="flex flex-col gap-4 p-5">
              <div className="flex items-start justify-between gap-3">
                <div className="flex flex-col gap-0.5">
                  <h2 className="font-display text-[22px] font-bold">{displayCourseCode(c.code)}</h2>
                  <span className="text-sm text-ink-muted">{c.title}</span>
                </div>
                {c.examDate && (
                  <span className={daysUntil(c.examDate) <= 4 ? "text-sm font-semibold text-flag" : "text-sm text-ink-muted"}>
                    Exam in {daysUntil(c.examDate)} day{daysUntil(c.examDate) === 1 ? "" : "s"}
                  </span>
                )}
              </div>
              {c.topics.length > 0 ? (
                <ul className="flex flex-wrap gap-2" aria-label="Topics">
                  {c.topics.map((t) => (
                    <li key={t.id} className="flex h-8 items-center gap-1.5 rounded-full border border-border px-3 text-[13px]">
                      <span aria-hidden className="size-2 rounded-full" style={{ background: t.label ? MASTERY_COLOR[t.label] : "var(--border)" }} />
                      {t.name}
                      <span className="text-ink-muted">· {t.label ?? "new"}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-ink-muted">No questions yet. Upload your notes, or add a question to get started.</p>
              )}
              <div className="flex flex-wrap gap-2">
                {total > 0 && (
                  <Link href={`/courses/${c.id}/mock`} className={buttonClass("primary", "md")}>
                    Start a mock
                  </Link>
                )}
                {total > 0 && (
                  <form action={fixWeakTopicsAction.bind(null, c.id)}>
                    <button type="submit" className={buttonClass("secondary", "md")}>
                      {tried.length ? "Fix weak topics" : "Practise"}
                    </button>
                  </form>
                )}
                <Link href={`/leaderboard?course=${c.id}`} className={buttonClass("ghost", "md")}>
                  Leaderboard
                </Link>
                <Link href={`/courses/${c.id}/questions/new`} className={buttonClass("ghost", "md")}>
                  Add a question
                </Link>
              </div>
            </Card>
          );
        })}
      </div>
    </main>
  );
}
