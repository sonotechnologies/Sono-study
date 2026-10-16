import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getDb } from "@/db";
import { MockSetup } from "@/components/exam/setup";
import { TopBar } from "@/components/account/top-bar";
import { demoMode } from "@/lib/auth";
import { courseBanks, courseTopics } from "@/lib/course-data";
import { displayCourseCode } from "@/lib/format";
import { requireViewer } from "@/lib/viewer";

export const metadata: Metadata = { title: "New mock" };

export default async function MockSetupPage({ params, searchParams }: { params: Promise<{ courseId: string }>; searchParams: Promise<{ quick?: string }> }) {
  const { courseId } = await params;
  const { quick } = await searchParams;
  const viewer = await requireViewer();
  const course = viewer.courses.find((c) => c.id === courseId);
  if (!course) notFound();
  const db = await getDb();
  const [topics, banks] = await Promise.all([courseTopics(db, viewer.id, courseId), courseBanks(db, viewer.id, courseId)]);
  const code = displayCourseCode(course.code);

  return (
    <main className="mx-auto flex min-h-[calc(100dvh-64px)] max-w-[720px] flex-col lg:min-h-dvh lg:pt-6">
      <TopBar back="/courses" heading={`New mock · ${code}`} />
      <MockSetup
        courseId={courseId}
        courseCode={code}
        topics={topics.filter((t) => t.questions > 0)}
        banks={banks.map((b) => ({ id: b.id, title: b.title, questions: b.questionIds.length, attempts: b.attempts }))}
        // Demo mode only: a 1-minute option for trying the auto-submit.
        quickTimer={demoMode && quick === "1"}
      />
    </main>
  );
}
