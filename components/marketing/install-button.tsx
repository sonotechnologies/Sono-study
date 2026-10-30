"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/cn";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
}

/** Landing "Install the app": the browser's install prompt where there is one, otherwise how to do it by hand. */
export function InstallButton({ className }: { className?: string }) {
  const [evt, setEvt] = useState<BeforeInstallPromptEvent | null>(null);
  const [hint, setHint] = useState<string | null>(null);

  useEffect(() => {
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setEvt(e as BeforeInstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    return () => window.removeEventListener("beforeinstallprompt", onPrompt);
  }, []);

  function install() {
    if (evt) {
      void evt.prompt();
      setEvt(null);
      return;
    }
    const ios = /iphone|ipad|ipod/i.test(navigator.userAgent);
    setHint(ios ? "In Safari, tap Share, then “Add to Home Screen”." : "Open your browser menu (⋮) and tap “Install app” or “Add to Home screen”.");
  }

  return (
    <div className={cn("flex flex-col items-start gap-2 lg:items-end", className)}>
      <button
        type="button"
        onClick={install}
        className="inline-flex h-14 items-center justify-center rounded-[12px] bg-on-accent px-7 text-[17px] font-semibold text-accent transition-[filter] hover:brightness-95"
      >
        Install the app
      </button>
      {hint && (
        <p role="status" className="max-w-[320px] text-[14px] leading-snug lg:text-right">
          {hint}
        </p>
      )}
    </div>
  );
}
