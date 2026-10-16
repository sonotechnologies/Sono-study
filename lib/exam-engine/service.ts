/**
 * Exam engine on the server: start/resume, the page payload, sync, submit,
 * results and practice. Ported from SonoCBT lib/exams/runtime.ts with the
 * school-only parts removed (PINs, invigilation, device lock, IP rules,
 * integrity events). The server owns the deadline and does all marking;
 * answer keys never leave this module during a mock.
 */
import { and, asc, desc, eq, inArray, isNotNull, ne, or, sql } from "drizzle-orm";
import type { Db } from "@/db";
import {
  attemptAnswers,
  banks,
  challenges,
  courses,
  enrollments,
  leaderboardEntries,
  mockAttempts,
  questions,
  topicMastery,
  topics,
  uploads,
  users,
  type AttemptConfig,
  type LateAnswer,
  type MockAttempt,
} from "@/db/schema";
import { extendProUntil } from "@/lib/billing";
import { recordWeeklyResult } from "@/lib/leaderboard";
import { masteryScore, MASTERY_WINDOW } from "@/lib/mastery";
import { REFERRAL } from "@/lib/plans";
import { nextStreak } from "@/lib/streak";
import { lagosDate } from "@/lib/time";
import { topicBreakdown, xpFor, type TopicResult } from "./results";
import {
  answeredInTime,
  attemptDeadline,
  buildOptionOrder,
  correctOptionIds,
  isAnswered,
  isOverdue,
  markResponse,
  seededRandom,
  shuffle,
  validResponse,
} from "./rules";
import type {
  AttemptMode,
  AttemptResponse,
  QuestionSnapshot,
  RuntimePayload,
  SubmitReason,
  SubmitSummary,
  SyncAnswer,
  SyncRequest,
  SyncResponse,
} from "./types";

export class ExamError extends Error {}

const MAX_ANSWERS_PER_SYNC = 300;
export const QUESTION_COUNTS = [10, 20, 30, 50] as const;
export const MAX_QUESTIONS = 100;

// ─── Question selection ──────────────────────────────────────────────────────

/** Questions a student may practise: shared ones, plus private ones from their own uploads. Theory is separate. */
function visibleTo(userId: string) {
  return and(
    eq(questions.status, "active"),
    ne(questions.type, "theory"),
    or(
      eq(questions.visibility, "shared"),
      eq(questions.createdById, userId),
      sql`${questions.sourceUploadId} in (select ${uploads.id} from ${uploads} where ${uploads.userId} = ${userId})`,
    ),
  );
}

type SnapshotRow = {
  id: string;
  type: string;
  stem: string;
  options: QuestionSnapshot["options"];
  answer: QuestionSnapshot["answer"];
  explanation: string | null;
  topicId: string | null;
  topicName: string | null;
  sourceLabel: string | null;
  isPastQuestion: boolean;
  difficulty: number;
};

async function loadSnapshots(db: Db, where: ReturnType<typeof and>): Promise<SnapshotRow[]> {
  return db
    .select({
      id: questions.id,
      type: questions.type,
      stem: questions.stem,
      options: questions.options,
      answer: questions.answer,
      explanation: questions.explanation,
      topicId: questions.topicId,
      topicName: topics.name,
      sourceLabel: questions.sourceLabel,
      isPastQuestion: questions.isPastQuestion,
      difficulty: questions.difficulty,
    })
    .from(questions)
    .leftJoin(topics, eq(topics.id, questions.topicId))
    .where(where);
}

function toSnapshot(r: SnapshotRow): QuestionSnapshot {
  return {
    id: r.id,
    type: r.type as QuestionSnapshot["type"],
    stem: r.stem,
    options: r.options ?? [],
    answer: r.answer,
    explanation: r.explanation,
    topicId: r.topicId,
    topicName: r.topicName,
    sourceLabel: r.sourceLabel,
    isPastQuestion: r.isPastQuestion,
  };
}

/**
 * Picks `count` questions: matching difficulty first (topped up from the rest
 * if there aren't enough), then questions this student has seen least, in a
 * seeded random order.
 */
export async function selectQuestions(
  db: Db,
  opts: { userId: string; courseId: string; topicIds: string[]; difficulty: AttemptConfig["difficulty"]; count: number; seed: string },
): Promise<QuestionSnapshot[]> {
  const pool = await loadSnapshots(
    db,
    and(eq(questions.courseId, opts.courseId), visibleTo(opts.userId), opts.topicIds.length ? inArray(questions.topicId, opts.topicIds) : undefined),
  );
  if (!pool.length) return [];
  const seen = await db
    .select({ id: attemptAnswers.questionId, n: sql<number>`count(*)::int` })
    .from(attemptAnswers)
    .innerJoin(mockAttempts, eq(mockAttempts.id, attemptAnswers.attemptId))
    .where(and(eq(mockAttempts.userId, opts.userId), eq(mockAttempts.courseId, opts.courseId)))
    .groupBy(attemptAnswers.questionId);
  const seenCount = new Map(seen.map((s) => [s.id, Number(s.n)]));
  const rand = seededRandom(opts.seed);
  const fits = (r: SnapshotRow) => (opts.difficulty === "easier" ? r.difficulty <= 2 : opts.difficulty === "harder" ? r.difficulty >= 3 : true);
  const order = (rows: SnapshotRow[]) =>
    shuffle(rows, rand)
      .map((r, i) => ({ r, i }))
      .sort((a, b) => (seenCount.get(a.r.id) ?? 0) - (seenCount.get(b.r.id) ?? 0) || a.i - b.i)
      .map((x) => x.r);
  const picked = [...order(pool.filter(fits)), ...order(pool.filter((r) => !fits(r)))].slice(0, opts.count);
  return picked.map(toSnapshot);
}

// ─── Start / resume ──────────────────────────────────────────────────────────

async function requireEnrolled(db: Db, userId: string, courseId: string) {
  const [row] = await db
    .select({ code: courses.code })
    .from(enrollments)
    .innerJoin(courses, eq(courses.id, enrollments.courseId))
    .where(and(eq(enrollments.userId, userId), eq(enrollments.courseId, courseId)));
  if (!row) throw new ExamError("Add this course first.");
  return row;
}

export type StartInput =
  | { mode: "mock"; courseId: string; config: AttemptConfig }
  | { mode: "practice"; courseId: string; topicIds: string[]; count?: number }
  | { mode: "challenge"; challengeId: string };

/** Starts a mock, practice session or challenge. Challenges: one attempt each, same questions for everyone. */
export async function startAttempt(db: Db, userId: string, input: StartInput, now = new Date()): Promise<MockAttempt> {
  if (input.mode === "challenge") return startChallenge(db, userId, input.challengeId, now);
  await requireEnrolled(db, userId, input.courseId);
  const seed = `${userId}:${now.getTime()}`;

  let config: AttemptConfig;
  if (input.mode === "mock") {
    const c = input.config;
    const count = Math.round(c.count);
    if (!(count >= 1 && count <= MAX_QUESTIONS)) throw new ExamError("Pick between 1 and 100 questions.");
    if (c.timeLimitSec !== null && !(c.timeLimitSec >= 60 && c.timeLimitSec <= 4 * 3600)) throw new ExamError("Pick a time limit.");
    config = { ...c, count };
  } else {
    config = { count: Math.min(input.count ?? 10, 30), timeLimitSec: null, topicIds: input.topicIds, difficulty: "mixed", bankId: null };
  }

  let snapshot: QuestionSnapshot[];
  if (config.bankId) {
    const [bank] = await db.select().from(banks).where(and(eq(banks.id, config.bankId), eq(banks.courseId, input.courseId)));
    if (!bank || (!bank.isShared && bank.ownerId !== userId)) throw new ExamError("That bank isn't available.");
    const rows = await loadSnapshots(db, and(inArray(questions.id, bank.questionIds.length ? bank.questionIds : ["-"]), visibleTo(userId)));
    const byId = new Map(rows.map((r) => [r.id, r]));
    snapshot = bank.questionIds.map((id) => byId.get(id)).filter((r): r is SnapshotRow => !!r).map(toSnapshot);
    config = { ...config, count: snapshot.length };
    await db.update(banks).set({ attempts: sql`${banks.attempts} + 1` }).where(eq(banks.id, bank.id));
  } else {
    snapshot = await selectQuestions(db, { userId, courseId: input.courseId, topicIds: config.topicIds, difficulty: config.difficulty, count: config.count, seed });
  }
  if (!snapshot.length) throw new ExamError("There are no questions for this yet. Upload notes or pick another topic.");

  const optionOrder = buildOptionOrder(
    snapshot.map((q) => ({ id: q.id, type: q.type, optionIds: q.options.map((o) => o.id) })),
    true,
    seed,
  );
  const [row] = await db
    .insert(mockAttempts)
    .values({
      userId,
      courseId: input.courseId,
      bankId: config.bankId,
      questionIds: snapshot.map((q) => q.id),
      snapshot,
      optionOrder,
      config,
      durationSec: config.timeLimitSec,
      startedAt: now,
      endsAt: attemptDeadline(now, config.timeLimitSec),
      lastSeenAt: now,
      mode: input.mode,
    })
    .returning();
  return row;
}

async function startChallenge(db: Db, userId: string, challengeId: string, now: Date): Promise<MockAttempt> {
  const [c] = await db.select().from(challenges).where(eq(challenges.id, challengeId));
  if (!c) throw new ExamError("Challenge not found.");
  await requireEnrolled(db, userId, c.courseId);
  const [existing] = await db.select().from(mockAttempts).where(and(eq(mockAttempts.challengeId, challengeId), eq(mockAttempts.userId, userId)));
  if (existing) return (await finishIfOverdue(db, existing, now)) ?? existing;
  if (now < c.startsAt) throw new ExamError("This challenge hasn't started yet.");
  if (now >= c.endsAt) throw new ExamError("This challenge has closed.");

  // Same questions for everyone: the bank's, or a selection seeded by the challenge itself.
  let snapshot: QuestionSnapshot[];
  if (c.bankId) {
    const [bank] = await db.select().from(banks).where(eq(banks.id, c.bankId));
    const rows = bank ? await loadSnapshots(db, inArray(questions.id, bank.questionIds.length ? bank.questionIds : ["-"])) : [];
    const byId = new Map(rows.map((r) => [r.id, r]));
    snapshot = (bank?.questionIds ?? []).map((id) => byId.get(id)).filter((r): r is SnapshotRow => !!r).map(toSnapshot);
  } else {
    const pool = await loadSnapshots(db, and(eq(questions.courseId, c.courseId), eq(questions.status, "active"), eq(questions.visibility, "shared"), ne(questions.type, "theory")));
    snapshot = shuffle(
      pool.sort((a, b) => a.id.localeCompare(b.id)),
      seededRandom(c.id),
    )
      .slice(0, c.questionCount)
      .map(toSnapshot);
  }
  if (!snapshot.length) throw new ExamError("This challenge has no questions yet.");
  const seed = `${c.id}:${userId}`;
  try {
    const [row] = await db
      .insert(mockAttempts)
      .values({
        userId,
        courseId: c.courseId,
        challengeId: c.id,
        bankId: c.bankId,
        questionIds: snapshot.map((q) => q.id),
        snapshot,
        optionOrder: buildOptionOrder(snapshot.map((q) => ({ id: q.id, type: q.type, optionIds: q.options.map((o) => o.id) })), true, seed),
        config: { count: snapshot.length, timeLimitSec: c.durationSec, topicIds: [], difficulty: "mixed", bankId: c.bankId },
        durationSec: c.durationSec,
        startedAt: now,
        endsAt: attemptDeadline(now, c.durationSec, c.endsAt),
        lastSeenAt: now,
        mode: "challenge",
      })
      .returning();
    return row;
  } catch (err) {
    // Two taps on Start at once: the other one won; use its attempt.
    const [again] = await db.select().from(mockAttempts).where(and(eq(mockAttempts.challengeId, challengeId), eq(mockAttempts.userId, userId)));
    if (again) return again;
    throw err;
  }
}

export async function getAttemptFor(db: Db, userId: string, attemptId: string, now = new Date()): Promise<MockAttempt | null> {
  const [a] = await db.select().from(mockAttempts).where(and(eq(mockAttempts.id, attemptId), eq(mockAttempts.userId, userId)));
  if (!a) return null;
  return (await finishIfOverdue(db, a, now)) ?? a;
}

/** The mock (or challenge) still running, for "Continue mock" on Home. */
export async function inProgressAttempt(db: Db, userId: string, now = new Date()): Promise<MockAttempt | null> {
  const rows = await db
    .select()
    .from(mockAttempts)
    .where(and(eq(mockAttempts.userId, userId), eq(mockAttempts.status, "in_progress"), ne(mockAttempts.mode, "practice")))
    .orderBy(desc(mockAttempts.startedAt))
    .limit(3);
  for (const a of rows) {
    const done = await finishIfOverdue(db, a, now);
    if (!done) return a;
  }
  return null;
}

// ─── Payload ─────────────────────────────────────────────────────────────────

/** Everything the runtime page needs, in this student's order, without answers. */
export async function buildPayload(db: Db, a: MockAttempt, courseCode: string, now = new Date()): Promise<RuntimePayload> {
  const answers = await db.select().from(attemptAnswers).where(eq(attemptAnswers.attemptId, a.id));
  const questionsOut = a.snapshot.map((q) => ({
    id: q.id,
    type: q.type,
    stem: q.stem,
    topicName: q.topicName,
    options:
      q.type === "true_false"
        ? [
            { id: "true", text: "True" },
            { id: "false", text: "False" },
          ]
        : (a.optionOrder[q.id] ?? q.options.map((o) => o.id)).map((id) => q.options.find((o) => o.id === id)).filter((o): o is NonNullable<typeof o> => !!o),
  }));
  const code = courseCode.replace(/^([A-Z]+)(\d+)/, "$1 $2");
  return {
    attemptId: a.id,
    mode: a.mode,
    title: a.mode === "challenge" ? `${code} · Challenge` : a.mode === "practice" ? `${code} · Practice` : `${code} · Mock`,
    courseCode,
    syncUrl: `/mock/${a.id}/sync`,
    resultsUrl: `/results/${a.id}`,
    exitUrl: "/home",
    questions: questionsOut,
    answers: Object.fromEntries(answers.map((x) => [x.questionId, { response: x.answer ?? null, flagged: x.flagged, seq: x.clientSeq }])),
    currentIndex: Math.min(a.currentIndex, Math.max(0, questionsOut.length - 1)),
    clientSeq: a.clientSeq,
    deadlineAt: a.endsAt?.getTime() ?? null,
    durationSec: a.durationSec,
    serverNow: now.getTime(),
    done: a.status === "in_progress" ? null : summaryOf(a),
  };
}

// ─── Finishing ───────────────────────────────────────────────────────────────

function summaryOf(a: MockAttempt): SubmitSummary {
  return {
    submittedAt: (a.submittedAt ?? new Date()).getTime(),
    answered: a.answeredCount,
    total: a.questionIds.length,
    score: a.score ?? 0,
    max: a.maxScore ?? a.questionIds.length,
    reason: (a.submitReason ?? "student") as SubmitReason,
  };
}

/** Time the student actually used: start → submit, never more than the time allowed. */
export function timeUsedSec(a: Pick<MockAttempt, "startedAt" | "submittedAt" | "endsAt">): number {
  const end = Math.min((a.submittedAt ?? new Date()).getTime(), a.endsAt?.getTime() ?? Infinity);
  return Math.max(0, Math.round((end - a.startedAt.getTime()) / 1000));
}

type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];

/** Marks every answer from the frozen snapshot. */
async function markAll(tx: Tx | Db, a: MockAttempt) {
  const answers = await tx.select().from(attemptAnswers).where(eq(attemptAnswers.attemptId, a.id));
  const snap = new Map(a.snapshot.map((q) => [q.id, q]));
  const marked = answers
    .map((ans) => {
      const q = snap.get(ans.questionId);
      return q ? { id: ans.id, ...markResponse(q, ans.answer ?? null) } : null;
    })
    .filter((m): m is NonNullable<typeof m> => !!m);
  for (const m of marked) {
    await tx.update(attemptAnswers).set({ isCorrect: m.isCorrect, marksAwarded: m.marksAwarded }).where(eq(attemptAnswers.id, m.id));
  }
  return {
    score: Math.round(marked.reduce((s, m) => s + m.marksAwarded, 0) * 100) / 100,
    maxScore: a.snapshot.length,
    answered: answers.filter((x) => isAnswered(x.answer)).length,
  };
}

/**
 * Marks every answer and closes the attempt. Safe to call twice: only the first
 * call (while still in progress) does anything, including the side effects:
 * leaderboard, mastery, XP, streak and referral rewards.
 */
export async function finalizeAttempt(db: Db, a: MockAttempt, reason: SubmitReason, now = new Date()): Promise<MockAttempt> {
  return db.transaction(async (tx) => {
    const { score, maxScore, answered } = await markAll(tx, a);
    const submittedAt = reason === "timeout" && a.endsAt ? new Date(Math.min(now.getTime(), a.endsAt.getTime())) : now;
    const xp = xpFor(a.mode, score);
    const [row] = await tx
      .update(mockAttempts)
      .set({
        status: reason === "timeout" ? "auto_submitted" : "submitted",
        submittedAt,
        submitReason: reason,
        score,
        maxScore,
        answeredCount: answered,
        xpEarned: xp,
      })
      .where(and(eq(mockAttempts.id, a.id), eq(mockAttempts.status, "in_progress")))
      .returning();
    if (!row) return (await tx.select().from(mockAttempts).where(eq(mockAttempts.id, a.id)))[0];
    await afterFinish(tx, row, now);
    return row;
  });
}

async function afterFinish(tx: Tx, a: MockAttempt, now: Date) {
  const timeSec = timeUsedSec(a);
  if (a.mode === "mock") {
    await recordWeeklyResult(tx as unknown as Db, { courseId: a.courseId, userId: a.userId, score: a.score ?? 0, maxScore: a.maxScore ?? 0, timeSec, now });
  } else if (a.mode === "challenge" && a.challengeId) {
    await tx
      .insert(leaderboardEntries)
      .values({ courseId: a.courseId, challengeId: a.challengeId, userId: a.userId, score: a.score ?? 0, maxScore: a.maxScore ?? 0, timeSec })
      .onConflictDoNothing();
  }
  const topicIds = [...new Set(a.snapshot.map((q) => q.topicId).filter((t): t is string => !!t))];
  await updateMastery(tx as unknown as Db, a.userId, topicIds, now);

  const [u] = await tx
    .select({ xp: users.xp, streakDays: users.streakDays, lastActiveDate: users.lastActiveDate, referredById: users.referredById })
    .from(users)
    .where(eq(users.id, a.userId));
  const streak = nextStreak(u, lagosDate(now));
  await tx.update(users).set({ xp: u.xp + (a.xpEarned ?? 0), ...streak }).where(eq(users.id, a.userId));
  if (a.mode !== "practice" && u.referredById) await grantReferralRewards(tx, u.referredById, now);
}

/** Invite 3 classmates who sign up and finish a mock → a free Week Pass, for every 3. */
async function grantReferralRewards(tx: Tx, inviterId: string, now: Date) {
  const [{ n }] = await tx
    .select({ n: sql<number>`count(distinct ${users.id})::int` })
    .from(users)
    .innerJoin(mockAttempts, and(eq(mockAttempts.userId, users.id), isNotNull(mockAttempts.submittedAt), ne(mockAttempts.mode, "practice")))
    .where(eq(users.referredById, inviterId));
  const [inviter] = await tx.select({ proUntil: users.proUntil, rewards: users.referralRewards }).from(users).where(eq(users.id, inviterId));
  if (!inviter) return;
  const due = Math.floor(Number(n) / REFERRAL.invitesNeeded) - inviter.rewards;
  if (due <= 0) return;
  let proUntil = inviter.proUntil;
  for (let i = 0; i < due; i++) proUntil = extendProUntil(proUntil, "week", now);
  await tx.update(users).set({ proUntil, plan: "pro", referralRewards: inviter.rewards + due }).where(eq(users.id, inviterId));
}

/** Recomputes mastery for the given topics from the student's latest answers (weighted, last 20). */
export async function updateMastery(db: Db, userId: string, topicIds: string[], now = new Date()) {
  for (const topicId of topicIds) {
    const rows = await db
      .select({ isCorrect: attemptAnswers.isCorrect })
      .from(attemptAnswers)
      .innerJoin(mockAttempts, eq(mockAttempts.id, attemptAnswers.attemptId))
      .innerJoin(questions, eq(questions.id, attemptAnswers.questionId))
      .where(and(eq(mockAttempts.userId, userId), eq(questions.topicId, topicId), isNotNull(attemptAnswers.isCorrect)))
      .orderBy(desc(sql`coalesce(${attemptAnswers.answeredAt}, ${mockAttempts.startedAt})`), desc(attemptAnswers.id))
      .limit(MASTERY_WINDOW);
    if (!rows.length) continue;
    const recent = rows.map((r) => !!r.isCorrect);
    const values = { correct: recent.filter(Boolean).length, total: recent.length, masteryScore: masteryScore(recent), updatedAt: now };
    await db
      .insert(topicMastery)
      .values({ userId, topicId, ...values })
      .onConflictDoUpdate({ target: [topicMastery.userId, topicMastery.topicId], set: values });
  }
}

/** The server's own auto-submit: once the deadline plus the mode's grace has passed. */
export async function finishIfOverdue(db: Db, a: MockAttempt, now = new Date()): Promise<MockAttempt | null> {
  if (a.status !== "in_progress" || !isOverdue(a.endsAt, a.mode, now)) return null;
  return finalizeAttempt(db, a, "timeout", now);
}

// ─── Sync ────────────────────────────────────────────────────────────────────

function clean(answers: SyncAnswer[]): SyncAnswer[] {
  // Keep only the newest write per question.
  const latest = new Map<string, SyncAnswer>();
  for (const x of answers) {
    if (!x || typeof x.id !== "string" || !Number.isInteger(x.seq) || x.seq < 1) continue;
    const prev = latest.get(x.id);
    if (!prev || prev.seq < x.seq) latest.set(x.id, x);
  }
  return [...latest.values()];
}

/**
 * Applies answers from the device. Each answer carries the device's sequence
 * number; the server keeps whichever write is newest, so retries and
 * out-of-order requests are harmless. After the deadline, only answers stamped
 * before it count; once the attempt is closed, new answers are kept aside
 * (late) and not marked.
 */
export async function syncAttempt(db: Db, userId: string, req: SyncRequest, now = new Date()): Promise<SyncResponse> {
  if (!req || typeof req.attemptId !== "string" || !Array.isArray(req.answers)) return { ok: false, error: "Bad request." };
  if (req.answers.length > MAX_ANSWERS_PER_SYNC) return { ok: false, error: "Too many answers in one request." };
  const [found] = await db.select().from(mockAttempts).where(and(eq(mockAttempts.id, req.attemptId), eq(mockAttempts.userId, userId)));
  if (!found) return { ok: false, error: "Mock not found." };
  let a: MockAttempt = found;

  const answers = clean(req.answers);
  const ackSeq = answers.reduce((m, x) => Math.max(m, x.seq), 0);
  a = (await finishIfOverdue(db, a, now)) ?? a;

  if (a.status !== "in_progress") {
    const fresh = answers.filter((x) => x.seq > a.clientSeq);
    let lateCount = a.lateAnswers?.length ?? 0;
    if (fresh.length) {
      const merged = new Map<string, LateAnswer>((a.lateAnswers ?? []).map((l) => [l.questionId, l]));
      for (const x of fresh) {
        const prev = merged.get(x.id);
        if (!prev || prev.clientSeq < x.seq) merged.set(x.id, { questionId: x.id, response: x.response, clientSeq: x.seq, receivedAt: now.toISOString() });
      }
      const late = [...merged.values()].slice(0, MAX_ANSWERS_PER_SYNC);
      await db.update(mockAttempts).set({ lateAnswers: late }).where(eq(mockAttempts.id, a.id));
      lateCount = late.length;
    }
    return { ok: true, status: "submitted", serverNow: now.getTime(), summary: summaryOf(a), ackSeq, lateCount };
  }

  const snap = new Map(a.snapshot.map((q) => [q.id, q]));
  const rows = answers
    .filter((x) => snap.has(x.id) && validResponse(snap.get(x.id)!, x.response as AttemptResponse | null) && answeredInTime(x.at, a.endsAt, now))
    .map((x) => ({ attemptId: a.id, questionId: x.id, answer: x.response, flagged: !!x.flagged, clientSeq: x.seq, answeredAt: now }));
  if (rows.length) {
    await db
      .insert(attemptAnswers)
      .values(rows)
      .onConflictDoUpdate({
        target: [attemptAnswers.attemptId, attemptAnswers.questionId],
        set: {
          answer: sql`excluded.answer`,
          flagged: sql`excluded.flagged`,
          clientSeq: sql`excluded.client_seq`,
          answeredAt: sql`excluded.answered_at`,
        },
        setWhere: sql`${attemptAnswers.clientSeq} < excluded.client_seq`,
      });
  }

  const index = Number.isInteger(req.currentIndex) ? Math.max(0, Math.min(req.currentIndex, a.questionIds.length - 1)) : a.currentIndex;
  const [updated] = await db
    .update(mockAttempts)
    .set({ currentIndex: index, lastSeenAt: now, clientSeq: Math.max(a.clientSeq, ackSeq) })
    .where(and(eq(mockAttempts.id, a.id), eq(mockAttempts.status, "in_progress")))
    .returning();
  a = updated ?? a;

  const pastDeadline = a.endsAt !== null && now.getTime() >= a.endsAt.getTime();
  if (req.submit || pastDeadline) {
    const done = await finalizeAttempt(db, a, req.submit && !pastDeadline ? "student" : "timeout", now);
    return { ok: true, status: "submitted", serverNow: now.getTime(), summary: summaryOf(done), ackSeq, lateCount: 0 };
  }
  return { ok: true, status: "in_progress", serverNow: now.getTime(), deadlineAt: a.endsAt?.getTime() ?? null, ackSeq };
}

// ─── Practice ────────────────────────────────────────────────────────────────

export type PracticeFeedback = {
  isCorrect: boolean;
  correctOptionIds: string[];
  accepted: string[];
  explanation: string | null;
  sourceLabel: string | null;
};

/** Practice mode: one question at a time with instant feedback. An answer is final once checked. */
export async function answerPractice(
  db: Db,
  userId: string,
  attemptId: string,
  questionId: string,
  response: AttemptResponse,
  now = new Date(),
): Promise<PracticeFeedback> {
  const [a] = await db.select().from(mockAttempts).where(and(eq(mockAttempts.id, attemptId), eq(mockAttempts.userId, userId)));
  if (!a || a.mode !== "practice") throw new ExamError("Practice session not found.");
  if (a.status !== "in_progress") throw new ExamError("This session is finished.");
  const q = a.snapshot.find((x) => x.id === questionId);
  if (!q || !validResponse(q, response) || !isAnswered(response)) throw new ExamError("Pick an answer first.");
  const marked = markResponse(q, response);
  const [existing] = await db
    .select({ isCorrect: attemptAnswers.isCorrect, answer: attemptAnswers.answer })
    .from(attemptAnswers)
    .where(and(eq(attemptAnswers.attemptId, a.id), eq(attemptAnswers.questionId, q.id)));
  // Already checked (e.g. a double tap): the first answer stands.
  const result = existing ? markResponse(q, existing.answer ?? null) : marked;
  if (!existing) {
    await db
      .insert(attemptAnswers)
      .values({ attemptId: a.id, questionId: q.id, answer: response, isCorrect: marked.isCorrect, marksAwarded: marked.marksAwarded, clientSeq: 1, answeredAt: now })
      .onConflictDoNothing();
    await db
      .update(mockAttempts)
      .set({ answeredCount: sql`${mockAttempts.answeredCount} + 1`, currentIndex: Math.min(a.snapshot.indexOf(q) + 1, a.snapshot.length - 1), lastSeenAt: now })
      .where(eq(mockAttempts.id, a.id));
    if (q.topicId) await updateMastery(db, userId, [q.topicId], now);
  }
  return {
    isCorrect: result.isCorrect,
    correctOptionIds: correctOptionIds(q.answer),
    accepted: q.answer.kind === "fill_in" ? q.answer.accepted : [],
    explanation: q.explanation,
    sourceLabel: q.sourceLabel,
  };
}

/** The 3 lowest-mastery topics this student has tried in a course; untried topics fill any gap. */
export async function weakestTopics(db: Db, userId: string, courseId: string, n = 3): Promise<{ id: string; name: string; score: number | null }[]> {
  const rows = await db
    .select({ id: topics.id, name: topics.name, score: topicMastery.masteryScore })
    .from(topics)
    .leftJoin(topicMastery, and(eq(topicMastery.topicId, topics.id), eq(topicMastery.userId, userId)))
    .where(eq(topics.courseId, courseId))
    .orderBy(asc(sql`coalesce(${topicMastery.masteryScore}, 2)`), asc(topics.name));
  const tried = rows.filter((r) => r.score !== null);
  const pool = tried.length >= n ? tried : [...tried, ...rows.filter((r) => r.score === null)];
  return pool.slice(0, n).map((r) => ({ id: r.id, name: r.name, score: r.score }));
}

// ─── Results ─────────────────────────────────────────────────────────────────

export type ReviewItem = {
  index: number;
  question: QuestionSnapshot & { displayOptions: QuestionSnapshot["options"] };
  response: AttemptResponse | null;
  isCorrect: boolean;
  answered: boolean;
};

export type AttemptResult = {
  attempt: MockAttempt;
  courseCode: string;
  items: ReviewItem[];
  topics: TopicResult[];
  timeSec: number;
  /** Best earlier mock score in this course, scaled to this mock's length; null if none. */
  prevBest: number | null;
};

export async function getResult(db: Db, userId: string, attemptId: string, now = new Date()): Promise<AttemptResult | null> {
  const a = await getAttemptFor(db, userId, attemptId, now);
  if (!a || a.status === "in_progress") return null;
  const [[course], answers, earlier] = await Promise.all([
    db.select({ code: courses.code }).from(courses).where(eq(courses.id, a.courseId)),
    db.select().from(attemptAnswers).where(eq(attemptAnswers.attemptId, a.id)),
    db
      .select({ score: mockAttempts.score, maxScore: mockAttempts.maxScore })
      .from(mockAttempts)
      .where(
        and(
          eq(mockAttempts.userId, userId),
          eq(mockAttempts.courseId, a.courseId),
          eq(mockAttempts.mode, a.mode),
          ne(mockAttempts.status, "in_progress"),
          sql`${mockAttempts.submittedAt} < ${a.submittedAt ?? now}`,
          ne(mockAttempts.id, a.id),
        ),
      ),
  ]);
  const byQ = new Map(answers.map((x) => [x.questionId, x]));
  const items: ReviewItem[] = a.snapshot.map((q, index) => {
    const ans = byQ.get(q.id);
    const response = ans?.answer ?? null;
    const displayOptions =
      q.type === "true_false"
        ? [
            { id: "true", text: "True" },
            { id: "false", text: "False" },
          ]
        : (a.optionOrder[q.id] ?? q.options.map((o) => o.id)).map((id) => q.options.find((o) => o.id === id)).filter((o): o is NonNullable<typeof o> => !!o);
    return { index, question: { ...q, displayOptions }, response, isCorrect: ans?.isCorrect ?? false, answered: isAnswered(response) };
  });
  const max = a.maxScore ?? a.snapshot.length;
  const ratios = earlier.filter((e) => e.maxScore).map((e) => (e.score ?? 0) / e.maxScore!);
  const prevBest = ratios.length ? Math.round(Math.max(...ratios) * max * 10) / 10 : null;
  return {
    attempt: a,
    courseCode: course?.code ?? "",
    items,
    topics: topicBreakdown(items.map((i) => ({ topicId: i.question.topicId, topicName: i.question.topicName, isCorrect: i.isCorrect }))),
    timeSec: timeUsedSec(a),
    prevBest,
  };
}

/** Starts the same kind of mock again (same settings, fresh question draw). */
export async function retake(db: Db, userId: string, attemptId: string, now = new Date()): Promise<MockAttempt> {
  const [a] = await db.select().from(mockAttempts).where(and(eq(mockAttempts.id, attemptId), eq(mockAttempts.userId, userId)));
  if (!a) throw new ExamError("Mock not found.");
  if (a.mode === "challenge") throw new ExamError("Challenges can only be taken once.");
  if (a.mode === "practice") return startAttempt(db, userId, { mode: "practice", courseId: a.courseId, topicIds: a.config?.topicIds ?? [] }, now);
  return startAttempt(db, userId, { mode: "mock", courseId: a.courseId, config: a.config ?? { count: a.questionIds.length, timeLimitSec: a.durationSec, topicIds: [], difficulty: "mixed", bankId: null } }, now);
}

export type { AttemptMode };
