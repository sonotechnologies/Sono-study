"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { Check, Plus, X } from "lucide-react";
import { createQuestion, type NewQuestionInput } from "@/app/(app)/courses/[courseId]/questions/new/actions";
import { Switch } from "@/components/ui/switch";
import { buttonClass } from "@/components/ui/primitives";
import { cn } from "@/lib/cn";

const LETTERS = ["A", "B", "C", "D", "E", "F"];
const TYPES = [
  { value: "single", label: "One answer" },
  { value: "multiple", label: "Several" },
  { value: "true_false", label: "True/false" },
  { value: "fill_in", label: "Fill in" },
] as const;
const INPUT = "w-full rounded-[12px] border border-transparent bg-surface-2 px-3.5 text-base text-ink outline-none placeholder:text-ink-muted focus:border-accent focus:shadow-[0_0_0_3px_var(--accent-soft)]";

const blank = (courseId: string): NewQuestionInput => ({
  courseId,
  type: "single",
  topic: "",
  stem: "",
  options: ["", "", "", ""],
  correct: [],
  trueFalse: null,
  accepted: [],
  explanation: "",
  difficulty: 2,
  share: true,
});

export function QuestionForm({ courseId, topics }: { courseId: string; topics: string[] }) {
  const [q, setQ] = useState<NewQuestionInput>(() => blank(courseId));
  const [acceptedText, setAcceptedText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(0);
  const [pending, start] = useTransition();
  const set = (patch: Partial<NewQuestionInput>) => setQ((x) => ({ ...x, ...patch }));
  const choice = q.type === "single" || q.type === "multiple";

  function toggleCorrect(i: number) {
    if (q.type === "single") set({ correct: [i] });
    else set({ correct: q.correct.includes(i) ? q.correct.filter((c) => c !== i) : [...q.correct, i] });
  }

  function submit() {
    setError(null);
    start(async () => {
      const res = await createQuestion({
        ...q,
        options: choice ? q.options : [],
        correct: choice ? q.correct : [],
        accepted: acceptedText.split(/\n|;/).map((s) => s.trim()).filter(Boolean),
      });
      if (!res.ok) return setError(res.error);
      setSaved((n) => n + 1);
      setQ({ ...blank(courseId), topic: q.topic, type: q.type, share: q.share, difficulty: q.difficulty });
      setAcceptedText("");
      window.scrollTo({ top: 0 });
    });
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
      className="flex flex-col gap-5 px-5 lg:px-0"
    >
      {saved > 0 && (
        <p role="status" className="flex items-center gap-2 rounded-[12px] bg-correct-soft px-3.5 py-3 text-[15px]">
          <Check size={18} className="text-correct" aria-hidden /> Saved {saved} question{saved === 1 ? "" : "s"}.{" "}
          <Link href={`/courses/${courseId}/mock`} className="font-semibold text-accent">
            Start a mock
          </Link>
        </p>
      )}

      <div role="radiogroup" aria-label="Question type" className="grid grid-cols-4 gap-1 rounded-[12px] bg-surface-2 p-1">
        {TYPES.map((t) => (
          <button
            key={t.value}
            type="button"
            role="radio"
            aria-checked={q.type === t.value}
            onClick={() => set({ type: t.value, correct: [] })}
            className={cn("grid h-10 place-items-center rounded-[9px] text-[13px] font-semibold", q.type === t.value ? "bg-surface text-ink" : "text-ink-muted")}
          >
            {t.label}
          </button>
        ))}
      </div>

      <label className="flex flex-col gap-1.5 text-[13px] text-ink-muted">
        Topic
        <input value={q.topic} onChange={(e) => set({ topic: e.target.value })} list="topics" placeholder="e.g. Concord" className={cn(INPUT, "h-12")} />
        <datalist id="topics">
          {topics.map((t) => (
            <option key={t} value={t} />
          ))}
        </datalist>
      </label>

      <label className="flex flex-col gap-1.5 text-[13px] text-ink-muted">
        {q.type === "true_false" ? "Statement" : "Question"}
        <textarea value={q.stem} onChange={(e) => set({ stem: e.target.value })} rows={3} className={cn(INPUT, "py-3 leading-relaxed")} />
      </label>

      {choice && (
        <fieldset className="flex flex-col gap-2">
          <legend className="pb-1.5 text-[13px] text-ink-muted">Options · tap the letter of {q.type === "single" ? "the correct one" : "every correct one"}</legend>
          {q.options.map((o, i) => (
            <div key={i} className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => toggleCorrect(i)}
                aria-label={`Mark option ${LETTERS[i]} correct`}
                aria-pressed={q.correct.includes(i)}
                className={cn(
                  "grid size-11 flex-none place-items-center text-sm font-bold",
                  q.type === "multiple" ? "rounded-[10px]" : "rounded-full",
                  q.correct.includes(i) ? "bg-correct text-bg" : "border-[1.5px] border-ink-muted text-ink-muted",
                )}
              >
                {q.correct.includes(i) ? <Check size={18} strokeWidth={3} /> : LETTERS[i]}
              </button>
              <input
                value={o}
                onChange={(e) => set({ options: q.options.map((x, j) => (j === i ? e.target.value : x)) })}
                aria-label={`Option ${LETTERS[i]}`}
                className={cn(INPUT, "h-12")}
              />
              {q.options.length > 2 && (
                <button
                  type="button"
                  aria-label={`Remove option ${LETTERS[i]}`}
                  onClick={() => set({ options: q.options.filter((_, j) => j !== i), correct: q.correct.filter((c) => c !== i).map((c) => (c > i ? c - 1 : c)) })}
                  className="grid size-11 flex-none place-items-center rounded-full text-ink-muted hover:bg-surface-2"
                >
                  <X size={18} aria-hidden />
                </button>
              )}
            </div>
          ))}
          {q.options.length < 6 && (
            <button type="button" onClick={() => set({ options: [...q.options, ""] })} className="flex h-11 items-center gap-2 self-start text-sm font-semibold text-accent">
              <Plus size={18} aria-hidden /> Add option
            </button>
          )}
        </fieldset>
      )}

      {q.type === "true_false" && (
        <div role="radiogroup" aria-label="Answer" className="grid grid-cols-2 gap-2">
          {[true, false].map((v) => (
            <button
              key={String(v)}
              type="button"
              role="radio"
              aria-checked={q.trueFalse === v}
              onClick={() => set({ trueFalse: v })}
              className={cn("h-12 rounded-[12px] font-semibold", q.trueFalse === v ? "border border-correct bg-correct-soft" : "bg-surface-2")}
            >
              {v ? "True" : "False"}
            </button>
          ))}
        </div>
      )}

      {q.type === "fill_in" && (
        <label className="flex flex-col gap-1.5 text-[13px] text-ink-muted">
          Accepted answers · one per line (case and a final full stop don&apos;t matter; 0.5 and 1/2 match)
          <textarea value={acceptedText} onChange={(e) => setAcceptedText(e.target.value)} rows={2} className={cn(INPUT, "py-3")} />
        </label>
      )}

      <label className="flex flex-col gap-1.5 text-[13px] text-ink-muted">
        Why · shown after answering
        <textarea value={q.explanation} onChange={(e) => set({ explanation: e.target.value })} rows={3} className={cn(INPUT, "py-3 leading-relaxed")} />
      </label>

      <fieldset className="flex flex-col gap-1.5">
        <legend className="pb-1.5 text-[13px] text-ink-muted">Difficulty</legend>
        <div className="grid grid-cols-3 gap-1 rounded-[12px] bg-surface-2 p-1">
          {([1, 2, 3] as const).map((d) => (
            <button
              key={d}
              type="button"
              aria-pressed={q.difficulty === d}
              onClick={() => set({ difficulty: d })}
              className={cn("grid h-10 place-items-center rounded-[9px] text-sm font-semibold", q.difficulty === d ? "bg-surface text-ink" : "text-ink-muted")}
            >
              {d === 1 ? "Easy" : d === 2 ? "Medium" : "Hard"}
            </button>
          ))}
        </div>
      </fieldset>

      <div className="flex min-h-16 items-center gap-3 rounded-2xl border border-border bg-surface px-4 py-3">
        <label htmlFor="share" className="flex flex-1 flex-col gap-0.5">
          <span className="text-[15px]">Share with classmates</span>
          <span className="text-[13px] text-ink-muted">Adds it to the course bank so others on this course can practise it.</span>
        </label>
        <Switch id="share" checked={q.share} onCheckedChange={(v) => set({ share: v })} />
      </div>

      {error && (
        <p role="alert" className="text-sm text-wrong">
          {error}
        </p>
      )}
      <button type="submit" disabled={pending} className={buttonClass("primary", "lg")}>
        {pending ? "Saving…" : "Save question"}
      </button>
    </form>
  );
}
