import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Check, X } from "lucide-react";
import { getDb } from "@/db";
import { TopBar } from "@/components/account/top-bar";
import { ButtonLink, Card } from "@/components/ui/primitives";
import { cn } from "@/lib/cn";
import { correctOptionIds } from "@/lib/exam-engine/rules";
import { getResult } from "@/lib/exam-engine/service";
import { requireViewer } from "@/lib/viewer";

export const metadata: Metadata = { title: "Review" };

const LETTERS = ["A", "B", "C", "D", "E", "F"];

/** Question review: correct/wrong state, explanation, source and navigation. */
export default async function ReviewPage({ params }: { params: Promise<{ attemptId: string; n: string }> }) {
  const { attemptId, n } = await params;
  const viewer = await requireViewer();
  const r = await getResult(await getDb(), viewer.id, attemptId);
  const index = Number(n) - 1;
  if (!r || !Number.isInteger(index) || !r.items[index]) notFound();
  const item = r.items[index];
  const q = item.question;
  const total = r.items.length;
  const right = correctOptionIds(q.answer);
  const picked =
    item.response?.kind === "choice" ? item.response.optionIds : item.response?.kind === "bool" ? [String(item.response.value)] : [];
  const verdict = item.isCorrect ? "Correct" : item.answered ? "Wrong" : "Skipped";
  const base = `/results/${attemptId}`;

  return (
    <main className="mx-auto flex min-h-[calc(100dvh-64px)] max-w-[720px] flex-col lg:min-h-dvh lg:pt-6">
      <div className="flex items-center pr-5 lg:pr-0">
        <div className="flex-1">
          <TopBar back={base} title={`Review · Q${index + 1} of ${total}`} />
        </div>
        <span className={cn("text-sm font-semibold", item.isCorrect ? "text-correct" : "text-wrong")}>{verdict}</span>
      </div>

      <div className="flex flex-1 flex-col gap-4 px-5 pb-4 lg:px-0">
        {q.topicName && <span className="self-start rounded-full border border-border px-2 py-1 text-xs text-ink-muted">{q.topicName}</span>}
        <p className="text-[17px] leading-[1.6] [text-wrap:pretty] lg:text-xl">{q.stem}</p>

        {q.type === "fill_in" ? (
          <div className="flex flex-col gap-2">
            <div className={cn("rounded-[12px] border px-3.5 py-3 text-base", item.isCorrect ? "border-correct bg-correct-soft" : "border-wrong bg-wrong-soft")}>
              <span className="text-[13px] text-ink-muted">Your answer</span>
              <p>{item.response?.kind === "text" && item.response.text.trim() ? item.response.text : "—"}</p>
            </div>
            {!item.isCorrect && q.answer.kind === "fill_in" && (
              <div className="rounded-[12px] border border-correct bg-correct-soft px-3.5 py-3 text-base">
                <span className="text-[13px] text-ink-muted">Accepted</span>
                <p>{q.answer.accepted.join(" · ")}</p>
              </div>
            )}
          </div>
        ) : (
          <ul className="flex flex-col gap-2">
            {q.displayOptions.map((o, i) => {
              const isRight = right.includes(o.id);
              const isPicked = picked.includes(o.id);
              const tag = isRight ? (isPicked ? "Your answer ✓" : "Correct") : isPicked ? "Your answer ✗" : null;
              return (
                <li
                  key={o.id}
                  className={cn(
                    "flex min-h-[52px] items-center gap-3 rounded-[12px] border px-3.5 py-2.5 text-base leading-snug",
                    isRight ? "border-correct bg-correct-soft" : isPicked ? "border-wrong bg-wrong-soft" : "border-surface-2 bg-surface-2",
                  )}
                >
                  <span
                    aria-hidden
                    className={cn(
                      "grid size-7 flex-none place-items-center rounded-full text-[13px] font-bold",
                      isRight ? "bg-correct text-bg" : isPicked ? "bg-wrong text-bg" : "border-[1.5px] border-ink-muted text-ink-muted",
                    )}
                  >
                    {isRight ? <Check size={16} strokeWidth={3} /> : isPicked ? <X size={16} strokeWidth={3} /> : LETTERS[i]}
                  </span>
                  <span className="flex-1">{o.text}</span>
                  {tag && <span className={cn("text-xs font-semibold", isRight ? "text-correct" : "text-wrong")}>{tag}</span>}
                </li>
              );
            })}
          </ul>
        )}

        {(q.explanation || q.sourceLabel) && (
          <Card className="flex flex-col gap-2 p-4">
            <h2 className="font-display text-base font-bold">Why</h2>
            {q.explanation && <p className="text-[15px] leading-[1.6]">{q.explanation}</p>}
            {q.sourceLabel && <span className="text-[13px] font-semibold text-accent">{q.sourceLabel}</span>}
          </Card>
        )}
      </div>

      <div className="sticky bottom-[calc(64px+env(safe-area-inset-bottom))] grid grid-cols-2 gap-2 bg-bg px-5 pb-5 pt-3 lg:bottom-0 lg:px-0">
        {index > 0 ? (
          <ButtonLink href={`${base}/review/${index}`} variant="secondary" size="lg">
            Previous
          </ButtonLink>
        ) : (
          <ButtonLink href={base} variant="secondary" size="lg">
            Results
          </ButtonLink>
        )}
        {index < total - 1 ? (
          <ButtonLink href={`${base}/review/${index + 2}`} size="lg">
            Next
          </ButtonLink>
        ) : (
          <ButtonLink href={base} size="lg">
            Back to results
          </ButtonLink>
        )}
      </div>
    </main>
  );
}
