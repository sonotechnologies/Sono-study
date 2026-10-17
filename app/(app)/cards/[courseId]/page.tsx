import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getDb } from "@/db";
import { CardSession } from "@/components/learn/card-session";
import { dueCounts, dueQueue } from "@/lib/flashcards";
import { displayCourseCode } from "@/lib/format";
import { requireViewer } from "@/lib/viewer";

export const metadata: Metadata = { title: "Flashcards" };
export const dynamic = "force-dynamic";

export default async function CardStudyPage({ params }: { params: Promise<{ courseId: string }> }) {
  const { courseId } = await params;
  const viewer = await requireViewer();
  const course = viewer.courses.find((c) => c.id === courseId);
  if (!course) notFound();
  const db = await getDb();
  const [cards, due] = await Promise.all([dueQueue(db, viewer.id, courseId, 20), dueCounts(db, viewer.id, courseId)]);
  return (
    <main className="mx-auto flex min-h-[calc(100dvh-64px)] w-full max-w-[640px] flex-col lg:min-h-dvh lg:pt-6">
      {/* key: a fresh session (e.g. "Practise the Again cards") remounts with the new queue */}
      <CardSession key={cards.map((c) => c.id).join(",")} courseId={courseId} courseCode={displayCourseCode(course.code)} cards={cards} dueTotal={due.total} />
    </main>
  );
}
