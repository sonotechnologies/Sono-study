"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { hideQuestion } from "@/app/(app)/courses/[courseId]/questions/new/actions";

export function RemoveQuestionButton({ questionId, n }: { questionId: string; n: number }) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [pending, start] = useTransition();
  if (!confirming) {
    return (
      <button type="button" onClick={() => setConfirming(true)} aria-label={`Delete question ${n}`} className="grid size-11 place-items-center rounded-full text-ink-muted hover:bg-surface-2">
        <Trash2 size={18} aria-hidden />
      </button>
    );
  }
  return (
    <span className="flex items-center gap-1">
      <button type="button" onClick={() => setConfirming(false)} className="h-11 px-2 text-sm text-ink-muted">
        Keep
      </button>
      <button
        type="button"
        disabled={pending}
        onClick={() => start(async () => (await hideQuestion(questionId), router.refresh()))}
        className="h-11 rounded-[10px] px-3 text-sm font-semibold text-wrong hover:bg-wrong-soft"
      >
        {pending ? "Deleting…" : "Delete"}
      </button>
    </span>
  );
}
