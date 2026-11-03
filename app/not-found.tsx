import type { Metadata } from "next";
import Link from "next/link";
import { Logo } from "@/components/logo";
import { buttonClass } from "@/components/ui/primitives";

export const metadata: Metadata = { title: "Page not found" };

/** Any unknown address: themed, outside the app shell, with a way back. */
export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-[480px] flex-col gap-5 px-5 pb-8 pt-16">
      <Link href="/" aria-label="Sono Study home" className="self-start">
        <Logo />
      </Link>
      <span className="font-display text-[64px] font-bold leading-none text-accent">404</span>
      <h1 className="font-display text-[32px] font-bold leading-tight">This page isn&apos;t here.</h1>
      <p className="text-base leading-relaxed text-ink-muted">The link may be old, or the page was moved. Your courses, mocks and cards are all where you left them.</p>
      <div className="mt-auto flex flex-col gap-2 sm:mt-4 sm:flex-row">
        <Link href="/home" className={buttonClass("primary", "lg", "w-full sm:w-auto")}>
          Back to home
        </Link>
        <Link href="/courses" className={buttonClass("secondary", "lg", "w-full sm:w-auto")}>
          My courses
        </Link>
      </div>
    </main>
  );
}
