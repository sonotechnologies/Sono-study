import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getDb } from "@/db";
import { TopBar } from "@/components/account/top-bar";
import { QuestionForm } from "@/components/exam/question-form";
import { courseTopics } from "@/lib/course-data";
import { displayCourseCode } from "@/lib/format";
import { requireViewer } from "@/lib/viewer";

export const metadata: Metadata = { title: "Add a question" };

export default async function NewQuestionPage({ params }: { params: Promise<{ courseId: string }> }) {
  const { courseId } = await params;
  const viewer = await requireViewer();
  const course = viewer.courses.find((c) => c.id === courseId);
  if (!course) notFound();
  const topics = await courseTopics(await getDb(), viewer.id, courseId);
  return (
    <main className="mx-auto flex max-w-[720px] flex-col pb-6 lg:pt-6">
      <TopBar back="/courses" heading={`Add a question · ${displayCourseCode(course.code)}`} />
      <QuestionForm courseId={courseId} topics={topics.map((t) => t.name)} />
    </main>
  );
}
