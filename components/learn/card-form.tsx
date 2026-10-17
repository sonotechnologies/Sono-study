"use client";

import { useActionState } from "react";
import Link from "next/link";
import { saveCardAction, type CardFormState } from "@/app/(app)/cards/actions";
import { buttonClass } from "@/components/ui/primitives";
import { cn } from "@/lib/cn";

const INPUT = "w-full rounded-[12px] border border-transparent bg-surface-2 px-3.5 py-3 text-base text-ink outline-none focus:border-accent";

/** Write or edit a flashcard. New cards are private to the student. */
export function CardForm({
  courseId,
  cardId,
  topics,
  initial,
}: {
  courseId: string;
  cardId: string | null;
  topics: { id: string; name: string }[];
  initial?: { front: string; back: string; topicId: string | null };
}) {
  const [state, action, pending] = useActionState<CardFormState, FormData>(saveCardAction.bind(null, courseId, cardId), { error: null, saved: 0 });
  return (
    <form key={cardId ? "edit" : state.saved} action={action} className="flex flex-col gap-4 px-5 lg:px-0">
      {state.saved > 0 && (
        <p role="status" className="rounded-[12px] bg-correct-soft px-3.5 py-3 text-[15px]">
          {cardId ? "Saved." : `Card saved. ${state.saved > 1 ? `${state.saved} added. ` : ""}Add another, or `}
          <Link href={`/cards/${courseId}`} className="font-semibold text-accent">
            {cardId ? "Back to your cards" : "study now"}
          </Link>
          .
        </p>
      )}
      <label className="flex flex-col gap-1.5 text-[13px] text-ink-muted">
        Front · a question or a term
        <textarea name="front" required rows={3} defaultValue={initial?.front} placeholder="What is semantic noise?" className={cn(INPUT, "leading-relaxed")} />
      </label>
      <label className="flex flex-col gap-1.5 text-[13px] text-ink-muted">
        Back · the answer
        <textarea name="back" required rows={4} defaultValue={initial?.back} className={cn(INPUT, "leading-relaxed")} />
      </label>
      {topics.length > 0 && (
        <label className="flex flex-col gap-1.5 text-[13px] text-ink-muted">
          Topic (optional)
          <select name="topicId" defaultValue={initial?.topicId ?? ""} className={cn(INPUT, "h-12 py-0")}>
            <option value="">No topic</option>
            {topics.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </label>
      )}
      {state.error && (
        <p role="alert" className="text-sm text-wrong">
          {state.error}
        </p>
      )}
      <button type="submit" disabled={pending} className={buttonClass("primary", "lg")}>
        {pending ? "Saving…" : cardId ? "Save changes" : "Save card"}
      </button>
    </form>
  );
}
