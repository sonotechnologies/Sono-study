/**
 * Exam engine wire format, ported from SonoCBT (lib/exams/runtime-types.ts)
 * and trimmed for Sono Study: no sections, passages, PINs or invigilation.
 * Shared by server and client; nothing the client receives may reveal an answer.
 */

export type QuestionType = "single" | "multiple" | "true_false" | "fill_in";

/** Answer key, stored on the question and snapshotted into the attempt. Server only. */
export type AnswerKey =
  | { kind: "single"; correct: string }
  | { kind: "multiple"; correct: string[]; scoring: "all_or_nothing" | "partial" }
  | { kind: "true_false"; correct: boolean }
  | { kind: "fill_in"; accepted: string[]; caseSensitive: boolean };

export type QuestionOption = { id: string; text: string };

/** What an attempt freezes at start, so later edits never change a mock in progress. Server only. */
export type QuestionSnapshot = {
  id: string;
  type: QuestionType;
  stem: string;
  options: QuestionOption[];
  answer: AnswerKey;
  explanation: string | null;
  topicId: string | null;
  topicName: string | null;
  sourceLabel: string | null;
  isPastQuestion: boolean;
};

export type AttemptResponse =
  | { kind: "choice"; optionIds: string[] }
  | { kind: "bool"; value: boolean }
  | { kind: "text"; text: string };

/** A question as the student sees it during a mock: in their order, never with the answer. */
export type RuntimeQuestion = {
  id: string;
  type: QuestionType;
  stem: string;
  /** In this student's order. True/false uses ids "true" and "false". */
  options: QuestionOption[];
  topicName: string | null;
};

export type RuntimeAnswer = { response: AttemptResponse | null; flagged: boolean; seq: number; at?: number };

export type AttemptMode = "mock" | "practice" | "challenge";

export type RuntimePayload = {
  attemptId: string;
  mode: AttemptMode;
  title: string;
  courseCode: string;
  syncUrl: string;
  resultsUrl: string;
  exitUrl: string;
  questions: RuntimeQuestion[];
  answers: Record<string, RuntimeAnswer>;
  currentIndex: number;
  clientSeq: number;
  /** null = untimed. */
  deadlineAt: number | null;
  durationSec: number | null;
  serverNow: number;
  /** Set when the attempt is already finished (reopened after submitting). */
  done: SubmitSummary | null;
};

/** `at`: when it was answered, on the server's clock as the device best knows it. */
export type SyncAnswer = { id: string; response: AttemptResponse | null; flagged: boolean; seq: number; at?: number };

export type SyncRequest = {
  attemptId: string;
  currentIndex: number;
  answers: SyncAnswer[];
  submit?: boolean;
};

export type SubmitReason = "student" | "timeout";

export type SubmitSummary = {
  submittedAt: number;
  answered: number;
  total: number;
  score: number;
  max: number;
  reason: SubmitReason;
};

export type SyncResponse =
  | { ok: true; status: "in_progress"; serverNow: number; deadlineAt: number | null; ackSeq: number }
  | { ok: true; status: "submitted"; serverNow: number; summary: SubmitSummary; ackSeq: number; lateCount: number }
  | { ok: false; error: string };
