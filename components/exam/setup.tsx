"use client";

/** Mock setup (design 2h): build your own (count, time, topics, difficulty) or pick a shared bank. */
import { useActionState, useState } from "react";
import { startMockAction, type StartState } from "@/app/(app)/courses/actions";
import { buttonClass } from "@/components/ui/primitives";
import { cn } from "@/lib/cn";
import type { CourseTopic } from "@/lib/course-data";
import { MASTERY_COLOR } from "@/lib/mastery";

const COUNTS = [10, 20, 30, 50];
const TIMES = ["15", "25", "40", "none"] as const;

type Bank = { id: string; title: string; questions: number; attempts: number };

function Tiles<T extends string | number>({
  name,
  options,
  value,
  onChange,
  label,
}: {
  name: string;
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
  label: (v: T) => string;
}) {
  return (
    <div className="grid grid-cols-4 gap-2">
      {options.map((o) => {
        const on = o.value === value;
        return (
          <label
            key={String(o.value)}
            className={cn(
              "grid h-12 cursor-pointer place-items-center rounded-[12px] font-display font-bold has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-accent",
              on ? "border border-accent bg-accent-soft text-accent" : "bg-surface-2",
              o.label.length > 4 && "font-sans text-sm font-semibold",
            )}
          >
            <input type="radio" name={name} value={String(o.value)} checked={on} onChange={() => onChange(o.value)} className="sr-only" aria-label={label(o.value)} />
            {o.label}
          </label>
        );
      })}
    </div>
  );
}

function Segmented<T extends string>({ value, options, onChange, label }: { value: T; options: { value: T; label: string }[]; onChange: (v: T) => void; label: string }) {
  return (
    <div role="radiogroup" aria-label={label} className="grid gap-1 rounded-[12px] bg-surface-2 p-1" style={{ gridTemplateColumns: `repeat(${options.length}, 1fr)` }}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={o.value === value}
          onClick={() => onChange(o.value)}
          className={cn("grid h-10 place-items-center rounded-[9px] text-sm font-semibold", o.value === value ? "bg-surface text-ink" : "text-ink-muted")}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function MockSetup({ courseId, courseCode, topics, banks, quickTimer }: { courseId: string; courseCode: string; topics: CourseTopic[]; banks: Bank[]; quickTimer: boolean }) {
  const [state, action, pending] = useActionState<StartState, FormData>(startMockAction, { error: null });
  const [mode, setMode] = useState<"own" | "bank">("own");
  const [count, setCount] = useState(30);
  const [time, setTime] = useState<string>("25");
  const [difficulty, setDifficulty] = useState<"mixed" | "easier" | "harder">("mixed");
  const weak = topics.filter((t) => t.label === "weak" || t.label === "shaky").map((t) => t.id);
  const [picked, setPicked] = useState<string[]>(topics.map((t) => t.id));
  const [bankId, setBankId] = useState<string | null>(banks[0]?.id ?? null);

  const available = topics.filter((t) => picked.includes(t.id)).reduce((s, t) => s + t.questions, 0);
  const actualCount = Math.min(count, available);
  const timeOptions = [...(quickTimer ? (["1"] as string[]) : []), ...TIMES].slice(0, 4);
  const perQuestion = time === "none" ? null : Math.round((Number(time) * 60) / Math.max(1, actualCount));
  const bank = banks.find((b) => b.id === bankId);
  const summary =
    mode === "bank"
      ? bank
        ? `${bank.questions} questions · ${time === "none" ? "no limit" : `${time} min`} · works offline`
        : "Pick a bank"
      : `${actualCount} questions · ${time === "none" ? "no limit" : `${time} min`} · ${picked.length} topic${picked.length === 1 ? "" : "s"} · works offline`;

  return (
    <form action={action} className="flex flex-1 flex-col">
      <input type="hidden" name="courseId" value={courseId} />
      <input type="hidden" name="difficulty" value={difficulty} />
      {mode === "bank" && bankId && <input type="hidden" name="bankId" value={bankId} />}
      {mode === "own" && picked.map((id) => <input key={id} type="hidden" name="topicId" value={id} />)}

      <div className="flex flex-1 flex-col gap-[18px] px-5 pb-5 pt-1 lg:px-0">
        <Segmented
          label="How to build the mock"
          value={mode}
          onChange={setMode}
          options={[
            { value: "own", label: "Build my own" },
            { value: "bank", label: "Pick a bank" },
          ]}
        />

        {mode === "own" ? (
          <>
            <fieldset className="flex flex-col gap-2">
              <legend className="pb-2 text-[13px] text-ink-muted">Questions</legend>
              <Tiles name="count" value={count} onChange={setCount} options={COUNTS.map((c) => ({ value: c, label: String(c) }))} label={(v) => `${v} questions`} />
            </fieldset>
            <fieldset className="flex flex-col gap-2">
              <legend className="flex w-full justify-between pb-2 text-[13px] text-ink-muted">
                <span>Time</span>
                {perQuestion !== null && <span>About {perQuestion} s a question</span>}
              </legend>
              <Tiles name="time" value={time} onChange={setTime} options={timeOptions.map((t) => ({ value: t, label: t === "none" ? "No limit" : `${t}m` }))} label={(v) => (v === "none" ? "No time limit" : `${v} minutes`)} />
            </fieldset>
            <fieldset className="flex flex-col gap-2">
              <legend className="flex w-full justify-between pb-2 text-[13px]">
                <span className="text-ink-muted">Topics</span>
                {weak.length > 0 && (
                  <button type="button" onClick={() => setPicked(weak)} className="font-semibold text-accent">
                    Weak only
                  </button>
                )}
              </legend>
              <div className="flex flex-wrap gap-2">
                {topics.map((t) => {
                  const on = picked.includes(t.id);
                  return (
                    <label
                      key={t.id}
                      className={cn(
                        "flex h-10 cursor-pointer items-center gap-2 rounded-full border px-3 text-sm has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-accent",
                        on ? "border-accent bg-accent-soft" : "border-border bg-surface",
                      )}
                    >
                      <input
                        type="checkbox"
                        checked={on}
                        onChange={() => setPicked((p) => (on ? p.filter((x) => x !== t.id) : [...p, t.id]))}
                        className="sr-only"
                      />
                      <span aria-hidden className="size-2 rounded-full" style={{ background: t.label ? MASTERY_COLOR[t.label] : "var(--border)" }} />
                      {t.name}
                      <span className="sr-only">, {t.label ?? "not tried yet"}</span>
                    </label>
                  );
                })}
              </div>
            </fieldset>
            <fieldset className="flex flex-col gap-2">
              <legend className="pb-2 text-[13px] text-ink-muted">Difficulty</legend>
              <Segmented
                label="Difficulty"
                value={difficulty}
                onChange={setDifficulty}
                options={[
                  { value: "mixed", label: "Mixed" },
                  { value: "easier", label: "Easier" },
                  { value: "harder", label: "Harder" },
                ]}
              />
            </fieldset>
          </>
        ) : (
          <>
            {banks.length === 0 ? (
              <p className="text-[15px] text-ink-muted">No shared banks for {courseCode} yet. Build your own instead.</p>
            ) : (
              <fieldset className="flex flex-col gap-2">
                <legend className="pb-2 text-[13px] text-ink-muted">Shared banks</legend>
                {banks.map((b) => (
                  <label
                    key={b.id}
                    className={cn(
                      "flex min-h-14 cursor-pointer items-center gap-3 rounded-[12px] border px-4 has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-accent",
                      bankId === b.id ? "border-accent bg-accent-soft" : "border-border bg-surface",
                    )}
                  >
                    <input type="radio" name="bankPick" checked={bankId === b.id} onChange={() => setBankId(b.id)} className="sr-only" />
                    <span className="flex-1 text-[15px] font-semibold">{b.title}</span>
                    <span className="text-[13px] text-ink-muted">
                      {b.questions} Qs · {b.attempts} attempt{b.attempts === 1 ? "" : "s"}
                    </span>
                  </label>
                ))}
              </fieldset>
            )}
            <fieldset className="flex flex-col gap-2">
              <legend className="pb-2 text-[13px] text-ink-muted">Time</legend>
              <Tiles name="time" value={time} onChange={setTime} options={timeOptions.map((t) => ({ value: t, label: t === "none" ? "No limit" : `${t}m` }))} label={(v) => (v === "none" ? "No time limit" : `${v} minutes`)} />
            </fieldset>
          </>
        )}
        {state.error && (
          <p role="alert" className="text-sm text-wrong">
            {state.error}
          </p>
        )}
      </div>

      <div className="sticky bottom-[calc(64px+env(safe-area-inset-bottom))] flex flex-col gap-2 border-t border-border bg-bg px-5 pb-5 pt-3 lg:bottom-0 lg:px-0">
        <span className="text-center text-[13px] text-ink-muted">{summary}</span>
        <button type="submit" disabled={pending || (mode === "own" ? actualCount === 0 : !bank)} className={buttonClass("primary", "lg")}>
          {pending ? "Getting your questions…" : "Start mock"}
        </button>
      </div>
    </form>
  );
}
