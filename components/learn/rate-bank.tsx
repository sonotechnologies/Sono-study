"use client";

import { useState, useTransition } from "react";
import { Star } from "lucide-react";
import { rateBankAction } from "@/app/(app)/feedback-actions";
import { cn } from "@/lib/cn";

/** "Shared bank ratings": five stars after finishing a mock from a classmate's bank. */
export function RateBank({ bankId, title, initial }: { bankId: string; title: string; initial: number | null }) {
  const [stars, setStars] = useState(initial);
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function rate(n: number) {
    setStars(n);
    start(async () => {
      const res = await rateBankAction(bankId, n);
      setMsg(res.ok ? `Thanks. ${res.count} rating${res.count === 1 ? "" : "s"}, average ${res.rating.toFixed(1)}.` : res.error);
    });
  }

  return (
    <section className="flex flex-col gap-2 rounded-2xl border border-border bg-surface p-4" aria-label="Rate this bank">
      <span className="text-[15px] font-semibold">How good was “{title}”?</span>
      <div role="radiogroup" aria-label="Stars" className="flex gap-1">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            role="radio"
            aria-checked={stars === n}
            aria-label={`${n} star${n === 1 ? "" : "s"}`}
            disabled={pending}
            onClick={() => rate(n)}
            className="grid size-11 place-items-center rounded-full hover:bg-surface-2"
          >
            <Star size={26} className={cn(stars && n <= stars ? "fill-spark text-spark" : "text-ink-muted")} aria-hidden />
          </button>
        ))}
      </div>
      <p className="text-[13px] text-ink-muted" aria-live="polite">
        {msg ?? "Ratings help classmates pick the best banks."}
      </p>
    </section>
  );
}
