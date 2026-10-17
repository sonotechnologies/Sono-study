import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { attemptAnswers, courses } from "@/db/schema";
import { ExamRuntime } from "@/components/exam/runtime";
import { PracticeRuntime } from "@/components/exam/practice";
import { correctOptionIds } from "@/lib/exam-engine/rules";
import { buildPayload, getAttemptFor } from "@/lib/exam-engine/service";
import { getViewerId } from "@/lib/viewer";

export const metadata: Metadata = { title: "Mock" };

/** The exam screen: full screen, no tab bar or banners (brief: "during a mock, only exam UI"). */
export default async function MockPage({ params }: { params: Promise<{ attemptId: string }> }) {
  const { attemptId } = await params;
  const userId = await getViewerId();
  if (!userId) redirect("/login");
  const db = await getDb();
  const a = await getAttemptFor(db, userId, attemptId);
  if (!a) notFound();
  if (a.status !== "in_progress") redirect(`/results/${a.id}`);
  const [course] = await db.select({ code: courses.code }).from(courses).where(eq(courses.id, a.courseId));
  const payload = await buildPayload(db, a, course.code);

  if (a.mode === "practice") {
    // Questions already checked in this session come back with their feedback.
    const answered = await db.select().from(attemptAnswers).where(eq(attemptAnswers.attemptId, a.id));
    const initial = Object.fromEntries(
      answered
        .map((x) => {
          const q = a.snapshot.find((s) => s.id === x.questionId);
          if (!q || !x.answer) return null;
          return [
            q.id,
            {
              response: x.answer,
              feedback: {
                isCorrect: !!x.isCorrect,
                correctOptionIds: correctOptionIds(q.answer),
                accepted: q.answer.kind === "fill_in" ? q.answer.accepted : [],
                explanation: q.explanation,
                sourceLabel: q.sourceLabel,
              },
            },
          ] as const;
        })
        .filter((e): e is NonNullable<typeof e> => e !== null),
    );
    const topicNames = [...new Set(a.snapshot.map((q) => q.topicName).filter(Boolean))];
    const label = topicNames.length === 1 ? topicNames[0]! : topicNames.length <= 3 ? topicNames.join(", ") : "Mixed topics";
    return <PracticeRuntime payload={{ ...payload, exitUrl: `/courses/${a.courseId}` }} topicLabel={label} initial={initial} tutorHref={`/tutor/${a.courseId}`} />;
  }
  return <ExamRuntime payload={payload} />;
}
