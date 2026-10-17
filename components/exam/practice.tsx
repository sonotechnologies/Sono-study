"use client";

/** Practice mode (design 2i): one question at a time, instant feedback and explanation. Untimed. */
import { useState, useTransition } from "react";
import Link from "next/link";
import { Check, ChevronLeft, X } from "lucide-react";
import { checkPracticeAnswer, finishPractice } from "@/app/mock/[attemptId]/actions";
import { buttonClass } from "@/components/ui/primitives";
import { ReportButton } from "@/components/learn/report-button";
import { cn } from "@/lib/cn";
import type { PracticeFeedback } from "@/lib/exam-engine/service";
import type { AttemptResponse, RuntimePayload, RuntimeQuestion } from "@/lib/exam-engine/types";

const LETTERS = ["A", "B", "C", "D", "E", "F"];

type Checked = { response: AttemptResponse; feedback: PracticeFeedback };

export function PracticeRuntime({ payload, topicLabel, initial, tutorHref }: { payload: RuntimePayload; topicLabel: string; initial: Record<string, Checked>; tutorHref: string }) {
  const qs = payload.questions;
  const firstOpen = qs.findIndex((q) => !initial[q.id]);
  const [index, setIndex] = useState(firstOpen === -1 ? qs.length - 1 : firstOpen);
  const [checked, setChecked] = useState<Record<string, Checked>>(initial);
  const [draft, setDraft] = useState<AttemptResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const q = qs[index];
  const done = checked[q.id];
  const isLast = index === qs.length - 1;
  // "3 in a row": correct answers in a row, counting back from the latest checked one.
  let streak = 0;
  for (let i = qs.length - 1; i >= 0; i--) {
    const c = checked[qs[i].id];
    if (!c) continue;
    if (!c.feedback.isCorrect) break;
    streak++;
  }

  function check(response: AttemptResponse) {
    setError(null);
    start(async () => {
      const res = await checkPracticeAnswer(payload.attemptId, q.id, response);
      if (!res.ok) setError(res.error);
      else setChecked((c) => ({ ...c, [q.id]: { response, feedback: res.feedback } }));
    });
  }

  function next() {
    setDraft(null);
    setError(null);
    if (isLast) start(() => finishPractice(payload.attemptId));
    else setIndex(index + 1);
  }

  const response = done?.response ?? draft;
  const needsCheck = q.type === "multiple" || q.type === "fill_in";

  return (
    <div className="mx-auto flex min-h-dvh max-w-[720px] flex-col bg-bg">
      <header className="flex h-14 items-center gap-1 pl-1 pr-4">
        <Link href={payload.exitUrl} aria-label="Back" className="grid size-12 place-items-center rounded-full hover:bg-surface-2">
          <ChevronLeft size={22} aria-hidden />
        </Link>
        <span className="flex-1 truncate text-[15px] font-semibold">Practise · {topicLabel}</span>
        {streak >= 2 && <span className="font-display text-sm font-bold text-spark">{streak} in a row</span>}
      </header>
      <div className="h-[3px] bg-surface-2" aria-hidden>
        <div className="h-full bg-accent" style={{ width: `${((index + 1) / qs.length) * 100}%` }} />
      </div>

      <main className="flex flex-1 flex-col gap-4 p-5">
        <span className="font-display text-sm font-bold text-ink-muted">
          {index + 1} of {qs.length}
        </span>
        <p className="text-[17px] leading-[1.6] [text-wrap:pretty]">{q.stem}</p>
        <Options question={q} response={response} feedback={done?.feedback ?? null} disabled={!!done || pending} onPick={(r) => (needsCheck ? setDraft(r) : check(r))} />
        {error && (
          <p role="alert" className="text-sm text-wrong">
            {error}
          </p>
        )}
        {done && (
          <div role="status" className="flex flex-col gap-1.5 rounded-2xl border border-border bg-surface p-3.5">
            <span className={cn("text-sm font-semibold", done.feedback.isCorrect ? "text-correct" : "text-wrong")}>{done.feedback.isCorrect ? "Correct" : "Not quite"}</span>
            {q.type === "fill_in" && !done.feedback.isCorrect && <span className="text-[15px]">Answer: {done.feedback.accepted[0]}</span>}
            {done.feedback.explanation && <p className="text-[15px] leading-[1.6]">{done.feedback.explanation}</p>}
            <div className="flex flex-wrap items-center justify-between gap-x-3">
              <span className="flex flex-col">
                {done.feedback.sourceLabel && <span className="text-[13px] font-semibold text-accent">{done.feedback.sourceLabel}</span>}
                {done.feedback.sourceLabel && <span className="text-xs text-ink-muted">AI-generated from notes</span>}
              </span>
              <ReportButton key={q.id} questionId={q.id} className="-my-2" />
            </div>
          </div>
        )}
      </main>

      <div className="sticky bottom-0 grid grid-cols-[1fr_2fr] gap-2 bg-bg px-5 pb-[calc(20px+env(safe-area-inset-bottom))] pt-3">
        <Link href={tutorHref} className={buttonClass("secondary", "lg", "text-[15px]")}>
          Ask tutor
        </Link>
        {done ? (
          <button type="button" onClick={next} disabled={pending} className={buttonClass("primary", "lg")}>
            {isLast ? "See results" : "Next question"}
          </button>
        ) : needsCheck ? (
          <button type="button" onClick={() => draft && check(draft)} disabled={!draft || pending} className={buttonClass("primary", "lg")}>
            {pending ? "Checking…" : "Check"}
          </button>
        ) : (
          <button type="button" onClick={next} disabled={pending} className={buttonClass("secondary", "lg")}>
            Skip
          </button>
        )}
      </div>
    </div>
  );
}

function Options({
  question,
  response,
  feedback,
  disabled,
  onPick,
}: {
  question: RuntimeQuestion;
  response: AttemptResponse | null;
  feedback: PracticeFeedback | null;
  disabled: boolean;
  onPick: (r: AttemptResponse) => void;
}) {
  if (question.type === "fill_in") {
    return (
      <input
        key={question.id}
        aria-label="Your answer"
        defaultValue={response?.kind === "text" ? response.text : ""}
        disabled={disabled}
        onChange={(e) => onPick({ kind: "text", text: e.target.value })}
        autoComplete="off"
        className={cn(
          "h-[52px] rounded-[12px] border bg-surface-2 px-3.5 text-base outline-none focus:border-accent",
          feedback ? (feedback.isCorrect ? "border-correct bg-correct-soft" : "border-wrong bg-wrong-soft") : "border-transparent",
        )}
      />
    );
  }
  const picked = (id: string) =>
    response?.kind === "choice" ? response.optionIds.includes(id) : response?.kind === "bool" ? String(response.value) === id : false;
  const multi = question.type === "multiple";
  return (
    <div className="flex flex-col gap-2">
      {multi && <span className="text-[13px] text-ink-muted">Select all that apply, then check.</span>}
      {question.options.map((o, i) => {
        const isPicked = picked(o.id);
        const isRight = feedback?.correctOptionIds.includes(o.id) ?? false;
        const state = !feedback ? (isPicked ? "picked" : "idle") : isRight ? "right" : isPicked ? "wrong" : "dim";
        return (
          <button
            key={o.id}
            type="button"
            disabled={disabled}
            aria-pressed={isPicked}
            onClick={() => {
              if (question.type === "true_false") return onPick({ kind: "bool", value: o.id === "true" });
              if (multi) {
                const cur = response?.kind === "choice" ? response.optionIds : [];
                return onPick({ kind: "choice", optionIds: cur.includes(o.id) ? cur.filter((x) => x !== o.id) : [...cur, o.id] });
              }
              onPick({ kind: "choice", optionIds: [o.id] });
            }}
            className={cn(
              "flex min-h-[52px] items-center gap-3 rounded-[12px] border px-3.5 py-2.5 text-left text-base leading-snug",
              state === "idle" && "border-surface-2 bg-surface-2",
              state === "picked" && "border-accent bg-accent-soft",
              state === "right" && "border-correct bg-correct-soft",
              state === "wrong" && "border-wrong bg-wrong-soft",
              state === "dim" && "border-surface-2 bg-surface-2 opacity-60",
            )}
          >
            <span
              aria-hidden
              className={cn(
                "grid size-7 flex-none place-items-center text-sm font-bold",
                multi ? "rounded-md" : "rounded-full",
                state === "right" && "bg-correct text-bg",
                state === "wrong" && "bg-wrong text-bg",
                state === "picked" && "bg-accent text-on-accent",
                (state === "idle" || state === "dim") && "border-[1.5px] border-ink-muted text-[13px] text-ink-muted",
              )}
            >
              {state === "right" ? <Check size={16} strokeWidth={3} /> : state === "wrong" ? <X size={16} strokeWidth={3} /> : LETTERS[i]}
            </span>
            <span className="flex-1">{o.text}</span>
            {feedback && (state === "right" || state === "wrong") && <span className="sr-only">{state === "right" ? "Correct answer" : "Your answer, wrong"}</span>}
          </button>
        );
      })}
    </div>
  );
}
