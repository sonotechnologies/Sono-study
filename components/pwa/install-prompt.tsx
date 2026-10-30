"use client";

import { useEffect, useState } from "react";
import { Download, X } from "lucide-react";
import { buttonClass } from "@/components/ui/primitives";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

const DISMISS_KEY = "sono-install-dismissed";
const SNOOZE_MS = 14 * 24 * 3600_000;

function snoozed() {
  try {
    const at = Number(localStorage.getItem(DISMISS_KEY));
    return at > 0 && Date.now() - at < SNOOZE_MS;
  } catch {
    return false;
  }
}

/**
 * "Install Sono Study" card. Android/Chrome: uses the browser's install prompt.
 * iPhone Safari (no prompt API): explains Share → Add to Home Screen.
 */
export function InstallPrompt() {
  const [evt, setEvt] = useState<BeforeInstallPromptEvent | null>(null);
  const [ios, setIos] = useState(false);
  const [hidden, setHidden] = useState(true);

  useEffect(() => {
    const standalone = window.matchMedia("(display-mode: standalone)").matches || (navigator as { standalone?: boolean }).standalone;
    if (standalone || snoozed()) return;
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setEvt(e as BeforeInstallPromptEvent);
      setHidden(false);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    // iPhone Safari never fires beforeinstallprompt; show the manual hint after first paint.
    const isIos = /iphone|ipad|ipod/i.test(navigator.userAgent) && !/crios|fxios/i.test(navigator.userAgent);
    const iosTimer = isIos
      ? setTimeout(() => {
          setIos(true);
          setHidden(false);
        }, 0)
      : undefined;
    const onInstalled = () => setHidden(true);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      clearTimeout(iosTimer);
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  if (hidden) return null;

  function dismiss() {
    try {
      localStorage.setItem(DISMISS_KEY, String(Date.now()));
    } catch {}
    setHidden(true);
  }

  return (
    <aside aria-label="Install the app" className="flex items-center gap-3 rounded-2xl border border-border bg-surface p-4">
      <span className="grid size-10 flex-none place-items-center rounded-[12px] bg-accent-soft text-accent">
        <Download size={20} strokeWidth={1.75} aria-hidden />
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="text-[15px] font-semibold">Install Sono Study</span>
        <span className="text-[13px] leading-snug text-ink-muted">
          {ios ? "Tap Share, then “Add to Home Screen”." : "Opens faster, uses less data, works offline."}
        </span>
      </div>
      {evt && (
        <button
          type="button"
          className={buttonClass("primary", "sm", "h-10")}
          onClick={async () => {
            await evt.prompt();
            const { outcome } = await evt.userChoice;
            if (outcome === "accepted") setHidden(true);
            setEvt(null);
          }}
        >
          Install
        </button>
      )}
      <button type="button" aria-label="Not now" onClick={dismiss} className="grid size-10 flex-none place-items-center rounded-full text-ink-muted hover:bg-surface-2">
        <X size={18} aria-hidden />
      </button>
    </aside>
  );
}
