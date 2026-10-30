import { beforeAll, describe, expect, it } from "vitest";
import { and, eq } from "drizzle-orm";
import { createPgliteDb, type Db } from "@/db";
import { challenges, enrollments, leaderboardEntries, mockAttempts, topicMastery, users, type MockAttempt } from "@/db/schema";
import { DEMO_USER_ID, seed } from "@/db/seed";
import { markResponse } from "@/lib/exam-engine/rules";
import {
  answerPractice,
  buildPayload,
  ExamError,
  getResult,
  inProgressAttempt,
  retake,
  startAttempt,
  syncAttempt,
  weakestTopics,
} from "@/lib/exam-engine/service";
import type { AttemptResponse, QuestionSnapshot } from "@/lib/exam-engine/types";

const NOW = new Date("2026-10-16T18:05:00Z");
const at = (ms: number) => new Date(NOW.getTime() + ms);
const MIN = 60_000;
let db: Db;

beforeAll(async () => {
  db = await createPgliteDb();
  await seed(db, NOW);
});

const config = (over: Partial<{ count: number; timeLimitSec: number | null; topicIds: string[] }> = {}) => ({
  count: 30,
  timeLimitSec: 25 * 60,
  topicIds: [],
  difficulty: "mixed" as const,
  bankId: null,
  ...over,
});

/** The right (or a wrong) response for a frozen question. */
function respond(q: QuestionSnapshot, right: boolean): AttemptResponse {
  const a = q.answer;
  if (a.kind === "single") return { kind: "choice", optionIds: [right ? a.correct : q.options.find((o) => o.id !== a.correct)!.id] };
  if (a.kind === "multiple") return { kind: "choice", optionIds: right ? a.correct : [q.options.find((o) => !a.correct.includes(o.id))!.id] };
  if (a.kind === "true_false") return { kind: "bool", value: right ? a.correct : !a.correct };
  return { kind: "text", text: right && a.kind === "fill_in" ? a.accepted[0] : "definitely wrong" };
}

async function fresh(id: string) {
  return (await db.select().from(mockAttempts).where(eq(mockAttempts.id, id)))[0];
}

describe("starting a mock", () => {
  it("freezes 30 questions, sets the deadline, and sends no answers to the device", async () => {
    const a = await startAttempt(db, DEMO_USER_ID, { mode: "mock", courseId: "crs-gst111", config: config() }, NOW);
    expect(a.snapshot).toHaveLength(30);
    expect(new Set(a.questionIds).size).toBe(30);
    expect(a.endsAt?.toISOString()).toBe(at(25 * MIN).toISOString());
    const payload = await buildPayload(db, a, "GST111", NOW);
    const wire = JSON.stringify(payload);
    expect(wire).not.toContain('"correct"');
    expect(wire).not.toContain('"accepted"');
    expect(wire).not.toContain("explanation");
    expect(payload.questions).toHaveLength(30);
    expect(payload.title).toBe("GST 111 · Mock");
    expect(await inProgressAttempt(db, DEMO_USER_ID, NOW)).toMatchObject({ id: a.id });
  });

  it("filters by topic and refuses courses the student hasn't added", async () => {
    const [concord] = (await startAttempt(db, DEMO_USER_ID, { mode: "practice", courseId: "crs-gst111", topicIds: [] }, NOW)).snapshot;
    const t = await startAttempt(db, DEMO_USER_ID, { mode: "mock", courseId: "crs-gst111", config: config({ count: 50, topicIds: [concord.topicId!] }) }, NOW);
    expect(t.snapshot).toHaveLength(10); // only 10 in that topic
    expect(t.snapshot.every((q) => q.topicId === concord.topicId)).toBe(true);
    await expect(startAttempt(db, DEMO_USER_ID, { mode: "mock", courseId: "crs-gns101", config: config() }, NOW)).rejects.toBeInstanceOf(ExamError);
  });
});

describe("sync, auto-submit at zero, and the per-topic breakdown (Milestone 2 acceptance)", () => {
  let a: MockAttempt;
  const right = new Set<string>();

  beforeAll(async () => {
    a = await startAttempt(db, DEMO_USER_ID, { mode: "mock", courseId: "crs-gst111", config: config() }, NOW);
  });

  it("keeps the newest write per question, whatever order requests arrive in", async () => {
    const q = a.snapshot[0];
    const r1 = await syncAttempt(db, DEMO_USER_ID, { attemptId: a.id, currentIndex: 0, answers: [{ id: q.id, response: respond(q, true), flagged: false, seq: 5, at: at(MIN).getTime() }] }, at(MIN));
    expect(r1).toMatchObject({ ok: true, status: "in_progress", ackSeq: 5 });
    // An older retry arrives late: ignored.
    await syncAttempt(db, DEMO_USER_ID, { attemptId: a.id, currentIndex: 0, answers: [{ id: q.id, response: respond(q, false), flagged: true, seq: 2 }] }, at(MIN + 1000));
    const payload = await buildPayload(db, await fresh(a.id), "GST111", at(2 * MIN));
    expect(payload.answers[q.id]).toMatchObject({ response: respond(q, true), flagged: false, seq: 5 });
    expect(payload.clientSeq).toBe(5);
  });

  it("works offline: answers made before the deadline count when the phone reconnects after it", async () => {
    // 20 right, 10 wrong. Questions 1–25 were answered online; 26–30 offline near the end.
    const answers = a.snapshot.map((q, i) => {
      const ok = i < 20;
      if (ok) right.add(q.id);
      return { id: q.id, response: respond(q, ok), flagged: i === 7, seq: 10 + i, at: at((i < 25 ? 5 : 24) * MIN).getTime() };
    });
    const online = await syncAttempt(db, DEMO_USER_ID, { attemptId: a.id, currentIndex: 24, answers: answers.slice(0, 25) }, at(6 * MIN));
    expect(online).toMatchObject({ ok: true, status: "in_progress" });
    // One more answer made after time ran out (stamped late) must not count.
    const tooLate = { id: a.snapshot[29].id, response: respond(a.snapshot[29], false), flagged: false, seq: 99, at: at(25 * MIN + 30_000).getTime() };
    // Back online 3 minutes after the deadline (within the mock grace). The timer had hit zero, so the device asks to submit.
    const back = await syncAttempt(db, DEMO_USER_ID, { attemptId: a.id, currentIndex: 29, answers: [...answers.slice(25, 29), tooLate], submit: true }, at(28 * MIN));
    expect(back).toMatchObject({ ok: true, status: "submitted", summary: { score: 20, max: 30, reason: "timeout" } });
    const done = await fresh(a.id);
    expect(done.status).toBe("auto_submitted");
    expect(done.submittedAt?.toISOString()).toBe(at(25 * MIN).toISOString()); // server end time is final
    expect(done.answeredCount).toBe(29); // q30's late answer was dropped
  });

  it("shows a correct per-topic breakdown", async () => {
    const r = (await getResult(db, DEMO_USER_ID, a.id, at(30 * MIN)))!;
    expect(r.items).toHaveLength(30);
    expect(r.timeSec).toBe(25 * 60);
    expect(r.topics.reduce((s, t) => s + t.total, 0)).toBe(30);
    expect(r.topics.reduce((s, t) => s + t.correct, 0)).toBe(20);
    for (const t of r.topics) {
      const inTopic = a.snapshot.filter((q) => (q.topicId ?? null) === t.topicId);
      expect(t.total).toBe(inTopic.length);
      expect(t.correct).toBe(inTopic.filter((q) => right.has(q.id)).length);
    }
    // Weakest first
    const ratios = r.topics.map((t) => t.correct / t.total);
    expect([...ratios].sort((x, y) => x - y)).toEqual(ratios);
    // Each item's marking agrees with the rules
    for (const it of r.items) expect(it.isCorrect).toBe(markResponse(it.question, it.response).isCorrect);
  });

  it("updates the weekly leaderboard, XP, streak and topic mastery once", async () => {
    const [entry] = await db
      .select()
      .from(leaderboardEntries)
      .where(and(eq(leaderboardEntries.userId, DEMO_USER_ID), eq(leaderboardEntries.courseId, "crs-gst111"), eq(leaderboardEntries.weekStart, "2026-10-12")));
    expect(entry).toMatchObject({ score: 24, mocks: 7 }); // seeded best was 24/30; 20/30 counts as a mock but isn't better
    const [u] = await db.select().from(users).where(eq(users.id, DEMO_USER_ID));
    expect(u.xp).toBe(1240 + 20 + 4 * 20);
    expect(u.streakDays).toBe(6); // already studied today
    const mastery = await db.select().from(topicMastery).where(eq(topicMastery.userId, DEMO_USER_ID));
    expect(mastery.length).toBeGreaterThan(0);
    // Submitting again changes nothing
    await syncAttempt(db, DEMO_USER_ID, { attemptId: a.id, currentIndex: 0, answers: [], submit: true }, at(40 * MIN));
    expect((await db.select().from(users).where(eq(users.id, DEMO_USER_ID)))[0].xp).toBe(u.xp);
  });

  it("finishes a forgotten mock on its own after the grace, and keeps late answers aside", async () => {
    const b = await startAttempt(db, DEMO_USER_ID, { mode: "mock", courseId: "crs-mth101", config: config({ count: 10, timeLimitSec: 15 * 60 }) }, NOW);
    const q = b.snapshot[0];
    const res = await syncAttempt(db, DEMO_USER_ID, { attemptId: b.id, currentIndex: 0, answers: [{ id: q.id, response: respond(q, true), flagged: false, seq: 1, at: at(MIN).getTime() }] }, at(40 * MIN));
    expect(res).toMatchObject({ ok: true, status: "submitted", lateCount: 1, summary: { score: 0, reason: "timeout" } });
    expect((await fresh(b.id)).lateAnswers).toHaveLength(1);
  });

  it("retakes with the same settings", async () => {
    const again = await retake(db, DEMO_USER_ID, a.id, at(50 * MIN));
    expect(again.id).not.toBe(a.id);
    expect(again.snapshot).toHaveLength(30);
    expect(again.durationSec).toBe(25 * 60);
  });
});

describe("challenges", () => {
  it("gives everyone the same questions, once, capped at the window, and ranks them", async () => {
    await db.insert(challenges).values({ id: "chl-live", courseId: "crs-gst111", title: "Live Challenge", questionCount: 20, durationSec: 20 * 60, startsAt: at(-MIN), endsAt: at(10 * MIN) });
    await expect(startAttempt(db, DEMO_USER_ID, { mode: "challenge", challengeId: "chl-gst111-next" }, NOW)).rejects.toThrow("hasn't started");
    const mine = await startAttempt(db, DEMO_USER_ID, { mode: "challenge", challengeId: "chl-live" }, NOW);
    const theirs = await startAttempt(db, "peer-001", { mode: "challenge", challengeId: "chl-live" }, NOW);
    expect(mine.snapshot).toHaveLength(20);
    expect([...mine.questionIds].sort()).toEqual([...theirs.questionIds].sort());
    expect(mine.endsAt?.toISOString()).toBe(at(10 * MIN).toISOString()); // window closes before 20 min are up
    expect((await startAttempt(db, DEMO_USER_ID, { mode: "challenge", challengeId: "chl-live" }, at(MIN))).id).toBe(mine.id);
    const answers = mine.snapshot.map((q, i) => ({ id: q.id, response: respond(q, i < 15), flagged: false, seq: i + 1, at: at(2 * MIN).getTime() }));
    await syncAttempt(db, DEMO_USER_ID, { attemptId: mine.id, currentIndex: 0, answers, submit: true }, at(3 * MIN));
    const [entry] = await db.select().from(leaderboardEntries).where(and(eq(leaderboardEntries.challengeId, "chl-live"), eq(leaderboardEntries.userId, DEMO_USER_ID)));
    expect(entry).toMatchObject({ score: 15, maxScore: 20, timeSec: 180 });
  });
});

describe("practice", () => {
  it("gives instant feedback, keeps the first answer, and updates mastery", async () => {
    const p = await startAttempt(db, DEMO_USER_ID, { mode: "practice", courseId: "crs-chm101", topicIds: [] }, NOW);
    expect(p.snapshot).toHaveLength(10);
    expect(p.endsAt).toBeNull();
    const q = p.snapshot.find((x) => x.type === "single")!;
    const wrong = await answerPractice(db, DEMO_USER_ID, p.id, q.id, respond(q, false), NOW);
    expect(wrong).toMatchObject({ isCorrect: false, correctOptionIds: [q.answer.kind === "single" ? q.answer.correct : ""] });
    expect(wrong.explanation).toBeTruthy();
    const second = await answerPractice(db, DEMO_USER_ID, p.id, q.id, respond(q, true), NOW);
    expect(second.isCorrect).toBe(false);
    const [m] = await db.select().from(topicMastery).where(and(eq(topicMastery.userId, DEMO_USER_ID), eq(topicMastery.topicId, q.topicId!)));
    expect(m).toMatchObject({ correct: 0, total: 1, masteryScore: 0 });
  });

  it("finds the weakest topics to fix first", async () => {
    const weak = await weakestTopics(db, DEMO_USER_ID, "crs-chm101");
    expect(weak).toHaveLength(3);
    expect(weak[0].score).toBe(0);
  });
});

describe("referrals", () => {
  it("gives the inviter a free Week Pass when 3 invited classmates finish a mock", async () => {
    // Tolu already has 1 qualifying referral (peer-001). Two more join and finish mocks.
    for (const id of ["ref-1", "ref-2"]) {
      await db.insert(users).values({ id, email: `${id}@example.com`, referredById: DEMO_USER_ID, schoolId: "sch-unilag" });
      await db.insert(enrollments).values({ userId: id, courseId: "crs-gst111" });
    }
    const before = (await db.select().from(users).where(eq(users.id, DEMO_USER_ID)))[0];
    for (const id of ["ref-1", "ref-2"]) {
      const m = await startAttempt(db, id, { mode: "mock", courseId: "crs-gst111", config: config({ count: 10 }) }, NOW);
      await syncAttempt(db, id, { attemptId: m.id, currentIndex: 0, answers: [], submit: true }, at(MIN));
    }
    const after = (await db.select().from(users).where(eq(users.id, DEMO_USER_ID)))[0];
    expect(after.referralRewards).toBe(before.referralRewards + 1);
    expect(after.proUntil?.toISOString()).toBe(at(MIN + 7 * 24 * 60 * MIN).toISOString());
  });
});
