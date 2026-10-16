"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertCircle, Check } from "lucide-react";
import { startFromUploadAction } from "@/app/(app)/upload/actions";
import { buttonClass, ButtonLink } from "@/components/ui/primitives";
import type { UploadView } from "@/lib/uploads";
import { ProgressCard, type ProgressPhase } from "./progress-card";

const POLL_MS = 2500;
const UNIT: Record<string, string> = { pdf: "page", pptx: "slide", docx: "section", photos: "photo" };

function phaseOf(v: UploadView): ProgressPhase {
  if (v.status === "extracting") return "reading";
  if (v.status === "generating") return "making";
  return "waiting";
}

export function UploadStatus({ initial }: { initial: UploadView }) {
  const [view, setView] = useState(initial);
  const done = view.status === "ready" || view.status === "failed" || view.uploading;

  useEffect(() => {
    if (done) return;
    let stopped = false;
    let timer: ReturnType<typeof setTimeout>;
    const tick = async () => {
      if (document.visibilityState === "visible") {
        try {
          const res = await fetch(`/api/uploads/${initial.id}`, { cache: "no-store" });
          if (res.ok && !stopped) setView(await res.json());
        } catch {
          // Offline for a moment: keep showing the last state and try again.
        }
      }
      if (!stopped) timer = setTimeout(tick, POLL_MS);
    };
    timer = setTimeout(tick, 600);
    return () => {
      stopped = true;
      clearTimeout(timer);
    };
  }, [done, initial.id]);

  if (view.status === "ready") return <Ready view={view} />;
  if (view.status === "failed" || view.uploading) return <Failed view={view} />;

  return (
    <div className="flex flex-1 flex-col gap-4 px-5 pb-5 pt-3 lg:px-0">
      <ProgressCard
        view={{
          phase: phaseOf(view),
          sizeBytes: view.sizeBytes,
          pagesUsed: view.pagesUsed,
          pageUnit: UNIT[view.type],
          questionsMade: view.questionsMade,
          chunksDone: view.chunksDone,
          chunksTotal: view.chunksTotal,
          statusLine: view.statusLine,
          etaMin: view.queue?.busy ? view.queue.etaMin : null,
        }}
      />
      <p className="text-sm leading-relaxed text-ink-muted">
        You can leave this screen. Your questions keep cooking on our side, even if your data drops, and they&apos;ll be waiting under Upload.
      </p>
      <ButtonLink href={`/courses/${view.courseId}/mock`} variant="secondary" className="mt-auto">
        Practise {view.courseCode} while you wait
      </ButtonLink>
    </div>
  );
}

function Ready({ view }: { view: UploadView }) {
  const router = useRouter();
  const [pending, setPending] = useState<null | "mock" | "practice">(null);
  const source = view.type === "photos" ? `your ${view.fileCount} photo${view.fileCount === 1 ? "" : "s"}` : view.title;
  const where = view.linked
    ? `It's already in the ${view.courseCode} bank.`
    : view.contribute
      ? `Added to ${view.courseCode} and shared with your class.`
      : `Added to ${view.courseCode}, just for you.`;
  const mockCount = Math.min(20, view.questionsMade);

  async function start(mode: "mock" | "practice") {
    setPending(mode);
    try {
      await startFromUploadAction(view.id, mode); // redirects to the mock
    } catch {
      setPending(null);
      router.refresh();
    }
  }

  return (
    <div className="flex flex-1 flex-col gap-5 px-5 pb-5 pt-8 lg:px-0 lg:pt-4">
      <span className="grid size-16 place-items-center rounded-full bg-correct">
        <Check size={34} strokeWidth={3} className="text-bg" aria-hidden />
      </span>
      <div className="flex flex-col gap-2">
        <h1 className="font-display text-[40px] font-bold leading-none">
          {view.questionsMade} question{view.questionsMade === 1 ? "" : "s"}
        </h1>
        <p className="text-base leading-normal text-ink-muted">
          {view.reused ? `Ready instantly: a classmate uploaded this same file, so nothing had to be made again. ` : `Ready from ${source}. `}
          {where}
        </p>
        {view.isPastPaper && <p className="text-sm text-ink-muted">These are the paper&apos;s real questions, tagged &ldquo;past question&rdquo;, with answers worked out by AI.</p>}
        {view.pagesCapped && (
          <p className="text-sm text-ink-muted">
            We read the first {view.pagesUsed} of {view.pageCount} {UNIT[view.type]}s, your plan&apos;s limit per upload.
          </p>
        )}
      </div>
      {view.topics.length > 0 && (
        <div className="flex flex-col gap-2">
          <span className="text-[13px] text-ink-muted">Topics we found</span>
          <ul className="flex flex-wrap gap-2">
            {view.topics.map((t) => (
              <li key={t.name} className="flex h-9 items-center rounded-full border border-border bg-surface px-3 text-sm">
                {t.name} · {t.count}
              </li>
            ))}
          </ul>
        </div>
      )}
      {view.flashcardsMade > 0 && (
        <div className="flex items-center justify-between rounded-2xl border border-border bg-surface p-3.5">
          <span className="text-sm">Also made {view.flashcardsMade} flashcards</span>
          {view.xpEarned > 0 && <span className="text-sm font-semibold text-spark">+{view.xpEarned} XP</span>}
        </div>
      )}
      <p className="text-[13px] leading-normal text-ink-muted">
        Questions and explanations are AI-generated from your notes. Spot a mistake?{" "}
        <Link href={`/upload/${view.id}/questions`} className="font-semibold text-accent">
          Review and fix it
        </Link>
        .
      </p>
      <div className="mt-auto flex flex-col gap-2">
        <button type="button" disabled={!!pending || mockCount === 0} onClick={() => start("mock")} className={buttonClass("primary", "lg")}>
          {pending === "mock" ? "Starting…" : `Start a ${mockCount}-question mock`}
        </button>
        <div className="grid grid-cols-2 gap-2">
          <button type="button" disabled={!!pending} onClick={() => start("practice")} className={buttonClass("secondary", "md")}>
            {pending === "practice" ? "Starting…" : "Practise"}
          </button>
          <ButtonLink href={`/upload/${view.id}/questions`} variant="secondary">
            Review questions
          </ButtonLink>
        </div>
      </div>
    </div>
  );
}

function Failed({ view }: { view: UploadView }) {
  return (
    <div className="flex flex-1 flex-col gap-4 px-5 pb-5 pt-8 lg:px-0 lg:pt-4">
      <span className="grid size-16 place-items-center rounded-full bg-wrong-soft">
        <AlertCircle size={32} className="text-wrong" aria-hidden />
      </span>
      <h1 className="font-display text-[28px] font-bold leading-tight">{view.uploading ? "This upload didn't finish" : "We couldn't make questions from this"}</h1>
      <p className="text-base leading-normal text-ink-muted">
        {view.uploading ? "The file never fully reached us, so nothing was counted against your uploads. Pick it again to retry." : view.error}
      </p>
      <div className="mt-auto flex flex-col gap-2">
        <ButtonLink href={`/upload?course=${view.courseId}`} size="lg">
          Upload again
        </ButtonLink>
        <ButtonLink href={`/courses/${view.courseId}/mock`} variant="secondary">
          Practise a shared {view.courseCode} bank
        </ButtonLink>
      </div>
    </div>
  );
}
