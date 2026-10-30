import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getDb } from "@/db";
import { TutorChat } from "@/components/learn/tutor-chat";
import { courseTopics } from "@/lib/course-data";
import { displayCourseCode } from "@/lib/format";
import { tutorHistory, tutorSources } from "@/lib/tutor";
import { getUsage } from "@/lib/usage";
import { requireViewer } from "@/lib/viewer";

export const metadata: Metadata = { title: "Tutor" };

export default async function TutorPage({ params }: { params: Promise<{ courseId: string }> }) {
  const { courseId } = await params;
  const viewer = await requireViewer();
  const course = viewer.courses.find((c) => c.id === courseId);
  if (!course) notFound();
  const db = await getDb();
  const [history, sources, usage, topics] = await Promise.all([
    tutorHistory(db, viewer.id, courseId),
    tutorSources(db, viewer.id, courseId),
    getUsage(db, viewer.id, "tutor_message", viewer.effectivePlan),
    courseTopics(db, viewer.id, courseId),
  ]);
  // Example prompts from the student's weakest topics (design 2m shows three).
  const names = [...topics].sort((a, b) => (a.mastery ?? 0) - (b.mastery ?? 0)).map((t) => t.name);
  const examples = names.length >= 3 ? [`Explain ${names[0]} simply`, `Summarise ${names[1]} in 5 points`, `Quiz me on ${names[2]}`] : ["Summarise my notes in 5 points", "What are the key terms I should know?", "Quiz me on my notes"];
  return (
    <main className="mx-auto flex h-[calc(100dvh-64px-env(safe-area-inset-bottom))] w-full max-w-[720px] flex-col lg:h-dvh lg:pt-6">
      <TutorChat
        courseId={courseId}
        courseCode={displayCourseCode(course.code)}
        sources={sources}
        examples={examples}
        initial={history.map((m) => ({ id: m.id, role: m.role, content: m.content, citations: m.citations }))}
        remaining={usage.remaining}
        limit={usage.limit}
      />
    </main>
  );
}
