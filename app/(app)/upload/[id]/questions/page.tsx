import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Check, Pencil } from "lucide-react";
import { getDb } from "@/db";
import { TopBar } from "@/components/account/top-bar";
import { eq } from "drizzle-orm";
import { courses } from "@/db/schema";
import { ReportButton } from "@/components/learn/report-button";
import { RemoveQuestionButton } from "@/components/upload/remove-question";
import { SharingToggle } from "@/components/upload/sharing-toggle";
import { displayCourseCode } from "@/lib/format";
import type { AnswerKey, QuestionOption } from "@/lib/exam-engine/types";
import { uploadQuestions } from "@/lib/uploads";
import { requireViewer } from "@/lib/viewer";

export const metadata: Metadata = { title: "Review questions" };

const TYPE: Record<string, string> = { single: "One answer", multiple: "Several answers", true_false: "True/false", fill_in: "Fill in", theory: "Theory" };

function answerText(answer: AnswerKey, options: QuestionOption[]): string {
  const text = (id: string) => options.find((o) => o.id === id)?.text ?? id;
  switch (answer.kind) {
    case "single":
      return text(answer.correct);
    case "multiple":
      return answer.correct.map(text).join(" · ");
    case "true_false":
      return answer.correct ? "True" : "False";
    case "fill_in":
      return answer.accepted.join(" / ");
    case "theory":
      return answer.modelAnswer;
  }
}

export default async function ReviewQuestionsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const viewer = await requireViewer();
  const db = await getDb();
  const data = await uploadQuestions(db, viewer.id, id);
  if (!data) notFound();
  const { questions, editable } = data;
  const [course] = await db.select({ code: courses.code }).from(courses).where(eq(courses.id, data.upload.courseId));
  const courseCode = displayCourseCode(course?.code ?? "");
  return (
    <main className="mx-auto flex max-w-[720px] flex-col pb-6 lg:pt-6">
      <TopBar back={`/upload/${id}`} heading={`Review · ${questions.length} questions`} />
      {editable && (
        <div className="px-5 pb-4 lg:px-0">
          <SharingToggle uploadId={id} initial={data.upload.visibility === "contribute"} courseCode={courseCode} />
        </div>
      )}
      <p className="px-5 pb-3 text-sm leading-normal text-ink-muted lg:px-0">
        {editable
          ? "AI wrote these from your notes. Fix anything that's wrong, or delete it, before your classmates see it."
          : "These came from a classmate's identical upload and are already in the course bank. Spot a mistake? Report it."}
      </p>
      <ol className="flex flex-col gap-3 px-5 lg:px-0">
        {questions.map((q, i) => (
          <li key={q.id} className="flex flex-col gap-2.5 rounded-2xl border border-border bg-surface p-4">
            <div className="flex items-start gap-2">
              <span className="flex-1 text-[13px] text-ink-muted">
                {i + 1} · {TYPE[q.type] ?? q.type}
                {q.topic ? ` · ${q.topic}` : ""}
                {q.isPastQuestion ? " · past question" : ""}
                {q.visibility === "private" ? " · private" : ""}
              </span>
              {editable && (
                <span className="-mr-2 -mt-2 flex items-center">
                  <Link href={q.type === "theory" ? `/theory/${q.id}` : `/upload/${id}/questions/${q.id}`} aria-label={`Edit question ${i + 1}`} className="grid size-11 place-items-center rounded-full text-ink-muted hover:bg-surface-2">
                    <Pencil size={18} aria-hidden />
                  </Link>
                  <RemoveQuestionButton questionId={q.id} n={i + 1} />
                </span>
              )}
              {!editable && <ReportButton questionId={q.id} className="-mr-1 -mt-3" />}
            </div>
            <p className="text-[15px] leading-relaxed">{q.stem}</p>
            {q.options.length > 0 && (
              <ul className="flex flex-col gap-1 text-sm text-ink-muted">
                {q.options.map((o, j) => (
                  <li key={o.id}>
                    {String.fromCharCode(65 + j)}. {o.text}
                  </li>
                ))}
              </ul>
            )}
            <p className="flex items-start gap-1.5 text-sm">
              <Check size={16} className="mt-0.5 flex-none text-correct" aria-hidden />
              <span>{answerText(q.answer, q.options)}</span>
            </p>
            {q.explanation && <p className="text-[13px] leading-normal text-ink-muted">{q.explanation}</p>}
            {q.sourceLabel && <p className="text-xs text-ink-muted">{q.sourceLabel}</p>}
          </li>
        ))}
      </ol>
    </main>
  );
}
