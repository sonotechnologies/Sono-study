import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronRight } from "lucide-react";
import { getDb } from "@/db";
import { TopBar } from "@/components/account/top-bar";
import { formatScore } from "@/lib/exam-engine/results";
import { displayCourseCode } from "@/lib/format";
import { theoryQuestions } from "@/lib/theory";
import { getUsage } from "@/lib/usage";
import { requireViewer } from "@/lib/viewer";

export const metadata: Metadata = { title: "Theory practice" };

export default async function TheoryListPage({ params }: { params: Promise<{ courseId: string }> }) {
  const { courseId } = await params;
  const viewer = await requireViewer();
  const course = viewer.courses.find((c) => c.id === courseId);
  if (!course) notFound();
  const db = await getDb();
  const [list, usage] = await Promise.all([theoryQuestions(db, viewer.id, courseId), getUsage(db, viewer.id, "theory_grading", viewer.effectivePlan)]);
  const code = displayCourseCode(course.code);
  return (
    <main className="mx-auto flex max-w-[720px] flex-col pb-6 lg:pt-6">
      <TopBar back={`/courses/${courseId}`} heading={`Theory · ${code}`} />
      <p className="px-5 pb-4 text-sm leading-normal text-ink-muted lg:px-0">
        Write your answer like in the exam hall; it&apos;s marked against a marking guide and you see what you covered and missed. {usage.remaining} of {usage.limit} gradings left today.
      </p>
      {list.length === 0 ? (
        <p className="px-5 text-[15px] text-ink-muted lg:px-0">No theory questions for {code} yet. Uploading your notes adds some.</p>
      ) : (
        <ol className="mx-5 flex flex-col divide-y divide-border rounded-2xl border border-border bg-surface lg:mx-0">
          {list.map((q, i) => (
            <li key={q.id}>
              <Link href={`/theory/${q.id}`} className="flex min-h-16 items-center gap-3 px-4 py-3">
                <span className="w-6 flex-none font-display text-sm font-bold text-ink-muted">{i + 1}</span>
                <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className="line-clamp-2 text-[15px] leading-snug">{q.stem}</span>
                  <span className="text-[13px] text-ink-muted">
                    {q.topic ? `${q.topic} · ` : ""}
                    {q.marks} marks
                  </span>
                </span>
                {q.last?.score != null && (
                  <span className="font-display text-sm font-bold">
                    {formatScore(q.last.score)}/{formatScore(q.last.maxScore ?? q.marks)}
                  </span>
                )}
                <ChevronRight size={18} className="text-ink-muted" aria-hidden />
              </Link>
            </li>
          ))}
        </ol>
      )}
    </main>
  );
}
