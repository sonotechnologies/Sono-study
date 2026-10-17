import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { BookOpen, ChevronLeft, ChevronRight } from "lucide-react";
import { getDb } from "@/db";
import { enrollments } from "@/db/schema";
import { ExamDateForm } from "@/components/learn/exam-date-form";
import { PlanCard } from "@/components/learn/plan-card";
import { Ring } from "@/components/learn/ring";
import { buttonClass, ButtonLink } from "@/components/ui/primitives";
import { bankSubtitle, classBank, courseBanksView } from "@/lib/banks";
import { cn } from "@/lib/cn";
import { courseSnapshot } from "@/lib/course-dashboard";
import { courseFlashcardCount } from "@/lib/course-data";
import { formatScore } from "@/lib/exam-engine/results";
import { displayCourseCode, timeAgo } from "@/lib/format";
import { getCourseBoard } from "@/lib/leaderboard";
import { MASTERY_COLOR } from "@/lib/mastery";
import { daysUntilExam, examCountdown, readNext } from "@/lib/study-plan";
import { lagosDate } from "@/lib/time";
import { recentUploads } from "@/lib/uploads";
import { requireViewer } from "@/lib/viewer";
import { startPracticeAction } from "../actions";

export const metadata: Metadata = { title: "Course" };

const now = () => new Date();
const BADGE: Record<string, string> = { pdf: "PDF", pptx: "PPT", docx: "DOC", photos: "IMG" };

function SectionTitle({ children, action }: { children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3 pb-1.5">
      <h2 className="font-display text-lg font-bold">{children}</h2>
      {action}
    </div>
  );
}

/** Course page (design 2d): readiness, topics, plan, read next, shared banks, uploads, leaderboard, exam date. */
export default async function CoursePage({ params, searchParams }: { params: Promise<{ courseId: string }>; searchParams: Promise<{ error?: string }> }) {
  const [{ courseId }, { error }] = await Promise.all([params, searchParams]);
  const viewer = await requireViewer();
  const course = viewer.courses.find((c) => c.id === courseId);
  if (!course) notFound();
  const db = await getDb();
  const at = now();
  const [snap, banks, cls, uploads, cards, board, [enrollment]] = await Promise.all([
    courseSnapshot(db, viewer, course, at),
    courseBanksView(db, viewer.id, courseId),
    classBank(db, courseId),
    recentUploads(db, viewer.id, 6, courseId),
    courseFlashcardCount(db, viewer.id, courseId),
    getCourseBoard(db, { courseId, scope: "week", viewer, limit: 2 }),
    db.select({ examTime: enrollments.examTime }).from(enrollments).where(and(eq(enrollments.userId, viewer.id), eq(enrollments.courseId, courseId))),
  ]);
  const code = displayCourseCode(course.code);
  const countdown = examCountdown(course.examDate, at);
  const soon = course.examDate ? daysUntilExam(course.examDate, at) <= 4 : false;
  const weakest = snap.topics.filter((t) => t.questions > 0 && t.mastery !== null && t.label !== "mastered").sort((a, b) => a.mastery! - b.mastery!);
  const reading = await readNext(db, viewer.id, courseId, weakest.slice(0, 3).map((t) => t.id));
  const pct = snap.readiness === null ? null : Math.round(snap.readiness * 100);
  const boardRows = [...board.rows];
  if (board.viewer && !boardRows.some((r) => r.isViewer)) boardRows.push(board.viewer);

  return (
    <main className="mx-auto flex max-w-[960px] flex-col pb-8 lg:px-12 lg:pt-6">
      <div className="flex h-14 items-center gap-1 pl-1 pr-5 lg:-ml-3 lg:pl-0 lg:pr-0">
        <Link href="/courses" className="flex h-12 items-center gap-0.5 rounded-full pr-3 text-sm text-ink-muted hover:text-ink">
          <ChevronLeft size={22} className="text-ink" aria-hidden /> Courses
        </Link>
        <span className="flex-1" />
        {countdown && <span className={cn("text-[13px] font-semibold", soon ? "text-flag" : "text-ink-muted")}>{countdown}</span>}
      </div>

      {error && (
        <p role="alert" className="mx-5 mb-4 rounded-[12px] bg-wrong-soft px-3.5 py-3 text-sm lg:mx-0">
          {error}
        </p>
      )}

      <div className="grid gap-6 px-5 lg:grid-cols-[1fr_360px] lg:gap-10 lg:px-0">
        <div className="flex min-w-0 flex-col gap-6">
          <header className="flex items-center gap-5">
            <Ring value={snap.readiness} size={120} stroke={10} color={snap.label ? MASTERY_COLOR[snap.label] : undefined} label={pct === null ? "No readiness yet" : `${pct}% ready, ${snap.label}`}>
              <span className="font-display text-[28px] font-bold leading-none">{pct === null ? "–" : `${pct}%`}</span>
              <span className="text-xs text-ink-muted">{snap.label ?? "not started"}</span>
            </Ring>
            <div className="flex min-w-0 flex-col gap-1">
              <h1 className="font-display text-[28px] font-bold leading-[1.1] lg:text-[36px]">{code}</h1>
              <span className="text-sm leading-snug text-ink-muted">{course.title}</span>
              {snap.trend !== null && snap.trend !== 0 && (
                <span className={cn("text-[13px] font-semibold", snap.trend > 0 ? "text-spark" : "text-ink-muted")}>
                  {snap.trend > 0 ? "+" : ""}
                  {snap.trend}% this week
                </span>
              )}
            </div>
          </header>

          <section className="flex flex-col gap-2.5" aria-label="Topics">
            <SectionTitle action={snap.topics.length > 0 && <span className="text-[13px] text-ink-muted">Tap to practise</span>}>Topics</SectionTitle>
            {snap.topics.some((t) => t.questions > 0) ? (
              <ul className="flex flex-wrap gap-2">
                {snap.topics
                  .filter((t) => t.questions > 0)
                  .map((t) => (
                    <li key={t.id}>
                      <form action={startPracticeAction.bind(null, courseId, [t.id])}>
                        <button type="submit" className="flex min-h-10 items-center gap-2 rounded-full border border-border bg-surface px-3.5 text-sm hover:border-accent">
                          <span aria-hidden className="size-2 rounded-full" style={{ background: t.label ? MASTERY_COLOR[t.label] : "var(--border)" }} />
                          {t.name}
                          <span className="text-xs font-semibold" style={{ color: t.label ? MASTERY_COLOR[t.label] : "var(--ink-muted)" }}>
                            {t.label ?? "new"}
                          </span>
                        </button>
                      </form>
                    </li>
                  ))}
              </ul>
            ) : (
              <p className="text-[15px] text-ink-muted">No questions yet. Upload your notes and your topics appear here.</p>
            )}
          </section>

          <div className="grid grid-cols-2 gap-2.5">
            <Link href="/cards" className="flex flex-col gap-1 rounded-2xl border border-border bg-surface p-3.5 hover:border-accent">
              <span className="text-[13px] text-ink-muted">Flashcards</span>
              <span className="font-display text-[28px] font-bold leading-tight">{cards}</span>
              <span className="text-[13px] font-semibold text-accent">Review now</span>
            </Link>
            <Link href="/tutor" className="flex flex-col gap-1 rounded-2xl bg-accent-soft p-3.5">
              <span className="text-[13px] text-ink-muted">Tutor</span>
              <span className="text-[15px] font-semibold leading-snug">Ask anything from your {code} notes</span>
              <span className="text-[13px] font-semibold text-accent">Open chat</span>
            </Link>
          </div>

          <ButtonLink href={`/courses/${courseId}/mock`} size="lg">
            Start a mock
          </ButtonLink>

          <PlanCard plan={snap.plan} courseId={courseId} courseCode={code} hasExamDate={!!course.examDate} />

          {reading.length > 0 && (
            <section aria-label="Read next" className="flex flex-col">
              <SectionTitle>Read next</SectionTitle>
              <ul className="flex flex-col divide-y divide-border">
                {reading.map((r) => {
                  const pdf = /^p\./.test(r.label);
                  const href = `/api/uploads/${r.uploadId}/file?n=${r.page ?? 1}${pdf && r.page ? `#page=${r.page}` : ""}`;
                  return (
                    <li key={`${r.topicId}-${r.uploadId}-${r.label}`}>
                      <a href={href} target="_blank" rel="noopener" className="flex min-h-14 items-center gap-3 py-2">
                        <BookOpen size={20} className="flex-none text-ink-muted" aria-hidden />
                        <span className="flex min-w-0 flex-1 flex-col">
                          <span className="truncate text-[15px]">
                            {r.title} · {r.label}
                          </span>
                          <span className="text-[13px] text-ink-muted">For {r.topicName}</span>
                        </span>
                        <ChevronRight size={18} className="text-ink-muted" aria-hidden />
                      </a>
                    </li>
                  );
                })}
              </ul>
            </section>
          )}

          <section aria-label="Shared banks" className="flex flex-col">
            <SectionTitle>Shared banks</SectionTitle>
            {banks.length === 0 && cls.questions === 0 ? (
              <p className="text-[15px] text-ink-muted">No banks for {code} yet. Upload your notes with &ldquo;Share with your class&rdquo; on to start one.</p>
            ) : (
              <ul className="flex flex-col divide-y divide-border">
                {banks.map((b) => (
                  <li key={b.id}>
                    <Link href={`/courses/${courseId}/mock?bank=${b.id}`} className="flex min-h-[60px] items-center gap-3 py-2">
                      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                        <span className="truncate text-[15px] font-semibold">{b.title}</span>
                        <span className="text-[13px] text-ink-muted">
                          {bankSubtitle(b)}
                          {b.isPastPaper ? " · past questions" : ""}
                          {b.mine && !b.isShared ? " · private" : ""}
                        </span>
                      </span>
                      {b.verified ? <span className="text-[13px] font-semibold text-correct">Verified</span> : b.mine ? <span className="text-[13px] text-ink-muted">Yours</span> : null}
                    </Link>
                  </li>
                ))}
                {cls.uploads > 1 && (
                  <li>
                    <Link href={`/courses/${courseId}/mock`} className="flex min-h-[60px] items-center gap-3 py-2">
                      <span className="flex flex-1 flex-col gap-0.5">
                        <span className="text-[15px] font-semibold">{code} class bank</span>
                        <span className="text-[13px] text-ink-muted">
                          {cls.questions} Qs · from {cls.uploads} uploads
                        </span>
                      </span>
                    </Link>
                  </li>
                )}
              </ul>
            )}
          </section>
        </div>

        <aside className="flex min-w-0 flex-col gap-6">
          <section aria-label="My uploads" className="flex flex-col">
            <SectionTitle
              action={
                <Link href={`/upload?course=${courseId}`} className="text-sm font-semibold text-accent">
                  + Upload
                </Link>
              }
            >
              My uploads
            </SectionTitle>
            {uploads.length === 0 ? (
              <p className="text-[15px] text-ink-muted">Turn your notes, slides or past questions into practice questions.</p>
            ) : (
              <ul className="flex flex-col divide-y divide-border">
                {uploads.map((u) => (
                  <li key={u.id}>
                    <Link href={`/upload/${u.id}`} className="flex min-h-14 items-center gap-3 py-2">
                      <span className="grid size-9 flex-none place-items-center rounded-[10px] bg-surface-2 text-[11px] font-bold text-ink-muted">{BADGE[u.type] ?? "FILE"}</span>
                      <span className="flex min-w-0 flex-1 flex-col">
                        <span className="truncate text-[15px]">{u.type === "photos" ? `Notes · ${u.fileCount} photos` : u.title}</span>
                        <span className="text-[13px] text-ink-muted">
                          {u.status === "ready" ? `${u.questionsMade} Qs` : u.status === "failed" ? "Didn't work" : "Making questions…"} · {timeAgo(u.createdAt, at)}
                          {u.visibility === "private" ? " · private" : ""}
                        </span>
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section aria-label="This week's leaderboard" className="flex flex-col gap-2.5 rounded-2xl border border-border bg-surface p-4">
            <SectionTitle
              action={
                <Link href={`/leaderboard?course=${courseId}`} className="text-sm font-semibold text-accent">
                  Full board
                </Link>
              }
            >
              This week
            </SectionTitle>
            {boardRows.length === 0 ? (
              <p className="text-sm text-ink-muted">Nobody&apos;s ranked yet. Finish a 20+ question mock to take the top spot.</p>
            ) : (
              <ol className="flex flex-col gap-1">
                {boardRows.map((r) => (
                  <li key={r.userId} className={cn("flex items-center gap-3 text-sm", r.isViewer ? "-mx-2 rounded-[10px] bg-accent-soft p-2" : "py-1.5")}>
                    <span className={cn("w-6 font-display font-bold", r.isViewer && "text-accent")}>{r.rank}</span>
                    <span className={cn("flex-1 truncate", r.isViewer && "font-semibold")}>{r.isViewer ? `You · ${r.name}` : r.name}</span>
                    <span className="font-display font-bold tabular-nums">
                      {formatScore(r.score)}/{formatScore(r.maxScore)}
                    </span>
                  </li>
                ))}
              </ol>
            )}
          </section>

          <ExamDateForm courseId={courseId} examDate={course.examDate} examTime={enrollment?.examTime ?? null} minDate={lagosDate(at)} />

          <div className="flex flex-wrap gap-2">
            <Link href={`/courses/${courseId}/questions/new`} className={buttonClass("ghost", "sm")}>
              Add a question
            </Link>
          </div>
        </aside>
      </div>
    </main>
  );
}
