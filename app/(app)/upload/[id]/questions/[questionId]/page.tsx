import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getDb } from "@/db";
import { TopBar } from "@/components/account/top-bar";
import { QuestionForm } from "@/components/exam/question-form";
import { courseTopics } from "@/lib/course-data";
import { uploadQuestions } from "@/lib/uploads";
import { requireViewer } from "@/lib/viewer";

export const metadata: Metadata = { title: "Edit question" };

export default async function EditQuestionPage({ params }: { params: Promise<{ id: string; questionId: string }> }) {
  const { id, questionId } = await params;
  const viewer = await requireViewer();
  const db = await getDb();
  const data = await uploadQuestions(db, viewer.id, id);
  const q = data?.editable ? data.questions.find((x) => x.id === questionId) : null;
  if (!data || !q || q.type === "theory") notFound();
  const a = q.answer;
  const initial = {
    courseId: q.courseId,
    type: q.type,
    topic: q.topic ?? "",
    stem: q.stem,
    options: q.options.map((o) => o.text),
    correct: a.kind === "single" ? [q.options.findIndex((o) => o.id === a.correct)] : a.kind === "multiple" ? a.correct.map((c) => q.options.findIndex((o) => o.id === c)) : [],
    trueFalse: a.kind === "true_false" ? a.correct : null,
    accepted: a.kind === "fill_in" ? a.accepted : [],
    explanation: q.explanation ?? "",
    difficulty: ([1, 2, 3].includes(q.difficulty) ? q.difficulty : 2) as 1 | 2 | 3,
    share: q.visibility === "shared",
  };
  const topics = await courseTopics(db, viewer.id, q.courseId);
  return (
    <main className="mx-auto flex max-w-[720px] flex-col pb-6 lg:pt-6">
      <TopBar back={`/upload/${id}/questions`} heading="Edit question" />
      <QuestionForm courseId={q.courseId} topics={topics.map((t) => t.name)} initial={initial} questionId={q.id} doneHref={`/upload/${id}/questions`} />
    </main>
  );
}
