/**
 * Pure exam rules: per-student order, deadlines, response validation and
 * marking. Ported from SonoCBT lib/exams/rules.ts + lib/questions/model.ts.
 * No I/O, so they are unit-tested directly and shared by server code.
 */
import type { AnswerKey, AttemptMode, AttemptResponse, QuestionSnapshot, QuestionType } from "./types";

// ─── Seeded order ────────────────────────────────────────────────────────────

/** Small, fast PRNG (mulberry32) seeded from a string: same seed → same order, on any machine. */
export function seededRandom(seed: string): () => number {
  let h = 1779033703 ^ seed.length;
  for (let i = 0; i < seed.length; i++) {
    h = Math.imul(h ^ seed.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  let a = h >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function shuffle<T>(list: readonly T[], rand: () => number): T[] {
  const out = [...list];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/** Option order per question. True/false keeps True before False. */
export function buildOptionOrder(
  questions: { id: string; type: QuestionType; optionIds: string[] }[],
  shuffleOptions: boolean,
  seed: string,
): Record<string, string[]> {
  const rand = seededRandom(`${seed}:options`);
  const out: Record<string, string[]> = {};
  for (const q of questions) {
    if (!q.optionIds.length) continue;
    out[q.id] = shuffleOptions && q.type !== "true_false" ? shuffle(q.optionIds, rand) : [...q.optionIds];
  }
  return out;
}

// ─── Time ────────────────────────────────────────────────────────────────────

/**
 * How long after the deadline answers made before it are still accepted.
 * Challenges rank students against each other, so they keep SonoCBT's strict
 * grace for in-flight answers. Mocks are self-practice: a phone that lost data
 * near the end still gets its pre-deadline answers counted when it reconnects.
 */
export const SYNC_GRACE_MS: Record<AttemptMode, number> = {
  challenge: 90_000,
  mock: 10 * 60_000,
  practice: 0,
};

/** Allowance for device clocks that run a little fast when stamping answers. */
export const CLOCK_SKEW_MS = 5_000;

/** deadline = min(start + duration, window end). Untimed → null. */
export function attemptDeadline(startedAt: Date, durationSec: number | null, windowEnd?: Date | null): Date | null {
  if (!durationSec) return null;
  const natural = startedAt.getTime() + durationSec * 1000;
  return new Date(windowEnd ? Math.min(natural, windowEnd.getTime()) : natural);
}

/** Past the deadline and past the grace: the server finishes the attempt itself. */
export function isOverdue(deadlineAt: Date | null, mode: AttemptMode, now: Date): boolean {
  return deadlineAt !== null && now.getTime() > deadlineAt.getTime() + SYNC_GRACE_MS[mode];
}

/** After the deadline, only answers stamped before it count. */
export function answeredInTime(at: number | undefined, deadlineAt: Date | null, now: Date): boolean {
  if (!deadlineAt || now.getTime() <= deadlineAt.getTime()) return true;
  return typeof at === "number" && at <= deadlineAt.getTime() + CLOCK_SKEW_MS;
}

// ─── Responses & marking ─────────────────────────────────────────────────────

export function isAnswered(r: AttemptResponse | null | undefined): boolean {
  if (!r) return false;
  if (r.kind === "choice") return r.optionIds.length > 0;
  if (r.kind === "text") return r.text.trim().length > 0;
  return true;
}

/** A response is only kept if it fits the question it's for. */
export function validResponse(q: Pick<QuestionSnapshot, "type" | "options">, r: AttemptResponse | null): boolean {
  if (r === null) return true;
  switch (q.type) {
    case "single":
      return r.kind === "choice" && r.optionIds.length <= 1 && r.optionIds.every((id) => q.options.some((o) => o.id === id));
    case "multiple":
      return r.kind === "choice" && new Set(r.optionIds).size === r.optionIds.length && r.optionIds.every((id) => q.options.some((o) => o.id === id));
    case "true_false":
      return r.kind === "bool";
    case "fill_in":
      return r.kind === "text" && r.text.length <= 200;
  }
}

/** "0.5", "1/2", "1 1/2", "-3", "1,000", "½" → number; null if not a number. */
export function parseNumber(input: string): number | null {
  const s = input.trim().replace(/,/g, "").replace(/\s+/g, " ");
  if (!s) return null;
  const unicode: Record<string, number> = { "½": 0.5, "¼": 0.25, "¾": 0.75, "⅓": 1 / 3, "⅔": 2 / 3 };
  if (s in unicode) return unicode[s];
  if (/^[-+]?(\d+\.?\d*|\.\d+)(e[-+]?\d+)?$/i.test(s)) return Number(s);
  const frac = /^([-+]?)(?:(\d+) )?(\d+)\/(\d+)$/.exec(s);
  if (frac) {
    const [, sign, whole, num, den] = frac;
    if (Number(den) === 0) return null;
    const v = Number(whole ?? 0) + Number(num) / Number(den);
    return sign === "-" ? -v : v;
  }
  return null;
}

/** Fill-in: case/spacing/trailing full stop don't matter; numbers compare by value ("0.5" = "1/2"). */
export function checkFillIn(response: string, answer: { accepted: string[]; caseSensitive: boolean }): boolean {
  const norm = (s: string) => {
    const t = s.trim().replace(/\s+/g, " ").replace(/[.!]$/, "");
    return answer.caseSensitive ? t : t.toLowerCase();
  };
  const r = norm(response);
  if (!r) return false;
  const asNumber = parseNumber(r);
  return answer.accepted.some((a) => {
    if (norm(a) === r) return true;
    const n = parseNumber(a);
    return n !== null && asNumber !== null && Math.abs(n - asNumber) < 1e-9;
  });
}

/** Marks for a multiple-answer question. Partial: +1 per right choice, −1 per wrong, never below 0. */
export function scoreMultiAnswer(selected: string[], correct: string[], scoring: "all_or_nothing" | "partial", marks: number): number {
  const sel = new Set(selected);
  const right = correct.filter((c) => sel.has(c)).length;
  const wrong = [...sel].filter((s) => !correct.includes(s)).length;
  if (scoring === "all_or_nothing") return right === correct.length && wrong === 0 ? marks : 0;
  return Math.max(0, Math.round(((right - wrong) / correct.length) * marks * 100) / 100);
}

export type Marked = { isCorrect: boolean; marksAwarded: number };

/** Server-side marking. Every question is worth one mark. An empty answer scores 0. */
export function markResponse(q: Pick<QuestionSnapshot, "answer">, r: AttemptResponse | null, marks = 1): Marked {
  if (!isAnswered(r) || !r) return { isCorrect: false, marksAwarded: 0 };
  const a: AnswerKey = q.answer;
  let got = 0;
  switch (a.kind) {
    case "single":
      got = r.kind === "choice" && r.optionIds.length === 1 && r.optionIds[0] === a.correct ? marks : 0;
      break;
    case "multiple":
      got = r.kind === "choice" ? scoreMultiAnswer(r.optionIds, a.correct, a.scoring, marks) : 0;
      break;
    case "true_false":
      got = r.kind === "bool" && r.value === a.correct ? marks : 0;
      break;
    case "fill_in":
      got = r.kind === "text" && checkFillIn(r.text, a) ? marks : 0;
      break;
  }
  return { isCorrect: got >= marks, marksAwarded: got };
}

/** The correct response, for review screens (never sent during a mock). */
export function correctOptionIds(a: AnswerKey): string[] {
  if (a.kind === "single") return [a.correct];
  if (a.kind === "multiple") return a.correct;
  if (a.kind === "true_false") return [a.correct ? "true" : "false"];
  return [];
}
