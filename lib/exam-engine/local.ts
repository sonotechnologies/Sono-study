/**
 * Device-side mock state: how answers kept on the phone are merged with what
 * the server sent, which ones still need sending, and which clock to trust.
 * Ported from SonoCBT lib/exams/local.ts. Pure and tiny: ships in the runtime bundle.
 */
import type { RuntimeAnswer, RuntimePayload, SubmitSummary, SyncAnswer } from "./types";

export type LocalState = {
  attemptId: string;
  answers: Record<string, RuntimeAnswer>;
  currentIndex: number;
  /** Highest sequence number issued on this device. */
  seq: number;
  /** Highest sequence number the server has confirmed. */
  acked: number;
  /** serverTime − deviceTime at the last contact. */
  offset: number;
  /** Latest server time seen, to spot a page served from the offline cache. */
  seenServerNow: number;
  deadlineAt: number | null;
  /** Server time of the last confirmed save. */
  savedAt: number | null;
  /** The student (or the clock) asked to submit; keep trying until the server confirms. */
  submitting: "student" | "timeout" | null;
  done: SubmitSummary | null;
};

/**
 * Combines the page's data with what this device kept. For each question the
 * newer write (higher sequence) wins, so offline answers survive a reload.
 */
export function mergeState(payload: RuntimePayload, local: LocalState | null, deviceNow: number): LocalState {
  const answers: Record<string, RuntimeAnswer> = { ...payload.answers };
  const mine = local && local.attemptId === payload.attemptId ? local : null;
  if (mine) {
    for (const [id, a] of Object.entries(mine.answers)) {
      if (!answers[id] || answers[id].seq < a.seq) answers[id] = a;
    }
  }
  const maxSeq = Object.values(answers).reduce((m, a) => Math.max(m, a.seq), 0);
  // A page from the offline cache carries an old server time; keep the clock we last trusted.
  const fresh = !mine || payload.serverNow > mine.seenServerNow;
  return {
    attemptId: payload.attemptId,
    answers,
    currentIndex: mine && mine.seq >= payload.clientSeq ? Math.min(mine.currentIndex, payload.questions.length - 1) : payload.currentIndex,
    seq: Math.max(mine?.seq ?? 0, payload.clientSeq, maxSeq),
    acked: Math.max(mine?.acked ?? 0, payload.clientSeq),
    offset: fresh ? payload.serverNow - deviceNow : mine!.offset,
    seenServerNow: fresh ? payload.serverNow : mine!.seenServerNow,
    deadlineAt: fresh ? payload.deadlineAt : mine!.deadlineAt,
    savedAt: mine?.savedAt ?? (payload.clientSeq ? payload.serverNow : null),
    submitting: payload.done ? null : (mine?.submitting ?? null),
    done: payload.done ?? mine?.done ?? null,
  };
}

/** Answers the server hasn't confirmed yet. All of them go in every request, so a lost request loses nothing. */
export function pendingAnswers(s: Pick<LocalState, "answers" | "acked">): SyncAnswer[] {
  return Object.entries(s.answers)
    .filter(([, a]) => a.seq > s.acked)
    .map(([id, a]) => ({ id, response: a.response, flagged: a.flagged, seq: a.seq, at: a.at }));
}

/** Records a change with the next sequence number, stamped on the server's clock. */
export function withAnswer(s: LocalState, id: string, change: Partial<Pick<RuntimeAnswer, "response" | "flagged">>, deviceNow: number): LocalState {
  const prev = s.answers[id] ?? { response: null, flagged: false, seq: 0 };
  const seq = s.seq + 1;
  return { ...s, seq, answers: { ...s.answers, [id]: { ...prev, ...change, seq, at: Math.round(deviceNow + s.offset) } } };
}

/** Seconds left on the server's clock (never negative). null when untimed. */
export function secondsLeft(s: Pick<LocalState, "deadlineAt" | "offset">, deviceNow: number): number | null {
  if (s.deadlineAt === null) return null;
  return Math.max(0, Math.ceil((s.deadlineAt - (deviceNow + s.offset)) / 1000));
}
