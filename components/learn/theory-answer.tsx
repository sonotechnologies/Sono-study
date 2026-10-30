"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { Check, X } from "lucide-react";
import { gradeAnswerAction } from "@/app/(app)/theory/actions";
import { Ring } from "@/components/learn/ring";
import { buttonClass } from "@/components/ui/primitives";
import { formatScore } from "@/lib/exam-engine/results";
import { MASTERY_COLOR, masteryLabel } from "@/lib/mastery";
import type { TheoryFeedback } from "@/lib/theory";
import { verdictLine } from "@/lib/theory-copy";

type Graded = { score: number; maxScore: number; feedback: TheoryFeedback; source: string | null };

const draftKey = (id: string) => `sono:theory:${id}`;

/** Write an answer, get it marked against the guide (design 2o). Drafts stay on the phone. */
export function TheoryAnswer({
  questionId,
  nextHref,
  remaining: initialRemaining,
  limit,
  initial,
  modelAnswer,
}: {
  questionId: string;
  nextHref: string | null;
  remaining: number;
  limit: number;
  initial: (Graded & { answer: string }) | null;
  modelAnswer: string | null;
}) {
  const [answer, setAnswer] = useState(initial?.answer ?? "");
  const [graded, setGraded] = useState<Graded | null>(initial);
  const [editing, setEditing] = useState(!initial);
  const [error, setError] = useState<{ text: string; limit: boolean } | null>(null);
  const [remaining, setRemaining] = useState(initialRemaining);
  const [pending, start] = useTransition();

  // Restore an unsent draft (written offline, or the tab was closed).
  useEffect(() => {
    if (initial) return;
    try {
      const saved = localStorage.getItem(draftKey(questionId));
      if (saved) setTimeout(() => setAnswer(saved), 0);
    } catch {}
  }, [questionId, initial]);

  function change(v: string) {
    setAnswer(v);
    try {
      localStorage.setItem(draftKey(questionId), v);
    } catch {}
  }

  function grade() {
    setError(null);
    start(async () => {
      const res = await gradeAnswerAction(questionId, answer);
      if (!res.ok) return setError({ text: res.error, limit: res.code === "limit" });
      try {
        localStorage.removeItem(draftKey(questionId));
      } catch {}
      setRemaining(res.remaining);
      setGraded({ score: res.score, maxScore: res.maxScore, feedback: res.feedback, source: res.source });
      setEditing(false);
    });
  }

  if (editing || !graded) {
    return (
      <div className="flex flex-col gap-3">
        <label htmlFor="theory-answer" className="text-[13px] text-ink-muted">
          Your answer
        </label>
        <textarea
          id="theory-answer"
          value={answer}
          onChange={(e) => change(e.target.value)}
          rows={10}
          maxLength={6000}
          placeholder="Write it as you would in the exam: points, explanations and examples."
          className="min-h-[220px] rounded-2xl border border-border bg-surface p-4 text-base leading-relaxed text-ink outline-none focus:border-accent"
        />
        <div className="flex items-center justify-between text-[13px] text-ink-muted">
          <span>{answer.trim().split(/\s+/).filter(Boolean).length} words</span>
          <span>
            {remaining} of {limit} gradings left today
          </span>
        </div>
        {error && (
          <p role="alert" className="text-sm text-wrong">
            {error.text}{" "}
            {error.limit && (
              <Link href="?paywall=1" scroll={false} className="font-semibold text-accent">
                Get more with Pro
              </Link>
            )}
          </p>
        )}
        <button type="button" disabled={pending || answer.trim().length < 40} onClick={grade} className={buttonClass("primary", "lg")}>
          {pending ? "Marking…" : "Mark my answer"}
        </button>
        {graded && (
          <button type="button" onClick={() => setEditing(false)} className={buttonClass("ghost", "md")}>
            Back to the last marking
          </button>
        )}
      </div>
    );
  }

  const ratio = graded.maxScore ? graded.score / graded.maxScore : 0;
  const color = MASTERY_COLOR[masteryLabel(ratio)];
  const f = graded.feedback;
  return (
    <div className="flex flex-col gap-4">
      <div className="whitespace-pre-wrap rounded-2xl bg-surface-2 p-4 text-[15px] leading-relaxed">{answer}</div>
      <section aria-label="Marking" className="flex flex-col gap-4 rounded-2xl border border-border bg-surface p-4">
        <div className="flex items-center gap-4">
          <Ring value={ratio} size={72} stroke={7} color={color} label={`${formatScore(graded.score)} out of ${formatScore(graded.maxScore)}`}>
            <span className="font-display text-lg font-bold">
              {formatScore(graded.score)}/{formatScore(graded.maxScore)}
            </span>
          </Ring>
          <div className="flex flex-col gap-0.5">
            <span className="font-display text-xl font-bold">{f.verdict}</span>
            <span className="text-sm text-ink-muted">{verdictLine(f.covered.length, f.missed.length)}</span>
          </div>
        </div>
        {f.covered.length > 0 && (
          <div className="flex flex-col gap-1.5">
            <h3 className="text-[13px] text-ink-muted">Covered</h3>
            <ul className="flex flex-col gap-1.5">
              {f.covered.map((p) => (
                <li key={p} className="flex gap-2 text-[15px] leading-snug">
                  <Check size={18} className="mt-0.5 flex-none text-correct" aria-hidden />
                  {p}
                </li>
              ))}
            </ul>
          </div>
        )}
        {f.missed.length > 0 && (
          <div className="flex flex-col gap-1.5">
            <h3 className="text-[13px] text-ink-muted">Missed</h3>
            <ul className="flex flex-col gap-1.5">
              {f.missed.map((p) => (
                <li key={p} className="flex gap-2 text-[15px] leading-snug">
                  <X size={18} className="mt-0.5 flex-none text-wrong" aria-hidden />
                  {p}
                </li>
              ))}
            </ul>
          </div>
        )}
        <div className="flex flex-col gap-1 rounded-[12px] bg-accent-soft p-3.5">
          <span className="text-[13px] font-semibold">Tip</span>
          <span className="text-[15px] leading-relaxed">{f.tip}</span>
          {graded.source && <span className="text-[13px] font-semibold text-accent">{graded.source}</span>}
        </div>
        <p className="text-xs text-ink-muted">AI guidance against a marking guide, not an official grade.</p>
      </section>
      {modelAnswer && (
        <details className="rounded-2xl border border-border bg-surface p-4">
          <summary className="cursor-pointer text-[15px] font-semibold">See a model answer</summary>
          <p className="pt-2 text-[15px] leading-relaxed text-ink-muted">{modelAnswer}</p>
        </details>
      )}
      <div className="grid grid-cols-2 gap-2">
        <button type="button" onClick={() => setEditing(true)} className={buttonClass("secondary", "lg")}>
          Rewrite answer
        </button>
        {nextHref ? (
          <Link href={nextHref} className={buttonClass("primary", "lg")}>
            Next question
          </Link>
        ) : (
          <Link href="?" className={buttonClass("primary", "lg", "pointer-events-none opacity-50")} aria-disabled>
            Last question
          </Link>
        )}
      </div>
    </div>
  );
}
