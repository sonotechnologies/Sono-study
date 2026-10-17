import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getDb } from "@/db";
import { TopBar } from "@/components/account/top-bar";
import { CardForm } from "@/components/learn/card-form";
import { courseTopics } from "@/lib/course-data";
import { displayCourseCode } from "@/lib/format";
import { requireViewer } from "@/lib/viewer";

export const metadata: Metadata = { title: "Add a card" };

export default async function NewCardPage({ params }: { params: Promise<{ courseId: string }> }) {
  const { courseId } = await params;
  const viewer = await requireViewer();
  const course = viewer.courses.find((c) => c.id === courseId);
  if (!course) notFound();
  const topics = await courseTopics(await getDb(), viewer.id, courseId);
  return (
    <main className="mx-auto flex max-w-[640px] flex-col pb-6 lg:pt-6">
      <TopBar back={`/cards/${courseId}`} heading={`Add a card · ${displayCourseCode(course.code)}`} />
      <CardForm courseId={courseId} cardId={null} topics={topics.map((t) => ({ id: t.id, name: t.name }))} />
    </main>
  );
}
