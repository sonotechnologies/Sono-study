"use client";

/**
 * The mock exam screen (designs 1g/1i on phones, 4c on desktop). Every change is
 * written to the phone (IndexedDB) first, then synced; the sync loop, merge
 * rules and auto-submit are ported from SonoCBT's exam runtime. Zero decorative
 * motion here except the one-minute timer pulse.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, ChevronLeft, ChevronRight, Clock, Flag, LayoutGrid, X } from "lucide-react";
import { buttonClass } from "@/components/ui/primitives";
import { cn } from "@/lib/cn";
import { formatClock } from "@/lib/format";
import { mergeState, pendingAnswers, secondsLeft, withAnswer, type LocalState } from "@/lib/exam-engine/local";
import { isAnswered } from "@/lib/exam-engine/rules";
import type { AttemptResponse, RuntimePayload, RuntimeQuestion, SyncRequest, SyncResponse } from "@/lib/exam-engine/types";
import { clearLocal, loadLocal, saveLocal } from "./idb";

const HEARTBEAT_MS = 20_000;
const LETTERS = ["A", "B", "C", "D", "E", "F"];
type Net = "online" | "offline" | "signedout";
type Sheet = null | "nav" | "submit" | "leave";

export function ExamRuntime({ payload }: { payload: RuntimePayload }) {
  const router = useRouter();
  const qs = payload.questions;
  const total = qs.length;

  // ── State ────────────────────────────────────────────────────────────────
  const [s, setS] = useState<LocalState>(() => mergeState(payload, null, payload.serverNow));
  const ref = useRef(s);
  const [now, setNow] = useState(payload.serverNow);
  const [net, setNetState] = useState<Net>("online");
  const netRef = useRef<Net>("online");
  const setNet = useCallback((n: Net) => {
    netRef.current = n;
    setNetState(n);
  }, []);
  const [sheet, setSheet] = useState<Sheet>(null);
  const [storageOk, setStorageOk] = useState(true);
  const [announce, setAnnounce] = useState("");

  const inflight = useRef(false);
  const again = useRef(false);
  const retry = useRef<ReturnType<typeof setTimeout> | null>(null);
  const backoff = useRef(2000);
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);
  const warned = useRef<Set<number>>(new Set());
  /** Lets the sync loop call itself again (retries) without a stale closure. */
  const flushRef = useRef<() => Promise<void>>(async () => {});

  const commit = useCallback((fn: (s: LocalState) => LocalState) => {
    const next = fn(ref.current);
    ref.current = next;
    setS(next);
    return saveLocal(next).then((ok) => {
      setStorageOk(ok);
      return next;
    });
  }, []);

  // ── Sync ─────────────────────────────────────────────────────────────────
  const flush = useCallback(async () => {
    if (inflight.current) {
      again.current = true;
      return;
    }
    if (ref.current.done) return;
    inflight.current = true;
    if (retry.current) clearTimeout(retry.current);
    const cur = ref.current;
    const answers = pendingAnswers(cur);
    const body: SyncRequest = { attemptId: cur.attemptId, currentIndex: cur.currentIndex, answers, submit: !!cur.submitting };
    const sent = Date.now();
    try {
      const res = await fetch(payload.syncUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        cache: "no-store",
        signal: AbortSignal.timeout(20_000),
      });
      if (res.status === 401 || res.status === 403) {
        setNet("signedout");
        return;
      }
      const json = (await res.json()) as SyncResponse;
      if (!json.ok) throw new Error(json.error);
      const rtt = Date.now() - sent;
      const offset = json.serverNow + rtt / 2 - Date.now();
      await commit((x) => ({
        ...x,
        acked: Math.max(x.acked, json.ackSeq),
        offset,
        seenServerNow: json.serverNow,
        savedAt: answers.length ? json.serverNow : x.savedAt,
        deadlineAt: json.status === "in_progress" ? json.deadlineAt : x.deadlineAt,
        ...(json.status === "submitted" ? { done: json.summary, submitting: null } : {}),
      }));
      backoff.current = 2000;
      if (netRef.current !== "online") setNet("online");
      if (json.status === "submitted") {
        void clearLocal(cur.attemptId).then(() => saveLocal({ ...ref.current, answers: {} }));
        navigator.serviceWorker?.controller?.postMessage({ type: "forget", url: location.href });
        router.replace(payload.resultsUrl);
      }
    } catch {
      if (netRef.current !== "signedout") setNet("offline");
      retry.current = setTimeout(() => void flushRef.current(), backoff.current);
      backoff.current = Math.min(backoff.current * 2, 30_000);
    } finally {
      inflight.current = false;
      if (again.current) {
        again.current = false;
        void flushRef.current();
      }
    }
  }, [commit, payload.resultsUrl, payload.syncUrl, router, setNet]);
  useEffect(() => {
    flushRef.current = flush;
  }, [flush]);

  const schedule = useCallback(
    (ms: number) => {
      if (debounce.current) clearTimeout(debounce.current);
      debounce.current = setTimeout(() => void flush(), ms);
    },
    [flush],
  );

  // ── Boot: merge what this phone kept, then push anything pending ─────────
  useEffect(() => {
    let cancelled = false;
    void loadLocal(payload.attemptId).then(async (local) => {
      if (cancelled) return;
      await commit(() => mergeState(payload, local, Date.now()));
      setNow(Date.now());
      if (ref.current.done) router.replace(payload.resultsUrl);
      else void flush();
    });
    // Save this page and everything it loaded, so the mock reopens with no connection
    // (SonoCBT's "warm" step). Marked on the page once done, for support and tests.
    if ("serviceWorker" in navigator) {
      const onMessage = (ev: MessageEvent<{ type?: string; ok?: boolean }>) => {
        if (ev.data?.type === "warmed") document.documentElement.dataset.offlineReady = ev.data.ok ? "yes" : "partly";
      };
      navigator.serviceWorker.addEventListener("message", onMessage);
      // Resolves once the app's service worker is active (production only; it isn't registered in dev).
      void navigator.serviceWorker.ready.then((ready) => {
        const referenced = [...document.querySelectorAll<HTMLScriptElement | HTMLLinkElement>("script[src], link[href]")].map((el) =>
          "src" in el && el.src ? el.src : (el as HTMLLinkElement).href,
        );
        const urls = [location.href, ...performance.getEntriesByType("resource").map((r) => r.name), ...referenced];
        ready.active?.postMessage({ type: "warm", urls });
      });
    }
    // The back button asks before leaving the mock.
    history.pushState({ mock: true }, "");
    const onPop = () => {
      history.pushState({ mock: true }, "");
      setSheet("leave");
    };
    window.addEventListener("popstate", onPop);
    return () => {
      cancelled = true;
      window.removeEventListener("popstate", onPop);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Clock, heartbeat, connection events, and a last push when the tab closes.
  useEffect(() => {
    const tick = setInterval(() => setNow(Date.now()), 1000);
    const beat = setInterval(() => void flush(), HEARTBEAT_MS);
    const online = () => void flush();
    const offline = () => netRef.current !== "signedout" && setNet("offline");
    const visible = () => document.visibilityState === "visible" && void flush();
    const hide = () => {
      const cur = ref.current;
      const answers = pendingAnswers(cur);
      if (!answers.length || cur.done) return;
      try {
        void fetch(payload.syncUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ attemptId: cur.attemptId, currentIndex: cur.currentIndex, answers }),
          keepalive: true,
        });
      } catch {
        /* it's on the phone; the next visit sends it */
      }
    };
    window.addEventListener("online", online);
    window.addEventListener("offline", offline);
    document.addEventListener("visibilitychange", visible);
    window.addEventListener("pagehide", hide);
    return () => {
      clearInterval(tick);
      clearInterval(beat);
      window.removeEventListener("online", online);
      window.removeEventListener("offline", offline);
      document.removeEventListener("visibilitychange", visible);
      window.removeEventListener("pagehide", hide);
    };
  }, [flush, payload.syncUrl, setNet]);

  // ── Timer: warnings, one pulse at 1:00, auto-submit at zero ──────────────
  const left = secondsLeft(s, now);
  const done = s.done;
  useEffect(() => {
    if (done || left === null) return;
    for (const mark of [300, 60]) {
      if (left <= mark && left > 0 && !warned.current.has(mark)) {
        warned.current.add(mark);
        setAnnounce(mark === 60 ? "Less than a minute left." : "5 minutes left.");
      }
    }
    if (left === 0 && !ref.current.submitting) {
      setSheet(null);
      void commit((x) => ({ ...x, submitting: "timeout" })).then(() => flush());
    }
  }, [left, done, commit, flush]);

  // ── Answering & moving ───────────────────────────────────────────────────
  const cur = Math.min(s.currentIndex, total - 1);
  const q = qs[cur];
  const ans = q ? s.answers[q.id] : undefined;
  const locked = !!s.submitting || !!done;

  const setResponse = useCallback(
    (qid: string, response: AttemptResponse | null, text = false) => {
      if (ref.current.submitting || ref.current.done) return;
      void commit((x) => withAnswer(x, qid, { response }, Date.now())).then(() => schedule(text ? 1200 : 150));
    },
    [commit, schedule],
  );

  const choose = useCallback(
    (question: RuntimeQuestion, optionId: string) => {
      if (question.type === "true_false") return setResponse(question.id, { kind: "bool", value: optionId === "true" });
      const prev = ref.current.answers[question.id]?.response;
      const chosen = prev?.kind === "choice" ? prev.optionIds : [];
      if (question.type === "multiple") {
        const next = chosen.includes(optionId) ? chosen.filter((o) => o !== optionId) : [...chosen, optionId];
        return setResponse(question.id, { kind: "choice", optionIds: next });
      }
      setResponse(question.id, { kind: "choice", optionIds: [optionId] });
    },
    [setResponse],
  );

  const go = useCallback(
    (i: number) => {
      if (i < 0 || i >= total) return;
      setSheet((x) => (x === "nav" ? null : x));
      void commit((x) => ({ ...x, currentIndex: i })).then(() => schedule(2000));
      requestAnimationFrame(() => document.getElementById("mock-question")?.scrollTo({ top: 0 }));
    },
    [commit, schedule, total],
  );

  const toggleFlag = useCallback(() => {
    if (!q || locked) return;
    void commit((x) => withAnswer(x, q.id, { flagged: !x.answers[q.id]?.flagged }, Date.now())).then(() => schedule(400));
  }, [commit, schedule, q, locked]);

  const submit = useCallback(() => {
    setSheet(null);
    void commit((x) => ({ ...x, submitting: "student" })).then(() => flush());
  }, [commit, flush]);

  // Keyboard (desktop): A–E answer, ← → move, F flag.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey || locked || !q) return;
      const el = e.target as HTMLElement;
      const typing = el.tagName === "TEXTAREA" || el.tagName === "INPUT" || el.isContentEditable;
      if (e.key === "Escape") {
        if (sheet) setSheet(null);
        else if (typing) el.blur();
        return;
      }
      if (typing || sheet) return;
      const k = e.key.toLowerCase();
      if (k === "arrowright") go(cur + 1);
      else if (k === "arrowleft") go(cur - 1);
      else if (k === "f") toggleFlag();
      else {
        const i = LETTERS.indexOf(e.key.toUpperCase());
        if (i >= 0 && i < q.options.length) choose(q, q.options[i].id);
        else return;
      }
      e.preventDefault();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [choose, cur, go, locked, q, sheet, toggleFlag]);

  // ── Derived ──────────────────────────────────────────────────────────────
  const answeredCount = qs.filter((x) => isAnswered(s.answers[x.id]?.response)).length;
  const flaggedCount = qs.filter((x) => s.answers[x.id]?.flagged).length;
  const blank = total - answeredCount;
  const low = left !== null && left < 300;
  // One pulse as the clock reaches 1:00 (the class is on for that second; the animation runs once).
  const pulse = left === 60;
  const isLast = cur === total - 1;
  const title = payload.title;

  if (!q) return null;

  return (
    <div className="flex h-dvh flex-col bg-bg">
      <p aria-live="assertive" className="sr-only">
        {announce}
      </p>

      {/* Top bar */}
      <header className="flex h-14 flex-none items-center gap-1 border-b border-border pl-2 pr-3 lg:h-16 lg:gap-4 lg:px-6">
        <button type="button" onClick={() => setSheet("leave")} aria-label="Leave mock" className="grid size-12 place-items-center rounded-full hover:bg-surface-2 lg:hidden">
          <X size={22} aria-hidden />
        </button>
        <button type="button" onClick={() => setSheet("leave")} className={buttonClass("secondary", "sm", "hidden h-10 lg:inline-flex")}>
          Leave
        </button>
        <div className="flex min-w-0 flex-1 flex-col lg:flex-row lg:items-center lg:gap-1">
          <span className="truncate text-[15px] font-semibold lg:text-base">{title}</span>
          <span className="text-xs text-ink-muted lg:text-base lg:font-semibold lg:text-ink">
            <span className="hidden lg:inline">· </span>
            {total} questions
          </span>
        </div>
        <TimerPill left={left} low={low} pulse={pulse} />
      </header>
      <div className="h-[3px] flex-none bg-surface-2" aria-hidden>
        <div className="h-full bg-accent" style={{ width: `${((cur + 1) / total) * 100}%` }} />
      </div>

      {net !== "online" && (
        <div role="status" className="flex-none bg-surface-2 px-5 py-2 text-[13px] leading-snug">
          {net === "signedout"
            ? "You've been signed out. Your answers are safe on this phone — sign in again to keep saving."
            : "You're offline. Answers are saved on your phone and sync when you're back."}
        </div>
      )}
      {!storageOk && (
        <div role="status" className="flex-none bg-surface-2 px-5 py-2 text-[13px] leading-snug text-flag">
          This browser can&apos;t keep answers on the phone (private mode?). They still save while you&apos;re online.
        </div>
      )}

      <div className="flex min-h-0 flex-1">
        {/* Question */}
        <main id="mock-question" className="flex-1 overflow-y-auto">
          <div className="mx-auto flex w-full max-w-[720px] flex-col gap-5 px-5 py-6 lg:gap-6 lg:px-12 lg:py-14">
            <div className="flex items-center justify-between gap-3">
              <span className="font-display text-sm font-bold text-ink-muted lg:text-base">
                Question {cur + 1} of {total}
              </span>
              {q.topicName && <span className="rounded-full border border-border px-2 py-1 text-xs text-ink-muted lg:px-2.5 lg:text-[13px]">{q.topicName}</span>}
            </div>
            <p className="text-[17px] leading-[1.6] [text-wrap:pretty] lg:text-xl">{q.stem}</p>
            <Answer question={q} response={ans?.response ?? null} locked={locked} onChoose={(id) => choose(q, id)} onText={(t) => setResponse(q.id, t ? { kind: "text", text: t } : null, true)} />

            {/* Desktop actions */}
            <div className="hidden gap-2.5 pt-2 lg:flex">
              <button type="button" onClick={toggleFlag} disabled={locked} aria-pressed={!!ans?.flagged} className={buttonClass("secondary", "md", cn("px-[18px] text-flag", ans?.flagged && "border-[1.5px] border-flag"))}>
                <Flag size={18} fill={ans?.flagged ? "currentColor" : "none"} aria-hidden /> {ans?.flagged ? "Flagged" : "Flag"}
              </button>
              <span className="flex-1" />
              <button type="button" onClick={() => go(cur - 1)} disabled={cur === 0} className={buttonClass("secondary", "md", "px-5")}>
                Previous
              </button>
              {isLast ? (
                <button type="button" onClick={() => setSheet("submit")} disabled={locked} className={buttonClass("primary", "md", "px-7")}>
                  Submit
                </button>
              ) : (
                <button type="button" onClick={() => go(cur + 1)} className={buttonClass("primary", "md", "px-7")}>
                  Next
                </button>
              )}
            </div>
            <span className="hidden text-[13px] text-ink-muted lg:block">Keyboard: A–E to answer · ← → to move · F to flag</span>
          </div>
        </main>

        {/* Desktop navigator panel */}
        <aside aria-label="All questions" className="hidden w-[360px] flex-none flex-col gap-[18px] overflow-y-auto border-l border-border bg-surface px-6 py-7 lg:flex">
          <span className="font-display text-lg font-bold">All questions</span>
          <Legend answered={answeredCount} flagged={flaggedCount} blank={blank} />
          <NavGrid qs={qs} answers={s.answers} cur={cur} onGo={go} cols={5} />
          <button type="button" onClick={() => setSheet("submit")} disabled={locked} className={buttonClass("primary", "lg", "mt-auto border border-accent bg-transparent text-accent hover:bg-accent-soft hover:brightness-100")}>
            Submit {answeredCount} of {total}
          </button>
        </aside>
      </div>

      {/* Phone action bar */}
      <nav aria-label="Mock controls" className="flex flex-none items-center gap-2 border-t border-border px-4 pb-[calc(16px+env(safe-area-inset-bottom))] pt-3 lg:hidden">
        <button
          type="button"
          onClick={toggleFlag}
          disabled={locked}
          aria-label={ans?.flagged ? "Remove flag" : "Flag for review"}
          aria-pressed={!!ans?.flagged}
          className={cn("grid size-12 place-items-center rounded-[12px] bg-surface-2", ans?.flagged && "border-[1.5px] border-flag text-flag")}
        >
          <Flag size={20} strokeWidth={1.75} fill={ans?.flagged ? "currentColor" : "none"} aria-hidden />
        </button>
        <button type="button" onClick={() => setSheet("nav")} className="flex h-12 items-center gap-2 rounded-[12px] bg-surface-2 px-3.5 font-display text-sm font-bold" aria-label={`All questions, ${answeredCount} of ${total} answered`}>
          <LayoutGrid size={18} strokeWidth={1.75} aria-hidden />
          {answeredCount}/{total}
        </button>
        <button type="button" onClick={() => go(cur - 1)} disabled={cur === 0} aria-label="Previous question" className="ml-auto grid size-12 place-items-center rounded-[12px] bg-surface-2 disabled:opacity-40">
          <ChevronLeft size={20} aria-hidden />
        </button>
        {isLast ? (
          <button type="button" onClick={() => setSheet("submit")} disabled={locked} className={buttonClass("primary", "md", "px-[22px]")}>
            Submit
          </button>
        ) : (
          <button type="button" onClick={() => go(cur + 1)} className={buttonClass("primary", "md", "gap-1.5 px-[22px]")}>
            Next <ChevronRight size={18} aria-hidden />
          </button>
        )}
      </nav>

      {/* Sheets */}
      {sheet === "nav" && (
        <BottomSheet onClose={() => setSheet(null)} label="All questions" belowTopBar>
          <div className="flex items-baseline justify-between">
            <span className="font-display text-lg font-bold">All questions</span>
            {left !== null && <span className={cn("text-[13px] font-semibold", low ? "text-flag" : "text-ink-muted")}>{Math.ceil(left / 60)} min left</span>}
          </div>
          <Legend answered={answeredCount} flagged={flaggedCount} blank={blank} />
          <NavGrid qs={qs} answers={s.answers} cur={cur} onGo={go} cols={6} />
          <button type="button" onClick={() => setSheet("submit")} disabled={locked} className={buttonClass("primary", "lg")}>
            Submit {answeredCount} of {total}
          </button>
        </BottomSheet>
      )}
      {sheet === "submit" && (
        <Confirm
          title="Submit mock?"
          body={
            blank || flaggedCount
              ? `${blank} question${blank === 1 ? " is" : "s are"} still blank and ${flaggedCount} flagged. You can't change answers after submitting.`
              : "You've answered every question. You can't change answers after submitting."
          }
          cancel="Keep going"
          confirm="Submit"
          onCancel={() => setSheet(null)}
          onConfirm={submit}
        />
      )}
      {sheet === "leave" && (
        <Confirm
          title="Leave this mock?"
          body={
            left !== null
              ? "Your answers are saved. The timer keeps running, and the mock submits itself when time runs out. You can resume from Home."
              : "Your answers are saved. You can resume from Home."
          }
          cancel="Stay"
          confirm="Leave"
          onCancel={() => setSheet(null)}
          onConfirm={() => {
            void flush();
            router.push(payload.exitUrl);
          }}
        />
      )}
      {s.submitting && !done && (
        <BottomSheet label="Submitting" onClose={() => {}}>
          <span className="font-display text-[22px] font-bold">{s.submitting === "timeout" ? "Time's up." : "Submitting…"}</span>
          <p className="text-[15px] leading-relaxed text-ink-muted">
            {net === "online"
              ? "Marking your answers."
              : "Your answers are saved on this phone. We'll submit as soon as you're back online — you can close the app."}
          </p>
        </BottomSheet>
      )}
    </div>
  );
}

function TimerPill({ left, low, pulse }: { left: number | null; low: boolean; pulse: boolean }) {
  return (
    <div
      role="timer"
      aria-label={left === null ? "Untimed" : `${Math.ceil(left / 60)} minutes left`}
      className={cn(
        "flex h-9 flex-none items-center gap-1.5 rounded-full px-3 lg:h-10 lg:px-4",
        low ? "border-[1.5px] border-flag text-flag" : "bg-surface-2",
        pulse && "motion-safe:animate-[timer-pulse_200ms_ease-out]",
      )}
    >
      <Clock size={16} strokeWidth={2} className={low ? "" : "text-ink-muted"} aria-hidden />
      <span className="font-display text-base font-bold lg:text-lg">{left === null ? "Untimed" : formatClock(left)}</span>
    </div>
  );
}

function Legend({ answered, flagged, blank }: { answered: number; flagged: number; blank: number }) {
  return (
    <div className="flex gap-3.5 text-[13px] text-ink-muted">
      <span className="flex items-center gap-1.5">
        <span className="size-3 rounded bg-accent" aria-hidden />
        Answered {answered}
      </span>
      <span className="flex items-center gap-1.5">
        <span className="size-3 rounded border-2 border-flag" aria-hidden />
        Flagged {flagged}
      </span>
      <span className="flex items-center gap-1.5">
        <span className="size-3 rounded bg-surface-2" aria-hidden />
        Blank {blank}
      </span>
    </div>
  );
}

function NavGrid({
  qs,
  answers,
  cur,
  onGo,
  cols,
}: {
  qs: RuntimeQuestion[];
  answers: LocalState["answers"];
  cur: number;
  onGo: (i: number) => void;
  cols: 5 | 6;
}) {
  return (
    <ol className={cn("grid gap-2", cols === 6 ? "grid-cols-6" : "grid-cols-5")}>
      {qs.map((x, i) => {
        const a = answers[x.id];
        const done = isAnswered(a?.response);
        const flagged = !!a?.flagged;
        const current = i === cur;
        return (
          <li key={x.id}>
            <button
              type="button"
              onClick={() => onGo(i)}
              aria-label={`Question ${i + 1}${done ? ", answered" : ", blank"}${flagged ? ", flagged" : ""}`}
              aria-current={current ? "step" : undefined}
              className={cn(
                "grid h-11 w-full place-items-center rounded-[10px] text-sm font-semibold lg:h-12",
                done ? "bg-accent text-on-accent" : "bg-surface-2 text-ink-muted",
                flagged && "border-2 border-flag",
                flagged && done && "border-flag",
                current && "border-2 border-ink",
                !done && flagged && "text-ink",
              )}
            >
              {i + 1}
            </button>
          </li>
        );
      })}
    </ol>
  );
}

function Answer({
  question,
  response,
  locked,
  onChoose,
  onText,
}: {
  question: RuntimeQuestion;
  response: AttemptResponse | null;
  locked: boolean;
  onChoose: (optionId: string) => void;
  onText: (text: string) => void;
}) {
  if (question.type === "fill_in") {
    return (
      <label className="flex flex-col gap-2 text-[13px] text-ink-muted">
        Your answer
        <input
          key={question.id}
          defaultValue={response?.kind === "text" ? response.text : ""}
          onChange={(e) => onText(e.target.value)}
          disabled={locked}
          maxLength={200}
          autoComplete="off"
          enterKeyHint="done"
          className="h-[52px] rounded-[12px] border border-transparent bg-surface-2 px-3.5 text-base text-ink outline-none focus:border-accent focus:shadow-[0_0_0_3px_var(--accent-soft)]"
        />
      </label>
    );
  }
  const selected = (id: string) =>
    response?.kind === "choice" ? response.optionIds.includes(id) : response?.kind === "bool" ? String(response.value) === id : false;
  const multi = question.type === "multiple";
  return (
    <div role={multi ? "group" : "radiogroup"} aria-label="Options" className="flex flex-col gap-2 lg:gap-2.5">
      {multi && <span className="text-[13px] text-ink-muted">Select all that apply.</span>}
      {question.options.map((o, i) => {
        const on = selected(o.id);
        return (
          <button
            key={o.id}
            type="button"
            role={multi ? "checkbox" : "radio"}
            aria-checked={on}
            disabled={locked}
            onClick={() => onChoose(o.id)}
            className={cn(
              "flex min-h-[52px] items-center gap-3 rounded-[12px] border px-3.5 py-2.5 text-left text-base lg:min-h-14 lg:gap-3.5 lg:px-4 lg:text-[17px]",
              on ? "border-accent bg-accent-soft font-medium" : "border-surface-2 bg-surface-2 hover:border-border",
            )}
          >
            <span
              aria-hidden
              className={cn(
                "grid size-7 flex-none place-items-center text-[13px] lg:size-[30px]",
                multi ? "rounded-md" : "rounded-full",
                on ? "bg-accent font-bold text-on-accent" : "border-[1.5px] border-ink-muted font-semibold text-ink-muted",
              )}
            >
              {multi && on ? <Check size={16} strokeWidth={3} /> : LETTERS[i]}
            </span>
            <span className="leading-snug">{o.text}</span>
          </button>
        );
      })}
    </div>
  );
}

function BottomSheet({ children, onClose, label, belowTopBar }: { children: React.ReactNode; onClose: () => void; label: string; belowTopBar?: boolean }) {
  return (
    <div className="fixed inset-0 z-40" role="dialog" aria-modal="true" aria-label={label}>
      <button type="button" aria-label="Close" onClick={onClose} className={cn("absolute inset-x-0 bottom-0 bg-scrim", belowTopBar ? "top-14 lg:top-16" : "top-0")} />
      <div className="absolute inset-x-0 bottom-0 flex flex-col gap-4 rounded-t-3xl bg-surface px-5 pb-[calc(20px+env(safe-area-inset-bottom))] pt-3 lg:inset-x-auto lg:bottom-auto lg:left-1/2 lg:top-1/2 lg:w-[480px] lg:-translate-x-1/2 lg:-translate-y-1/2 lg:rounded-3xl lg:border lg:border-border lg:p-8">
        <div aria-hidden className="h-1 w-10 self-center rounded-full bg-border lg:hidden" />
        {children}
      </div>
    </div>
  );
}

function Confirm({
  title,
  body,
  cancel,
  confirm,
  onCancel,
  onConfirm,
}: {
  title: string;
  body: string;
  cancel: string;
  confirm: string;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <BottomSheet onClose={onCancel} label={title}>
      <span className="font-display text-[22px] font-bold">{title}</span>
      <p className="text-[15px] leading-[1.6] text-ink-muted">{body}</p>
      <div className="grid grid-cols-2 gap-2">
        <button type="button" autoFocus onClick={onCancel} className={buttonClass("secondary", "lg")}>
          {cancel}
        </button>
        <button type="button" onClick={onConfirm} className={buttonClass("primary", "lg")}>
          {confirm}
        </button>
      </div>
    </BottomSheet>
  );
}
