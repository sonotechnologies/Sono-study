import { and, asc, count, eq, gte, inArray, isNotNull, lte, ne, sql } from "drizzle-orm";
import type { Db } from "@/db";
import { attemptAnswers, mockAttempts, questions, readinessSnapshots, topics, uploads } from "@/db/schema";
import type { CourseTopic } from "./course-data";
import { masteryLabel, type MasteryLabel } from "./mastery";
import { addDays, lagosDate } from "./time";

/**
 * Study plan and readiness (brief §5). Readiness is mastery across the course's
 * topics, weighted by how much of the bank each topic is (capped, so one huge
 * topic can't dominate); topics never practised count as 0. The daily plan picks
 * the weakest topics and sizes the work by days to the exam. Free plans get the
 * basic plan (two items); Pro gets the full plan, a week ahead and per-topic detail.
 */

const TOPIC_WEIGHT_CAP = 30;
const MIN_TOPIC_QUESTIONS = 3;

export function readiness(topicList: Pick<CourseTopic, "questions" | "mastery">[]): number | null {
  const usable = topicList.filter((t) => t.questions >= MIN_TOPIC_QUESTIONS);
  // Nothing practised yet: "not started", not "0% · weak".
  if (!usable.length || usable.every((t) => t.mastery === null)) return null;
  let total = 0;
  let got = 0;
  for (const t of usable) {
    const w = Math.min(t.questions, TOPIC_WEIGHT_CAP);
    total += w;
    got += w * (t.mastery ?? 0);
  }
  return Math.round((got / total) * 1000) / 1000;
}

export function readinessLabel(score: number): MasteryLabel {
  return masteryLabel(score);
}

/** Whole Lagos days from today to the exam date (0 = today). */
export function daysUntilExam(examDate: string, now = new Date()): number {
  const today = Date.parse(`${lagosDate(now)}T00:00:00Z`);
  return Math.round((Date.parse(`${examDate}T00:00:00Z`) - today) / 86_400_000);
}

export function examCountdown(examDate: string | null, now = new Date()): string | null {
  if (!examDate) return null;
  const d = daysUntilExam(examDate, now);
  if (d < 0) return null;
  if (d === 0) return "Exam today";
  if (d === 1) return "Exam tomorrow";
  return `Exam in ${d} days`;
}

/** Saves today's readiness and returns the change against a week ago (or the oldest day this week). */
export async function trackReadiness(db: Db, userId: string, courseId: string, score: number, now = new Date()): Promise<number | null> {
  const today = lagosDate(now);
  await db
    .insert(readinessSnapshots)
    .values({ userId, courseId, date: today, score })
    .onConflictDoUpdate({ target: [readinessSnapshots.userId, readinessSnapshots.courseId, readinessSnapshots.date], set: { score } });
  const [base] = await db
    .select({ score: readinessSnapshots.score })
    .from(readinessSnapshots)
    .where(
      and(
        eq(readinessSnapshots.userId, userId),
        eq(readinessSnapshots.courseId, courseId),
        gte(readinessSnapshots.date, lagosDate(addDays(now, -7))),
        lte(readinessSnapshots.date, lagosDate(addDays(now, -1))),
      ),
    )
    .orderBy(asc(readinessSnapshots.date))
    .limit(1);
  return base ? Math.round((score - base.score) * 100) : null;
}

export type TodayActivity = { answeredByTopic: Map<string, number>; mocksDone: number };

/** What the student did on this course today (Lagos day), for ticking off the plan. */
export async function todayActivity(db: Db, userId: string, courseId: string, now = new Date()): Promise<TodayActivity> {
  const start = new Date(`${lagosDate(now)}T00:00:00+01:00`);
  const answered = await db
    .select({ topicId: questions.topicId, n: count() })
    .from(attemptAnswers)
    .innerJoin(mockAttempts, eq(mockAttempts.id, attemptAnswers.attemptId))
    .innerJoin(questions, eq(questions.id, attemptAnswers.questionId))
    .where(
      and(
        eq(mockAttempts.userId, userId),
        eq(mockAttempts.courseId, courseId),
        isNotNull(attemptAnswers.isCorrect),
        gte(sql`coalesce(${attemptAnswers.answeredAt}, ${mockAttempts.startedAt})`, start),
      ),
    )
    .groupBy(questions.topicId);
  const [mocks] = await db
    .select({ n: count() })
    .from(mockAttempts)
    .where(and(eq(mockAttempts.userId, userId), eq(mockAttempts.courseId, courseId), ne(mockAttempts.mode, "practice"), gte(mockAttempts.submittedAt, start)));
  return {
    answeredByTopic: new Map(answered.filter((a) => a.topicId).map((a) => [a.topicId!, Number(a.n)])),
    mocksDone: Number(mocks?.n ?? 0),
  };
}

export type PlanItem = {
  id: string;
  kind: "practice" | "new_topic" | "mock" | "upload";
  label: string;
  topicId?: string;
  topicName?: string;
  count: number;
  done: boolean;
  /** 0–1 towards `count` today. */
  progress: number;
};

export type DailyPlan = {
  items: PlanItem[];
  doneCount: number;
  next: PlanItem | null;
  daysLeft: number | null;
  /** Pro: the days up to the exam (at most a week). */
  week: { date: string; label: string }[];
  /** Free plans see two items; Pro sees the rest. */
  lockedItems: number;
};

/** Sizes the day's work by how close the exam is. */
export function questionsPerTopic(daysLeft: number | null): number {
  if (daysLeft === null) return 10;
  if (daysLeft <= 7) return 20;
  if (daysLeft <= 21) return 15;
  return 10;
}

export function dailyPlan(input: {
  topics: CourseTopic[];
  examDate: string | null;
  tier: "basic" | "full";
  activity: TodayActivity;
  now?: Date;
}): DailyPlan {
  const now = input.now ?? new Date();
  const daysLeft = input.examDate ? Math.max(0, daysUntilExam(input.examDate, now)) : null;
  const usable = input.topics.filter((t) => t.questions >= MIN_TOPIC_QUESTIONS);
  if (!usable.length) {
    const upload: PlanItem = { id: "upload", kind: "upload", label: "Upload your notes or pick a shared bank", count: 1, done: false, progress: 0 };
    return { items: [upload], doneCount: 0, next: upload, daysLeft, week: [], lockedItems: 0 };
  }
  const weak = usable.filter((t) => t.mastery !== null && t.label !== "mastered").sort((a, b) => a.mastery! - b.mastery! || b.questions - a.questions);
  const untried = usable.filter((t) => t.mastery === null).sort((a, b) => b.questions - a.questions);
  const per = questionsPerTopic(daysLeft);
  const answered = (id: string) => input.activity.answeredByTopic.get(id) ?? 0;
  const practice = (t: CourseTopic, kind: "practice" | "new_topic", n: number): PlanItem => ({
    id: `${kind}:${t.id}`,
    kind,
    label: kind === "practice" ? `${n} questions on ${t.name}` : `Try ${n} questions on ${t.name}`,
    topicId: t.id,
    topicName: t.name,
    count: Math.min(n, t.questions),
    done: answered(t.id) >= Math.min(n, t.questions),
    progress: Math.min(1, answered(t.id) / Math.max(1, Math.min(n, t.questions))),
  });
  const mockSize = daysLeft !== null && daysLeft <= 7 ? 30 : 20;
  const mock: PlanItem = {
    id: "mock",
    kind: "mock",
    label: `Timed mock · ${mockSize} questions`,
    count: mockSize,
    done: input.activity.mocksDone > 0,
    progress: input.activity.mocksDone > 0 ? 1 : 0,
  };

  const all: PlanItem[] = [];
  if (weak[0]) all.push(practice(weak[0], "practice", per));
  else if (untried[0]) all.push(practice(untried[0], "new_topic", 10));
  all.push(mock);
  if (weak[1]) all.push(practice(weak[1], "practice", Math.max(10, per - 5)));
  const fresh = untried.find((t) => !all.some((i) => i.topicId === t.id));
  if (fresh) all.push(practice(fresh, "new_topic", 10));

  const items = input.tier === "full" ? all.slice(0, 4) : all.slice(0, 2);
  const week: DailyPlan["week"] = [];
  if (input.tier === "full" && daysLeft !== null && daysLeft > 0) {
    const rotation = [...weak, ...untried];
    for (let i = 1; i <= Math.min(daysLeft, 7); i++) {
      const date = lagosDate(addDays(now, i));
      if (i === daysLeft) week.push({ date, label: "Exam day. Light review only, then rest." });
      else if (i === daysLeft - 1) week.push({ date, label: `Full ${30}-question mock, then review what you missed` });
      else {
        const t = rotation[(i - 1) % Math.max(1, rotation.length)];
        week.push({ date, label: t ? `${per} questions on ${t.name}${i % 3 === 0 ? " + a 20-question mock" : ""}` : "Timed mock" });
      }
    }
  }
  const doneCount = items.filter((i) => i.done).length;
  return { items, doneCount, next: items.find((i) => !i.done) ?? null, daysLeft, week, lockedItems: Math.max(0, all.length - items.length) };
}

export type ReadNextItem = { topicId: string; topicName: string; uploadId: string; title: string; label: string; page: number | null };

/**
 * "Read next" (brief §5): for the weakest topics, the pages of the student's own
 * notes those questions came from. Notes stay private, so only their own uploads.
 */
export async function readNext(db: Db, userId: string, courseId: string, topicIds: string[], perTopic = 2): Promise<ReadNextItem[]> {
  if (!topicIds.length) return [];
  const rows = await db
    .select({ topicId: questions.topicId, topicName: topics.name, uploadId: uploads.id, title: uploads.title, source: questions.sourceLabel, n: count() })
    .from(questions)
    .innerJoin(uploads, and(eq(uploads.id, questions.sourceUploadId), eq(uploads.userId, userId)))
    .innerJoin(topics, eq(topics.id, questions.topicId))
    .where(and(eq(questions.courseId, courseId), inArray(questions.topicId, topicIds), isNotNull(questions.sourceLabel)))
    .groupBy(questions.topicId, topics.name, uploads.id, uploads.title, questions.sourceLabel)
    .orderBy(sql`count(*) desc`);
  const out: ReadNextItem[] = [];
  for (const id of topicIds) {
    for (const r of rows.filter((x) => x.topicId === id).slice(0, perTopic)) {
      const label = r.source!.includes(" · ") ? r.source!.split(" · ").pop()! : r.source!;
      const page = Number(label.match(/\d+/)?.[0]);
      out.push({ topicId: id, topicName: r.topicName, uploadId: r.uploadId, title: r.title, label, page: Number.isFinite(page) ? page : null });
    }
  }
  return out;
}
