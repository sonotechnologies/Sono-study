/** Ported from SonoCBT (lib/exams/rules.test.ts, local.test.ts, questions/model.test.ts) and adapted. */
import { describe, expect, it } from "vitest";
import {
  answeredInTime,
  attemptDeadline,
  buildOptionOrder,
  checkFillIn,
  isOverdue,
  markResponse,
  parseNumber,
  scoreMultiAnswer,
  seededRandom,
  shuffle,
  SYNC_GRACE_MS,
  validResponse,
} from "@/lib/exam-engine/rules";
import { mergeState, pendingAnswers, secondsLeft, withAnswer, type LocalState } from "@/lib/exam-engine/local";
import { resultLine, topicBreakdown, topicsToFix, xpFor } from "@/lib/exam-engine/results";
import type { QuestionSnapshot, RuntimePayload } from "@/lib/exam-engine/types";
import { masteryLabel, masteryScore } from "@/lib/mastery";
import { nextStreak } from "@/lib/streak";

const opts = ["a", "b", "c", "d"].map((id) => ({ id, text: id.toUpperCase() }));
const q = (over: Partial<QuestionSnapshot>): QuestionSnapshot => ({
  id: "q",
  type: "single",
  stem: "?",
  options: opts,
  answer: { kind: "single", correct: "b" },
  explanation: null,
  topicId: "t",
  topicName: "T",
  sourceLabel: null,
  isPastQuestion: false,
  ...over,
});

describe("seeded order", () => {
  it("is the same for the same seed and differs between students", () => {
    const items = Array.from({ length: 20 }, (_, i) => i);
    expect(shuffle(items, seededRandom("s1"))).toEqual(shuffle(items, seededRandom("s1")));
    expect(shuffle(items, seededRandom("s1"))).not.toEqual(shuffle(items, seededRandom("s2")));
    expect([...shuffle(items, seededRandom("s1"))].sort((a, b) => a - b)).toEqual(items);
  });

  it("shuffles options but never True/False, and not at all when switched off", () => {
    const qs = [
      ...Array.from({ length: 8 }, (_, i) => ({ id: `m${i}`, type: "single" as const, optionIds: ["a", "b", "c", "d"] })),
      { id: "tf", type: "true_false" as const, optionIds: ["true", "false"] },
    ];
    const on = buildOptionOrder(qs, true, "x");
    expect(Object.values(on).some((o) => o.join("") !== "abcd" && o.length === 4)).toBe(true);
    expect(on.tf).toEqual(["true", "false"]);
    expect(Object.values(buildOptionOrder(qs, false, "x")).every((o) => o.join("") === "abcd" || o.join(",") === "true,false")).toBe(true);
  });
});

describe("time", () => {
  const start = new Date("2026-10-16T09:00:00Z");
  it("sets the deadline from the duration, capped by a challenge window", () => {
    expect(attemptDeadline(start, 25 * 60)?.toISOString()).toBe("2026-10-16T09:25:00.000Z");
    expect(attemptDeadline(start, 25 * 60, new Date("2026-10-16T09:10:00Z"))?.toISOString()).toBe("2026-10-16T09:10:00.000Z");
    expect(attemptDeadline(start, null)).toBeNull();
  });

  it("finishes overdue attempts after the mode's grace", () => {
    const d = new Date("2026-10-16T09:25:00Z");
    expect(isOverdue(d, "challenge", new Date(d.getTime() + SYNC_GRACE_MS.challenge - 1))).toBe(false);
    expect(isOverdue(d, "challenge", new Date(d.getTime() + SYNC_GRACE_MS.challenge + 1))).toBe(true);
    expect(isOverdue(d, "mock", new Date(d.getTime() + 5 * 60_000))).toBe(false);
    expect(isOverdue(d, "mock", new Date(d.getTime() + 11 * 60_000))).toBe(true);
    expect(isOverdue(null, "practice", new Date("2030-01-01"))).toBe(false);
  });

  it("after the deadline, only counts answers stamped before it", () => {
    const d = new Date("2026-10-16T09:25:00Z");
    const before = new Date(d.getTime() - 1000);
    const after = new Date(d.getTime() + 60_000);
    expect(answeredInTime(undefined, d, before)).toBe(true);
    expect(answeredInTime(d.getTime() - 30_000, d, after)).toBe(true);
    expect(answeredInTime(d.getTime() + 3_000, d, after)).toBe(true); // clock skew
    expect(answeredInTime(d.getTime() + 30_000, d, after)).toBe(false);
    expect(answeredInTime(undefined, d, after)).toBe(false);
  });
});

describe("marking", () => {
  it("marks single choice", () => {
    expect(markResponse(q({}), { kind: "choice", optionIds: ["b"] })).toEqual({ isCorrect: true, marksAwarded: 1 });
    expect(markResponse(q({}), { kind: "choice", optionIds: ["a"] })).toEqual({ isCorrect: false, marksAwarded: 0 });
    expect(markResponse(q({}), null)).toEqual({ isCorrect: false, marksAwarded: 0 });
  });

  it("marks multiple answer, all-or-nothing and partial", () => {
    const aon = q({ type: "multiple", answer: { kind: "multiple", correct: ["a", "c"], scoring: "all_or_nothing" } });
    const partial = q({ type: "multiple", answer: { kind: "multiple", correct: ["a", "c"], scoring: "partial" } });
    expect(markResponse(aon, { kind: "choice", optionIds: ["c", "a"] }).marksAwarded).toBe(1);
    expect(markResponse(aon, { kind: "choice", optionIds: ["a"] }).marksAwarded).toBe(0);
    expect(markResponse(partial, { kind: "choice", optionIds: ["a"] })).toEqual({ isCorrect: false, marksAwarded: 0.5 });
    expect(scoreMultiAnswer(["a", "b"], ["a", "c"], "partial", 2)).toBe(0);
  });

  it("marks true/false and fill-in", () => {
    expect(markResponse(q({ type: "true_false", options: [], answer: { kind: "true_false", correct: false } }), { kind: "bool", value: false }).marksAwarded).toBe(1);
    const gap = q({ type: "fill_in", options: [], answer: { kind: "fill_in", accepted: ["newton", "N"], caseSensitive: false } });
    expect(markResponse(gap, { kind: "text", text: " Newton. " }).marksAwarded).toBe(1);
    expect(markResponse(gap, { kind: "text", text: "joule" }).marksAwarded).toBe(0);
    expect(checkFillIn("1/2", { accepted: ["0.5"], caseSensitive: false })).toBe(true);
    expect(checkFillIn("", { accepted: [""], caseSensitive: false })).toBe(false);
    expect(parseNumber("1 1/2")).toBe(1.5);
    expect(parseNumber("1,000")).toBe(1000);
    expect(parseNumber("abc")).toBeNull();
  });

  it("rejects responses that don't fit the question", () => {
    expect(validResponse(q({}), { kind: "choice", optionIds: ["b"] })).toBe(true);
    expect(validResponse(q({}), { kind: "choice", optionIds: ["b", "c"] })).toBe(false);
    expect(validResponse(q({}), { kind: "choice", optionIds: ["zz"] })).toBe(false);
    expect(validResponse(q({}), { kind: "text", text: "b" })).toBe(false);
    expect(validResponse(q({ type: "fill_in", options: [] }), { kind: "text", text: "x".repeat(201) })).toBe(false);
    expect(validResponse(q({}), null)).toBe(true);
  });
});

const pick = (id: string) => ({ kind: "choice" as const, optionIds: [id] });
const payload = (over: Partial<RuntimePayload> = {}): RuntimePayload => ({
  attemptId: "att-1",
  mode: "mock",
  title: "GST 111 · Mock",
  courseCode: "GST111",
  syncUrl: "/sync",
  resultsUrl: "/results",
  exitUrl: "/home",
  questions: ["q1", "q2", "q3"].map((id) => ({ id, type: "single" as const, stem: "", options: [], topicName: null })),
  answers: { q1: { response: pick("a"), flagged: false, seq: 3 } },
  currentIndex: 1,
  clientSeq: 3,
  deadlineAt: 1_000_000,
  durationSec: 1500,
  serverNow: 400_000,
  done: null,
  ...over,
});

describe("device state", () => {
  it("starts from the page on a fresh device", () => {
    const s = mergeState(payload(), null, 100_000);
    expect(s).toMatchObject({ seq: 3, acked: 3, currentIndex: 1, offset: 300_000, deadlineAt: 1_000_000 });
    expect(pendingAnswers(s)).toEqual([]);
  });

  it("keeps offline answers when the page reloads, stamped on the server clock, still pending", () => {
    let local = mergeState(payload(), null, 100_000);
    local = withAnswer(local, "q1", { response: pick("b") }, 110_000);
    local = withAnswer(local, "q2", { response: pick("c"), flagged: true }, 120_000);
    local = { ...local, currentIndex: 2 };
    const s = mergeState(payload({ serverNow: 460_000 }), local, 160_000);
    expect(s.answers.q1).toMatchObject({ response: pick("b"), at: 410_000 });
    expect(s.answers.q2).toMatchObject({ response: pick("c"), flagged: true, seq: 5, at: 420_000 });
    expect(s.currentIndex).toBe(2);
    expect(pendingAnswers(s).map((a) => a.id).sort()).toEqual(["q1", "q2"]);
  });

  it("lets a newer answer from another device win", () => {
    const local: LocalState = { ...mergeState(payload(), null, 0), answers: { q1: { response: pick("a"), flagged: false, seq: 3 } } };
    const s = mergeState(payload({ answers: { q1: { response: pick("d"), flagged: false, seq: 9 } }, clientSeq: 9, currentIndex: 2 }), local, 0);
    expect(s.answers.q1.response).toEqual(pick("d"));
    expect(s.seq).toBe(9);
    expect(s.currentIndex).toBe(2);
  });

  it("keeps the trusted clock when the page came from the offline cache", () => {
    const local = { ...mergeState(payload(), null, 0), offset: 300_000, seenServerNow: 700_000 };
    const cached = mergeState(payload({ serverNow: 400_000 }), local, 450_000);
    expect(cached.offset).toBe(300_000);
    expect(secondsLeft(cached, 450_000)).toBe(250);
  });

  it("never shows negative time, and untimed has no clock", () => {
    expect(secondsLeft({ deadlineAt: 1000, offset: 0 }, 5000)).toBe(0);
    expect(secondsLeft({ deadlineAt: null, offset: 0 }, 5000)).toBeNull();
  });
});

describe("results", () => {
  it("breaks scores down by topic, weakest first", () => {
    const items = [
      ...Array.from({ length: 6 }, (_, i) => ({ topicId: "c", topicName: "Concord", isCorrect: i < 5 })),
      ...Array.from({ length: 6 }, (_, i) => ({ topicId: "p", topicName: "Punctuation", isCorrect: i < 1 })),
      ...Array.from({ length: 3 }, () => ({ topicId: "l", topicName: "Library use", isCorrect: true })),
    ];
    const t = topicBreakdown(items);
    expect(t.map((x) => [x.name, x.correct, x.total, x.label])).toEqual([
      ["Punctuation", 1, 6, "weak"],
      ["Concord", 5, 6, "good"],
      ["Library use", 3, 3, "mastered"],
    ]);
    expect(topicsToFix(t).map((x) => x.name)).toEqual(["Punctuation"]);
  });

  it("writes the result line by the copy rules", () => {
    expect(resultLine({ score: 30, max: 30, prevBest: 20, weakTopics: 0 })).toBe("Full marks. Your future self says thanks.");
    expect(resultLine({ score: 24, max: 30, prevBest: 18, weakTopics: 2 })).toBe("New best, up 6 on your last try. That's the work paying off.");
    expect(resultLine({ score: 14, max: 30, prevBest: 20, weakTopics: 3 })).toBe("Now we know where to focus — 3 topics to fix first.");
    expect(resultLine({ score: 25, max: 30, prevBest: null, weakTopics: 0 })).toBe("Solid run. Review the misses and go again.");
  });

  it("awards XP", () => {
    expect(xpFor("mock", 14)).toBe(76);
    expect(xpFor("practice", 7)).toBe(14);
    expect(xpFor("mock", 13.5)).toBe(72);
  });
});

describe("mastery", () => {
  it("labels ratios on the design's scale", () => {
    expect([0, 0.33, 0.34, 0.59, 0.6, 0.99, 1].map(masteryLabel)).toEqual(["weak", "weak", "shaky", "shaky", "good", "good", "mastered"]);
  });

  it("weights the latest 20 answers, newest most", () => {
    expect(masteryScore([])).toBe(0);
    expect(masteryScore(Array(25).fill(true))).toBe(1);
    // Got better recently: 10 right then (older) 10 wrong → above 50%
    expect(masteryScore([...Array(10).fill(true), ...Array(10).fill(false)])).toBeGreaterThan(0.7);
    // Older answers beyond 20 don't count
    expect(masteryScore([...Array(20).fill(true), ...Array(30).fill(false)])).toBe(1);
  });
});

describe("streak", () => {
  it("continues, holds, or resets by Lagos day", () => {
    expect(nextStreak({ streakDays: 5, lastActiveDate: "2026-10-15" }, "2026-10-16")).toEqual({ streakDays: 6, lastActiveDate: "2026-10-16" });
    expect(nextStreak({ streakDays: 6, lastActiveDate: "2026-10-16" }, "2026-10-16")).toEqual({ streakDays: 6, lastActiveDate: "2026-10-16" });
    expect(nextStreak({ streakDays: 6, lastActiveDate: "2026-10-13" }, "2026-10-16")).toEqual({ streakDays: 1, lastActiveDate: "2026-10-16" });
    expect(nextStreak({ streakDays: 0, lastActiveDate: null }, "2026-10-16")).toEqual({ streakDays: 1, lastActiveDate: "2026-10-16" });
    expect(nextStreak({ streakDays: 3, lastActiveDate: "2026-02-28" }, "2026-03-01")).toEqual({ streakDays: 4, lastActiveDate: "2026-03-01" });
  });
});

describe("sample question bank", () => {
  it("has 300 well-formed questions, 60 per course, with explanations", async () => {
    const { QUESTION_BANK, toRow } = await import("@/db/question-bank");
    const all = Object.entries(QUESTION_BANK);
    expect(all.map(([, qs]) => qs.length)).toEqual([60, 60, 60, 60, 60]);
    for (const [code, qs] of all) {
      qs.forEach((q, i) => expect(() => toRow(q, `${code} #${i + 1}`)).not.toThrow());
      expect(new Set(qs.map((q) => q.stem)).size).toBe(qs.length);
      expect(new Set(qs.map((q) => q.topic)).size).toBe(6);
    }
  });
});
