import type { Db } from "@/db";
import { courseTopics, type CourseTopic } from "./course-data";
import { dueCounts, reviewedToday, type DueCounts } from "./flashcards";
import type { MasteryLabel } from "./mastery";
import { PLANS, type PlanName } from "./plans";
import { dailyPlan, readiness, readinessLabel, todayActivity, trackReadiness, type DailyPlan } from "./study-plan";

export type CourseSnapshot = {
  id: string;
  code: string;
  title: string;
  examDate: string | null;
  topics: CourseTopic[];
  /** 0–1, null until the course has questions. */
  readiness: number | null;
  label: MasteryLabel | null;
  /** Percentage points since a week ago. */
  trend: number | null;
  plan: DailyPlan;
  cards: DueCounts;
};

/** Readiness, trend and today's plan for one course (Home and the course page). */
export async function courseSnapshot(
  db: Db,
  viewer: { id: string; effectivePlan: PlanName },
  course: { id: string; code: string; title: string; examDate: string | null },
  now = new Date(),
): Promise<CourseSnapshot> {
  const [topics, activity, cards, reviewed] = await Promise.all([
    courseTopics(db, viewer.id, course.id),
    todayActivity(db, viewer.id, course.id, now),
    dueCounts(db, viewer.id, course.id, now),
    reviewedToday(db, viewer.id, course.id, now),
  ]);
  const score = readiness(topics);
  const trend = score === null ? null : await trackReadiness(db, viewer.id, course.id, score, now);
  return {
    ...course,
    topics,
    readiness: score,
    label: score === null ? null : readinessLabel(score),
    trend,
    plan: dailyPlan({ topics, examDate: course.examDate, tier: PLANS[viewer.effectivePlan].studyPlan, activity, cards: { due: cards.total, reviewedToday: reviewed }, now }),
    cards,
  };
}
