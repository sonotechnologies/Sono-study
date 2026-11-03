"use client";

import { useEffect, useState } from "react";
import { buttonClass } from "@/components/ui/primitives";

/** Shown when a screen fails to load: says whether it's the connection, and offers a retry. */
export function ErrorScreen({ retry, digest }: { retry: () => void; digest?: string }) {
  const [offline, setOffline] = useState(false);
  useEffect(() => {
    const update = () => setOffline(!navigator.onLine);
    update();
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);
  return (
    <main className="mx-auto flex min-h-[70dvh] max-w-[480px] flex-col justify-center gap-4 px-5 py-12">
      <h1 className="font-display text-[30px] font-bold leading-tight">{offline ? "You're offline." : "That didn't load."}</h1>
      <p className="text-base leading-relaxed text-ink-muted">
        {offline
          ? "Check your data or Wi-Fi. Screens you've opened before still work, and your answers sync when you're back."
          : "Something went wrong on our side. Try again; if it keeps happening, go back home and try another way."}
      </p>
      <div className="flex flex-col gap-2 sm:flex-row">
        <button type="button" onClick={retry} className={buttonClass("primary", "lg", "w-full sm:w-auto")}>
          Try again
        </button>
        {/* A plain link: a full reload, which the service worker can answer offline. */}
        <a href="/home" className={buttonClass("secondary", "lg", "w-full sm:w-auto")}>
          Back to home
        </a>
      </div>
      {digest && <p className="text-xs text-ink-muted">Error code {digest}</p>}
    </main>
  );
}
