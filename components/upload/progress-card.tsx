import { Check } from "lucide-react";
import { cn } from "@/lib/cn";

export type ProgressPhase = "uploading" | "waiting" | "reading" | "making";

export type ProgressView = {
  phase: ProgressPhase;
  sizeBytes: number;
  /** Bytes sent so far (uploading only). */
  sent?: number;
  pagesUsed?: number | null;
  pageUnit?: string;
  questionsMade?: number;
  chunksDone?: number;
  chunksTotal?: number;
  statusLine?: string | null;
  /** Queue is busy: about how long. */
  etaMin?: number | null;
};

const ORDER: ProgressPhase[] = ["uploading", "waiting", "reading", "making"];

function mb(bytes: number) {
  return bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

export function progressPercent(v: ProgressView): number {
  switch (v.phase) {
    case "uploading":
      return v.sizeBytes ? Math.round(10 * Math.min(1, (v.sent ?? 0) / v.sizeBytes)) : 2;
    case "waiting":
      return 12;
    case "reading":
      return 20;
    case "making":
      return Math.round(25 + 75 * Math.min(1, (v.chunksDone ?? 0) / Math.max(1, v.chunksTotal ?? 1)));
  }
}

function Step({ state, label, detail, live }: { state: "done" | "active" | "pending"; label: string; detail?: string; live?: boolean }) {
  return (
    <li className={cn("flex min-h-12 items-center gap-3.5", state === "pending" && "text-ink-muted")}>
      {state === "done" ? (
        <span className="grid size-7 flex-none place-items-center rounded-full bg-correct">
          <Check size={16} strokeWidth={3} className="text-bg" aria-hidden />
        </span>
      ) : state === "active" ? (
        <span className="size-7 flex-none animate-spin rounded-full border-[3px] border-accent border-r-surface-2 motion-reduce:animate-none" aria-hidden />
      ) : (
        <span className="size-7 flex-none rounded-full border-2 border-border" aria-hidden />
      )}
      <span className={cn("flex-1 text-[15px]", state === "active" && "font-semibold")}>
        {label}
        <span className="sr-only">{state === "done" ? " (done)" : state === "active" ? " (in progress)" : ""}</span>
      </span>
      {detail && <span className={cn(live ? "font-display text-sm font-bold text-accent" : "text-[13px] text-ink-muted")}>{detail}</span>}
    </li>
  );
}

/** Design 2f: Uploading → Reading your notes → Making questions → Ready. */
export function ProgressCard({ view }: { view: ProgressView }) {
  const at = ORDER.indexOf(view.phase);
  const state = (i: number) => (at > i ? "done" : at === i ? "active" : "pending") as "done" | "active" | "pending";
  const pct = progressPercent(view);
  const unit = view.pageUnit ?? "page";
  const busy = view.etaMin != null;
  return (
    <section aria-label="Progress" className="flex flex-col gap-[18px] rounded-2xl border border-border bg-surface p-5">
      <div className="flex flex-col gap-1.5">
        <h2 className="font-display text-[22px] font-bold">Cooking your questions…</h2>
        <p className="text-sm leading-normal text-ink-muted">
          {busy ? `Lots of students are studying right now; your questions will be ready in about ${view.etaMin} minute${view.etaMin === 1 ? "" : "s"}.` : "Usually under a minute."}
        </p>
      </div>
      <ol className="flex flex-col">
        <Step state={state(0)} label="Uploading" detail={view.phase === "uploading" && view.sent != null ? `${mb(view.sent)} of ${mb(view.sizeBytes)}` : mb(view.sizeBytes)} />
        <Step
          state={at <= 1 ? "pending" : state(2)}
          label="Reading your notes"
          detail={view.pagesUsed ? `${view.pagesUsed} ${unit}${view.pagesUsed === 1 ? "" : "s"}` : undefined}
        />
        <Step state={state(3)} label="Making questions" detail={view.phase === "making" ? String(view.questionsMade ?? 0) : undefined} live={view.phase === "making"} />
        <Step state="pending" label="Ready" />
      </ol>
      <div className="h-1.5 rounded-full bg-surface-2" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct} aria-label="Overall progress">
        <div className="h-full rounded-full bg-accent transition-[width] duration-500" style={{ width: `${pct}%` }} />
      </div>
      {view.statusLine && (
        <p className="text-sm leading-normal" aria-live="polite">
          <StatusLine text={view.statusLine} />
        </p>
      )}
    </section>
  );
}

/** "Writing questions on <b>Barriers to communication</b> (page 4 of 6)" */
function StatusLine({ text }: { text: string }) {
  const m = text.match(/^(.*? on )(.+?)( \([^)]*\))?$/);
  if (!m) return text;
  return (
    <>
      {m[1]}
      <span className="font-semibold">{m[2]}</span>
      {m[3]}
    </>
  );
}
