import { eq, inArray } from "drizzle-orm";
import { getDb } from "@/db";
import * as s from "@/db/schema";
import { getViewerId } from "@/lib/viewer";

/** "Export my data": everything stored about the signed-in student, as one JSON file. */
export async function GET() {
  const userId = await getViewerId();
  if (!userId) return new Response("Sign in first", { status: 401 });
  const db = await getDb();
  const [user] = await db.select().from(s.users).where(eq(s.users.id, userId));
  if (!user) return new Response("Not found", { status: 404 });

  const attempts = await db.select().from(s.mockAttempts).where(eq(s.mockAttempts.userId, userId));
  const [enrollments, uploads, answers, mastery, reviews, tutor, theory, entries, signups, payments, usage] = await Promise.all([
    db.select().from(s.enrollments).where(eq(s.enrollments.userId, userId)),
    db
      .select({ id: s.uploads.id, courseId: s.uploads.courseId, type: s.uploads.type, status: s.uploads.status, pageCount: s.uploads.pageCount, visibility: s.uploads.visibility, createdAt: s.uploads.createdAt })
      .from(s.uploads)
      .where(eq(s.uploads.userId, userId)),
    attempts.length
      ? db.select().from(s.attemptAnswers).where(inArray(s.attemptAnswers.attemptId, attempts.map((a) => a.id)))
      : Promise.resolve([]),
    db.select().from(s.topicMastery).where(eq(s.topicMastery.userId, userId)),
    db.select().from(s.cardReviews).where(eq(s.cardReviews.userId, userId)),
    db.select().from(s.tutorMessages).where(eq(s.tutorMessages.userId, userId)),
    db.select().from(s.theoryAttempts).where(eq(s.theoryAttempts.userId, userId)),
    db.select().from(s.leaderboardEntries).where(eq(s.leaderboardEntries.userId, userId)),
    db.select().from(s.challengeSignups).where(eq(s.challengeSignups.userId, userId)),
    db.select().from(s.payments).where(eq(s.payments.userId, userId)),
    db.select().from(s.aiUsage).where(eq(s.aiUsage.userId, userId)),
  ]);

  const body = {
    exportedAt: new Date().toISOString(),
    profile: user,
    enrollments,
    uploads,
    mockAttempts: attempts,
    attemptAnswers: answers,
    topicMastery: mastery,
    flashcardReviews: reviews,
    tutorMessages: tutor,
    theoryAttempts: theory,
    leaderboardEntries: entries,
    challengeSignups: signups,
    payments,
    dailyUsage: usage,
  };
  return new Response(JSON.stringify(body, null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="sono-study-export-${new Date().toISOString().slice(0, 10)}.json"`,
      "Cache-Control": "no-store",
    },
  });
}
