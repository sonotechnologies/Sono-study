import { and, asc, count, eq, ne, or } from "drizzle-orm";
import type { Db } from "@/db";
import { banks, questions, topicMastery, topics } from "@/db/schema";
import { masteryLabel, type MasteryLabel } from "./mastery";

export type CourseTopic = { id: string; name: string; questions: number; mastery: number | null; label: MasteryLabel | null };

/** A course's topics with how many questions each has and this student's mastery. */
export async function courseTopics(db: Db, userId: string, courseId: string): Promise<CourseTopic[]> {
  const rows = await db
    .select({ id: topics.id, name: topics.name, mastery: topicMastery.masteryScore, questions: count(questions.id) })
    .from(topics)
    .leftJoin(topicMastery, and(eq(topicMastery.topicId, topics.id), eq(topicMastery.userId, userId)))
    .leftJoin(questions, and(eq(questions.topicId, topics.id), eq(questions.status, "active"), ne(questions.type, "theory")))
    .where(eq(topics.courseId, courseId))
    .groupBy(topics.id, topicMastery.masteryScore)
    .orderBy(asc(topics.name));
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    questions: Number(r.questions),
    mastery: r.mastery,
    label: r.mastery === null ? null : masteryLabel(r.mastery),
  }));
}

export async function courseBanks(db: Db, userId: string, courseId: string) {
  return db
    .select({ id: banks.id, title: banks.title, questionIds: banks.questionIds, attempts: banks.attempts, isShared: banks.isShared })
    .from(banks)
    .where(and(eq(banks.courseId, courseId), or(eq(banks.isShared, true), eq(banks.ownerId, userId))))
    .orderBy(asc(banks.title));
}
