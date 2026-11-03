"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { ArrowUp, ChevronLeft } from "lucide-react";
import { askTutorAction } from "@/app/(app)/tutor/actions";
import type { TutorCitation } from "@/db/schema";
import { cn } from "@/lib/cn";
import type { QuickAction } from "@/lib/tutor";

type Msg = {
  id: string;
  role: "user" | "assistant";
  content: string;
  citations: TutorCitation[];
};

const QUICK: { action: QuickAction; label: string }[] = [
  { action: "quiz", label: "Quiz me on this" },
  { action: "simpler", label: "Explain simpler" },
  { action: "example", label: "Give an example" },
];

function citationHref(c: TutorCitation) {
  if (!c.own) return null; // classmates' files stay private: show where it's from, no link
  const pdf = /· p\.\d/.test(c.label);
  return `/api/uploads/${c.uploadId}/file?n=${c.page ?? 1}${pdf && c.page ? `#page=${c.page}` : ""}`;
}

/** Tutor chat (designs 2m empty state, 2n chat with citation chips and quick actions). */
export function TutorChat({
  courseId,
  courseCode,
  sources,
  examples,
  initial,
  remaining: initialRemaining,
  limit,
}: {
  courseId: string;
  courseCode: string;
  sources: { own: number; shared: number };
  examples: string[];
  initial: Msg[];
  remaining: number;
  limit: number;
}) {
  const [messages, setMessages] = useState<Msg[]>(initial);
  const [text, setText] = useState("");
  const [error, setError] = useState<{ text: string; limit: boolean } | null>(
    null,
  );
  const [remaining, setRemaining] = useState(initialRemaining);
  const [pending, start] = useTransition();
  const [waiting, setWaiting] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement>(null);
  // Desktop source panel (5g): the citation picked last, else the latest answer's first one.
  const [picked, setPicked] = useState<TutorCitation | null>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [messages.length, waiting]);

  function send(input: { text?: string; action?: QuickAction }, shown: string) {
    if (pending) return;
    setError(null);
    setWaiting(shown);
    start(async () => {
      const res = await askTutorAction(courseId, input);
      setWaiting(null);
      if (!res.ok) {
        setError({ text: res.error, limit: res.code === "limit" });
        return;
      }
      setText("");
      setRemaining(res.remaining);
      setMessages((m) => [
        ...m,
        {
          id: `${res.reply.id}-q`,
          role: "user",
          content: shown,
          citations: [],
        },
        {
          id: res.reply.id,
          role: "assistant",
          content: res.reply.content,
          citations: res.reply.citations,
        },
      ]);
    });
  }

  const known = [
    sources.own && `your ${sources.own} upload${sources.own === 1 ? "" : "s"}`,
    sources.shared && `${sources.shared} from classmates`,
  ]
    .filter(Boolean)
    .join(" + ");
  const last = messages.at(-1);
  const source =
    picked ??
    [...messages]
      .reverse()
      .find((m) => m.role === "assistant" && m.citations.length)
      ?.citations[0] ??
    null;
  const sourceHref = source ? citationHref(source) : null;

  return (
    <div className="flex min-h-0 flex-1 lg:grid lg:grid-cols-[minmax(0,1fr)_360px]">
      <div className="flex min-h-0 min-w-0 flex-1 flex-col lg:mx-auto lg:w-full lg:max-w-[760px] lg:px-8">
        <div className="flex h-14 flex-none items-center gap-1 border-b border-border pl-1 pr-5 lg:h-16 lg:pl-0 lg:pr-0">
          <Link
            href={`/courses/${courseId}`}
            aria-label="Back"
            className="grid size-12 place-items-center rounded-full hover:bg-surface-2 lg:-ml-3"
          >
            <ChevronLeft size={22} aria-hidden />
          </Link>
          <div className="flex flex-1 flex-col lg:flex-row lg:items-center lg:justify-between">
            <span className="font-display text-base font-bold lg:text-lg">
              Tutor · {courseCode}
            </span>
            <span className="text-xs text-ink-muted lg:text-[13px]">
              {known ? `Knows ${known}` : "No notes yet for this course"}
            </span>
          </div>
        </div>

        <div
          className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-5 py-4 lg:px-0 lg:py-6"
          aria-live="polite"
        >
          {messages.length === 0 && !waiting ? (
            <div className="flex flex-1 flex-col justify-center gap-3 py-6">
              <h1 className="font-display text-[26px] font-bold">
                Stuck on something?
              </h1>
              <p className="text-[15px] leading-relaxed text-ink-muted">
                {known
                  ? "Answers come from your notes, with the page they're from, so you can check."
                  : `Upload your ${courseCode} notes first. The tutor only answers from them.`}
              </p>
              {known ? (
                <ul className="flex flex-col gap-2 pt-2">
                  {examples.map((e) => (
                    <li key={e}>
                      <button
                        type="button"
                        onClick={() => send({ text: e }, e)}
                        className="flex min-h-12 w-full items-center rounded-[12px] border border-border bg-surface px-4 text-left text-[15px] hover:border-accent"
                      >
                        {e}
                      </button>
                    </li>
                  ))}
                </ul>
              ) : (
                <Link
                  href={`/upload?course=${courseId}`}
                  className="text-[15px] font-semibold text-accent"
                >
                  Upload notes
                </Link>
              )}
            </div>
          ) : (
            messages.map((m) =>
              m.role === "user" ? (
                <p
                  key={m.id}
                  className="max-w-[85%] self-end whitespace-pre-wrap rounded-[16px_16px_4px_16px] bg-accent-soft px-4 py-3 text-[15px] leading-relaxed"
                >
                  {m.content}
                </p>
              ) : (
                <div
                  key={m.id}
                  className="flex max-w-[92%] flex-col gap-2 self-start"
                >
                  <p className="whitespace-pre-wrap rounded-[16px_16px_16px_4px] border border-border bg-surface px-4 py-3 text-[15px] leading-relaxed">
                    {m.content}
                  </p>
                  {m.citations.length > 0 && (
                    <ul className="flex flex-wrap gap-1.5" aria-label="Sources">
                      {m.citations.map((c) => {
                        const href = citationHref(c);
                        const cls =
                          "tap flex h-8 items-center rounded-full border px-3 text-xs font-semibold text-accent";
                        const on =
                          source?.id === c.id && source.uploadId === c.uploadId;
                        return (
                          <li key={c.id}>
                            {/* Phone: opens the page. Desktop: shows it in the source panel. */}
                            {href ? (
                              <a
                                href={href}
                                target="_blank"
                                rel="noopener"
                                className={cn(
                                  cls,
                                  "border-border hover:border-accent lg:hidden",
                                )}
                              >
                                {c.label}
                              </a>
                            ) : (
                              <span
                                className={cn(cls, "border-border lg:hidden")}
                              >
                                {c.label}
                              </span>
                            )}
                            <button
                              type="button"
                              onClick={() => setPicked(c)}
                              aria-pressed={on}
                              className={cn(
                                cls,
                                "hidden lg:flex",
                                on
                                  ? "border-accent bg-accent-soft"
                                  : "border-border hover:border-accent",
                              )}
                            >
                              {c.label}
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>
              ),
            )
          )}
          {waiting && (
            <>
              <p className="max-w-[85%] self-end rounded-[16px_16px_4px_16px] bg-accent-soft px-4 py-3 text-[15px] opacity-70">
                {waiting}
              </p>
              <p className="self-start rounded-[16px_16px_16px_4px] border border-border bg-surface px-4 py-3 text-[15px] text-ink-muted">
                Checking your notes…
              </p>
            </>
          )}
          <div ref={endRef} />
        </div>

        <div className="flex flex-none flex-col gap-2 border-t border-border bg-bg px-5 pb-3 pt-2 lg:px-0">
          {last?.role === "assistant" &&
            last.citations.length > 0 &&
            !pending && (
              <div className="-mx-5 flex gap-2 overflow-x-auto px-5 lg:mx-0 lg:px-0">
                {QUICK.map((q) => (
                  <button
                    key={q.action}
                    type="button"
                    onClick={() => send({ action: q.action }, q.label)}
                    className="h-11 flex-none rounded-full border border-border bg-surface px-4 text-[13px] font-semibold hover:border-accent"
                  >
                    {q.label}
                  </button>
                ))}
              </div>
            )}
          {error && (
            <p role="alert" className="text-sm text-wrong">
              {error.text}{" "}
              {error.limit && (
                <Link
                  href="?paywall=1"
                  scroll={false}
                  className="font-semibold text-accent"
                >
                  Get more with Pro
                </Link>
              )}
            </p>
          )}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (text.trim()) send({ text: text.trim() }, text.trim());
            }}
            className="flex gap-2"
          >
            <label htmlFor="tutor-input" className="sr-only">
              Ask about {courseCode}
            </label>
            <input
              id="tutor-input"
              value={text}
              onChange={(e) => setText(e.target.value)}
              maxLength={1000}
              placeholder={
                messages.length
                  ? "Ask a follow-up…"
                  : `Ask about ${courseCode}…`
              }
              autoComplete="off"
              className="h-12 min-w-0 flex-1 rounded-[12px] border border-transparent bg-surface-2 px-4 text-base text-ink outline-none focus:border-accent"
            />
            <button
              type="submit"
              disabled={pending || !text.trim()}
              aria-label="Send"
              className="grid size-12 flex-none place-items-center rounded-[12px] bg-accent text-on-accent disabled:opacity-50"
            >
              <ArrowUp size={20} aria-hidden />
            </button>
          </form>
          <p className="text-center text-xs text-ink-muted">
            AI answers from your notes · {remaining} of {limit} left today
          </p>
        </div>
      </div>
      <aside
        aria-label="Source"
        className="hidden min-h-0 flex-col gap-3 overflow-y-auto border-l border-border bg-surface px-6 py-6 lg:flex"
      >
        <h2 className="font-display text-lg font-bold">Source</h2>
        {source ? (
          <>
            <span className="text-sm text-ink-muted">{source.label}</span>
            {source.quote ? (
              <blockquote className="border-l-2 border-accent pl-3.5 text-[15px] leading-relaxed">
                &ldquo;{source.quote}&rdquo;
              </blockquote>
            ) : (
              <p className="text-sm text-ink-muted">
                The passage this answer used.
              </p>
            )}
            {sourceHref ? (
              <a
                href={sourceHref}
                target="_blank"
                rel="noopener"
                className="tap self-start text-sm font-semibold text-accent"
              >
                Open{" "}
                {/slide/.test(source.label)
                  ? "the slides"
                  : /photo/.test(source.label)
                    ? "the photo"
                    : "the page"}
              </a>
            ) : (
              !source.own && (
                <p className="text-[13px] text-ink-muted">
                  From a classmate&apos;s shared notes. Their files stay
                  private.
                </p>
              )
            )}
          </>
        ) : (
          <p className="text-sm leading-relaxed text-ink-muted">
            Ask something and the page each answer comes from shows here, so you
            can check it against your notes.
          </p>
        )}
      </aside>
    </div>
  );
}
