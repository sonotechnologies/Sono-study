import type { Metadata } from "next";
import { Logo } from "@/components/logo";

export const metadata: Metadata = { title: "Offline" };
export const dynamic = "force-static";

/** Shown by the service worker when there's no connection and no saved copy of the page. */
export default function OfflinePage() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-[480px] flex-col gap-5 px-5 pt-16">
      <Logo />
      <h1 className="font-display text-[32px] font-bold leading-tight">You&apos;re offline.</h1>
      <p className="text-base leading-relaxed text-ink-muted">
        This page isn&apos;t saved on your phone yet. Screens you&apos;ve opened before still work, and anything you do will sync when you&apos;re back online.
      </p>
      {/* A plain link so it does a full reload, which the service worker can answer. */}
      <a href="/home" className="font-semibold text-accent">
        Try again
      </a>
    </main>
  );
}
