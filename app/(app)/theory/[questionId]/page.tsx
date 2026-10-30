import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getDb } from "@/db";
import { TopBar } from "@/components/account/top-bar";
import { TheoryAnswer } from "@/components/learn/theory-answer";
import { displayCourseCode } from "@/lib/format";
import { getTheoryQuestion, nextTheoryQuestion, theoryHistory, theoryQuestions } from "@/lib/theory";
import { getUsage } from "@/lib/usage";
import { requireViewer } from "@/lib/viewer";

export const metadata: Metadata = { title: "Theory" };

/** Theory grading (design 2o): question with marks, the student's answer, the marking. */
export default async function TheoryQuestionPage({ params }: { params: Promise<{ questionId: string }> }) {
  const { questionId } = await params;
  const viewer = await requireViewer();
  const db = await getDb();
  const row = await getTheoryQuestion(db, viewer.id, questionId);
  if (!row || !viewer.courses.some((c) => c.id === row.q.courseId)) notFound();
  const courseId = row.q.courseId;
  const [list, history, usage, next] = await Promise.all([
    theoryQuestions(db, viewer.id, courseId),
    theoryHistory(db, viewer.id, questionId),
    getUsage(db, viewer.id, "theory_grading", viewer.effectivePlan),
    nextTheoryQuestion(db, viewer.id, courseId, questionId),
  ]);
  const index = list.findIndex((q) => q.id === questionId);
  const marks = row.q.rubric?.reduce((s, p) => s + p.marks, 0) ?? list[index]?.marks ?? 10;
  const last = history[0];
  const modelAnswer = row.q.answer.kind === "theory" && row.q.answer.modelAnswer ? row.q.answer.modelAnswer : null;
  return (
    <main className="mx-auto flex max-w-[720px] flex-col pb-6 lg:pt-6">
      <div className="flex items-center pr-5 lg:pr-0">
        <div className="flex-1">
          <TopBar back={`/courses/${courseId}/theory`} heading={`Theory · ${displayCourseCode(row.code)}`} />
        </div>
        {index >= 0 && (
          <span className="text-[13px] text-ink-muted">
            Q{index + 1} of {list.length}
          </span>
        )}
      </div>
      <div className="flex flex-col gap-4 px-5 lg:px-0">
        <section className="flex flex-col gap-2 rounded-2xl border border-border bg-surface p-4">
          <span className="text-[13px] font-semibold text-accent">
            {marks} marks{row.topic ? ` · ${row.topic}` : ""}
          </span>
          <h1 className="text-[17px] leading-relaxed">{row.q.stem}</h1>
        </section>
        <TheoryAnswer
          key={last?.id ?? "new"}
          questionId={questionId}
          nextHref={next ? `/theory/${next}` : null}
          remaining={usage.remaining}
          limit={usage.limit}
          modelAnswer={modelAnswer}
          initial={
            last && last.score != null && last.feedback
              ? { answer: last.answerText, score: last.score, maxScore: last.maxScore ?? marks, feedback: last.feedback, source: row.q.sourceLabel }
              : null
          }
        />
      </div>
    </main>
  );
}
