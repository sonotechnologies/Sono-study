import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { flashcards, uploads } from "@/db/schema";
import { TopBar } from "@/components/account/top-bar";
import { CardForm } from "@/components/learn/card-form";
import { courseTopics } from "@/lib/course-data";
import { requireViewer } from "@/lib/viewer";

export const metadata: Metadata = { title: "Edit card" };

export default async function EditCardPage({ params }: { params: Promise<{ courseId: string; cardId: string }> }) {
  const { courseId, cardId } = await params;
  const viewer = await requireViewer();
  const db = await getDb();
  const [row] = await db
    .select({ f: flashcards, ownerId: uploads.userId })
    .from(flashcards)
    .leftJoin(uploads, eq(uploads.id, flashcards.sourceUploadId))
    .where(eq(flashcards.id, cardId));
  if (!row || row.f.courseId !== courseId || (row.f.createdById !== viewer.id && row.ownerId !== viewer.id)) notFound();
  const topics = await courseTopics(db, viewer.id, courseId);
  return (
    <main className="mx-auto flex max-w-[640px] flex-col pb-6 lg:pt-6">
      <TopBar back={`/cards/${courseId}`} heading="Edit card" />
      <CardForm courseId={courseId} cardId={cardId} topics={topics.map((t) => ({ id: t.id, name: t.name }))} initial={{ front: row.f.front, back: row.f.back, topicId: row.f.topicId }} />
    </main>
  );
}
