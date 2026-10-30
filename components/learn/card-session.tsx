"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronLeft, Pencil } from "lucide-react";
import { reviewCardAction, sessionSummaryAction } from "@/app/(app)/cards/actions";
import type { CardRating } from "@/db/schema";
import { buttonClass } from "@/components/ui/primitives";
import { cn } from "@/lib/cn";
import type { SessionSummary, StudyCard } from "@/lib/flashcards";

const BUTTONS: { rating: CardRating; label: string; cls: string }[] = [
  { rating: "again", label: "Again", cls: "border border-wrong text-wrong" },
  { rating: "hard", label: "Hard", cls: "border border-flag text-flag" },
  { rating: "good", label: "Good", cls: "bg-accent text-on-accent" },
  { rating: "easy", label: "Easy", cls: "border border-correct text-correct" },
];
const BAR: Record<CardRating, string> = { again: "bg-wrong", hard: "bg-flag", good: "bg-accent", easy: "bg-correct" };
const TIME = new Intl.DateTimeFormat("en-NG", { hour: "numeric", minute: "2-digit", timeZone: "Africa/Lagos" });

/** Flashcard session (designs 2j front, 2k back + rating, 2l summary). Space flips, 1–4 rate. */
export function CardSession({ courseId, courseCode, cards, dueTotal }: { courseId: string; courseCode: string; cards: StudyCard[]; dueTotal: number }) {
  const router = useRouter();
  const [startedAt] = useState(() => new Date().toISOString());
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<(SessionSummary & { streakDays: number }) | null>(null);
  const [startMs] = useState(() => Date.now());
  const [minutes, setMinutes] = useState(0);
  const card = cards[index];
  const total = cards.length;

  const rate = useCallback(
    async (rating: CardRating) => {
      if (!card || !flipped) return;
      setError(null);
      const res = await reviewCardAction(card.id, rating);
      if (!res.ok) return setError(res.error);
      if (index + 1 < total) {
        setIndex(index + 1);
        setFlipped(false);
      } else {
        setMinutes(Math.max(1, Math.round((Date.now() - startMs) / 60_000)));
        setSummary(await sessionSummaryAction(courseId, startedAt));
      }
    },
    [card, flipped, index, total, courseId, startedAt, startMs],
  );

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (summary || (e.target as HTMLElement)?.tagName === "TEXTAREA") return;
      if (e.key === " " || e.key === "Enter") {
        e.preventDefault();
        setFlipped(true);
      } else if (flipped && ["1", "2", "3", "4"].includes(e.key)) {
        void rate(BUTTONS[Number(e.key) - 1].rating);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [flipped, rate, summary]);

  const header = (
    <div className="flex h-14 items-center gap-1 pl-1 pr-5 lg:-ml-3 lg:pl-0">
      <Link href={`/courses/${courseId}`} aria-label="Back" className="grid size-12 place-items-center rounded-full hover:bg-surface-2">
        <ChevronLeft size={22} aria-hidden />
      </Link>
      <span className="flex-1 text-sm text-ink-muted">
        {courseCode} · {dueTotal} due
      </span>
      {!summary && total > 0 && (
        <span className="font-display text-sm font-bold">
          {index + 1}/{total}
        </span>
      )}
    </div>
  );

  if (summary) {
    const parts = (Object.keys(summary.counts) as CardRating[]).filter((r) => summary.counts[r] > 0);
    return (
      <div className="flex flex-1 flex-col">
        {header}
        <div className="flex flex-1 flex-col gap-5 px-5 pb-6 pt-4 lg:px-0">
          <div className="flex flex-col gap-1.5">
            <span className="text-[13px] text-ink-muted">
              {courseCode} · {minutes} min
            </span>
            <h1 className="font-display text-[32px] font-bold leading-tight">{summary.total} cards done.</h1>
            <p className="text-[15px] text-ink-muted">
              <span className="font-semibold text-spark">
                {summary.streakDays} day{summary.streakDays === 1 ? "" : "s"} straight.
              </span>{" "}
              Streak kept for today.
            </p>
          </div>
          <div className="flex flex-col gap-3 rounded-2xl border border-border bg-surface p-4">
            <div className="flex h-3 overflow-hidden rounded-full bg-surface-2" aria-hidden>
              {parts.map((r) => (
                <span key={r} className={BAR[r]} style={{ width: `${(summary.counts[r] / Math.max(1, summary.total)) * 100}%` }} />
              ))}
            </div>
            <dl className="grid grid-cols-4 gap-2 text-center">
              {BUTTONS.map((b) => (
                <div key={b.rating} className="flex flex-col">
                  <dt className="text-[13px] text-ink-muted">{b.label}</dt>
                  <dd className="font-display text-xl font-bold">{summary.counts[b.rating]}</dd>
                </div>
              ))}
            </dl>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="flex flex-col rounded-[12px] border border-border bg-surface p-3">
              <span className="text-[13px] text-ink-muted">Earned</span>
              <span className="font-display text-lg font-bold text-spark">+{summary.xp} XP</span>
            </div>
            <div className="flex flex-col rounded-[12px] border border-border bg-surface p-3">
              <span className="text-[13px] text-ink-muted">Next due</span>
              <span className="font-display text-lg font-bold">
                {summary.nextDue ? `${summary.nextDue.count} ${new Date(summary.nextDue.when).toDateString() === new Date().toDateString() ? `at ${TIME.format(new Date(summary.nextDue.when))}` : "tomorrow"}` : "None this week"}
              </span>
            </div>
          </div>
          <div className="mt-auto flex flex-col gap-2">
            {summary.again.length > 0 && (
              <button type="button" onClick={() => router.refresh()} className={buttonClass("primary", "lg")}>
                Practise the {summary.again.length} &ldquo;Again&rdquo; card{summary.again.length === 1 ? "" : "s"}
              </button>
            )}
            <Link href={`/courses/${courseId}`} className={buttonClass(summary.again.length ? "secondary" : "primary", "lg")}>
              Done for now
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (!card) {
    return (
      <div className="flex flex-1 flex-col">
        {header}
        <div className="flex flex-1 flex-col gap-3 px-5 pt-8 lg:px-0">
          <h1 className="font-display text-[28px] font-bold">All caught up.</h1>
          <p className="text-[15px] text-ink-muted">No {courseCode} cards are due right now. Upload notes for more cards, or write your own.</p>
          <div className="flex gap-2 pt-2">
            <Link href={`/cards/${courseId}/new`} className={buttonClass("primary", "md")}>
              Add a card
            </Link>
            <Link href={`/upload?course=${courseId}`} className={buttonClass("secondary", "md")}>
              Upload notes
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col">
      {header}
      <div className="mx-5 h-1.5 rounded-full bg-surface-2 lg:mx-0" role="progressbar" aria-valuemin={0} aria-valuemax={total} aria-valuenow={index} aria-label="Session progress">
        <div className="h-full rounded-full bg-spark transition-[width] duration-200" style={{ width: `${(index / total) * 100}%` }} />
      </div>

      <div className="flex flex-1 flex-col px-5 py-5 lg:px-0 [perspective:1200px]">
        <button
          type="button"
          onClick={() => setFlipped((f) => !f)}
          aria-label={flipped ? "Answer shown. Tap to see the question again" : "Tap to show the answer"}
          className="relative min-h-[360px] flex-1 text-left [transform-style:preserve-3d] transition-transform duration-200 ease-out motion-reduce:transition-none lg:min-h-[420px]"
          style={{ transform: flipped ? "rotateY(180deg)" : undefined }}
        >
          <span className={cn("absolute inset-0 flex flex-col items-center justify-center gap-4 rounded-3xl border border-border bg-surface p-6 text-center [backface-visibility:hidden] motion-reduce:transition-opacity motion-reduce:duration-200", flipped && "motion-reduce:opacity-0")}>
            {card.topic && <span className="rounded-full border border-border px-3 py-1 text-xs text-ink-muted">{card.topic}</span>}
            <span className="font-display text-[26px] font-bold leading-tight [text-wrap:balance] lg:text-[30px]">{card.front}</span>
            <span className="text-[13px] text-ink-muted">Tap card to flip</span>
          </span>
          <span
            className={cn(
              "absolute inset-0 flex flex-col justify-center gap-4 rounded-3xl border border-border bg-surface p-6 [backface-visibility:hidden] [transform:rotateY(180deg)] motion-reduce:transition-opacity motion-reduce:duration-200",
              !flipped && "motion-reduce:opacity-0",
            )}
          >
            <span className="text-[15px] text-ink-muted">{card.front}</span>
            <span className="h-px bg-border" aria-hidden />
            <span className="text-lg leading-relaxed">{card.back}</span>
            {card.source && <span className="text-[13px] font-semibold text-accent">{card.source}</span>}
          </span>
        </button>
        {flipped && card.editable && (
          <Link href={`/cards/${courseId}/edit/${card.id}`} className="mt-2 flex h-11 items-center gap-1.5 self-end text-[13px] font-semibold text-ink-muted">
            <Pencil size={14} aria-hidden /> Edit card
          </Link>
        )}
      </div>

      {error && (
        <p role="alert" className="px-5 pb-2 text-sm text-wrong lg:px-0">
          {error}
        </p>
      )}
      <div className="sticky bottom-[calc(64px+env(safe-area-inset-bottom))] bg-bg px-5 pb-5 pt-2 lg:bottom-0 lg:px-0">
        {flipped ? (
          <div className="grid grid-cols-4 gap-2" role="group" aria-label="How well did you know it?">
            {BUTTONS.map((b, i) => (
              <button key={b.rating} type="button" onClick={() => rate(b.rating)} aria-keyshortcuts={String(i + 1)} className={cn("flex h-16 flex-col items-center justify-center rounded-[12px] font-semibold", b.cls)}>
                <span className="text-[15px]">{b.label}</span>
                <span className="text-xs font-normal opacity-80">{card.intervals[b.rating]}</span>
              </button>
            ))}
          </div>
        ) : (
          <button type="button" onClick={() => setFlipped(true)} aria-keyshortcuts="Space" className={buttonClass("primary", "lg", "w-full")}>
            Show answer
          </button>
        )}
      </div>
    </div>
  );
}
