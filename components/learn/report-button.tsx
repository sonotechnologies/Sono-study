"use client";

import { useState, useTransition } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { Flag } from "lucide-react";
import { reportQuestionAction } from "@/app/(app)/feedback-actions";
import { buttonClass } from "@/components/ui/primitives";
import { cn } from "@/lib/cn";

const REASONS = [
  ["wrong_answer", "Wrong answer", "The marked answer or explanation is wrong"],
  ["off_topic", "Off-topic", "Not part of this course"],
  ["copied", "Copied", "Copied from a textbook or someone's material without permission"],
  ["inappropriate", "Inappropriate", "Offensive or not suitable"],
] as const;

/** "Report" on a question (brief: content safety). Opens a bottom sheet on phones, a modal on desktop. */
export function ReportButton({ questionId, className }: { questionId: string; className?: string }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [done, setDone] = useState<null | string>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function submit() {
    if (!reason) return setError("Pick a reason.");
    setError(null);
    start(async () => {
      const res = await reportQuestionAction(questionId, reason, note);
      if (!res.ok) return setError(res.error);
      setDone(
        res.already
          ? "You've already reported this one. Thanks."
          : res.hidden
            ? "Thanks. Enough classmates flagged this, so it's hidden until we check it."
            : "Thanks. We'll check it. If two more classmates flag it, it's hidden straight away.",
      );
    });
  }

  if (done) {
    return (
      <p role="status" className={cn("text-[13px] text-ink-muted", className)}>
        {done}
      </p>
    );
  }

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger className={cn("inline-flex h-11 items-center gap-1.5 text-[13px] font-semibold text-ink-muted hover:text-ink", className)}>
        <Flag size={14} aria-hidden /> Report
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-scrim animate-[fade-in_200ms_ease-out]" />
        <Dialog.Content
          aria-describedby={undefined}
          onOpenAutoFocus={(e) => {
            e.preventDefault();
            (e.currentTarget as HTMLElement).focus();
          }}
          className={cn(
            "fixed z-50 flex flex-col gap-4 bg-surface outline-none",
            "inset-x-0 bottom-0 max-h-[92dvh] overflow-y-auto rounded-t-3xl px-5 pb-[calc(20px+env(safe-area-inset-bottom))] pt-3 animate-[sheet-up_220ms_ease-out]",
            "lg:inset-auto lg:left-1/2 lg:top-1/2 lg:w-[480px] lg:-translate-x-1/2 lg:-translate-y-1/2 lg:rounded-3xl lg:border lg:border-border lg:p-7 lg:animate-[fade-in_200ms_ease-out]",
          )}
        >
          <div aria-hidden className="h-1 w-10 self-center rounded-full bg-border lg:hidden" />
          <Dialog.Title className="font-display text-[22px] font-bold">What&apos;s wrong with this question?</Dialog.Title>
          <div role="radiogroup" aria-label="Reason" className="flex flex-col gap-2">
            {REASONS.map(([value, label, hint]) => (
              <button
                key={value}
                type="button"
                role="radio"
                aria-checked={reason === value}
                onClick={() => setReason(value)}
                className={cn(
                  "flex min-h-14 flex-col justify-center rounded-[12px] border px-4 py-2 text-left",
                  reason === value ? "border-accent bg-accent-soft" : "border-border bg-surface-2",
                )}
              >
                <span className="text-[15px] font-semibold">{label}</span>
                <span className="text-[13px] text-ink-muted">{hint}</span>
              </button>
            ))}
          </div>
          <label className="flex flex-col gap-1.5 text-[13px] text-ink-muted">
            Anything else? (optional)
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              maxLength={500}
              rows={2}
              placeholder={reason === "wrong_answer" ? "e.g. The answer should be B, because…" : undefined}
              className="rounded-[12px] border border-transparent bg-surface-2 px-3.5 py-3 text-base text-ink outline-none focus:border-accent"
            />
          </label>
          {error && (
            <p role="alert" className="text-sm text-wrong">
              {error}
            </p>
          )}
          <div className="grid grid-cols-[1fr_2fr] gap-2">
            <Dialog.Close className={buttonClass("secondary", "md")}>Cancel</Dialog.Close>
            <button type="button" disabled={pending} onClick={submit} className={buttonClass("primary", "md")}>
              {pending ? "Sending…" : "Send report"}
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
