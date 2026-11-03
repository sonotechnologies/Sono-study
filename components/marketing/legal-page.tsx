import Link from "next/link";
import { Logo } from "@/components/logo";

/** Shared frame for the Privacy Policy and Terms: readable measure, plain headings, links back. */
export function LegalPage({ title, updated, children }: { title: string; updated: string; children: React.ReactNode }) {
  return (
    <div className="min-h-dvh bg-bg">
      <header className="flex h-16 items-center border-b border-border px-4 sm:px-8 lg:px-20">
        <Link href="/" aria-label="Sono Study home">
          <Logo />
        </Link>
      </header>
      <main className="mx-auto flex max-w-[720px] flex-col gap-6 px-5 py-10 lg:py-14">
        <div className="flex flex-col gap-2">
          <h1 className="font-display text-[32px] font-bold leading-tight lg:text-[40px]">{title}</h1>
          <p className="text-sm text-ink-muted">Last updated {updated}</p>
        </div>
        <div className="flex flex-col gap-6 text-[15px] leading-relaxed [&_a]:font-semibold [&_a]:text-accent [&_h2]:pt-2 [&_h2]:font-display [&_h2]:text-xl [&_h2]:font-bold [&_li]:pl-1 [&_ul]:flex [&_ul]:list-disc [&_ul]:flex-col [&_ul]:gap-1.5 [&_ul]:pl-5">
          {children}
        </div>
      </main>
      <footer className="flex flex-wrap justify-between gap-2 border-t border-border px-4 py-8 text-[14px] text-ink-muted sm:px-8 lg:px-20">
        <span>Sono Study · part of Sono Education</span>
        <span className="flex gap-4">
          <Link href="/privacy" className="hover:text-ink">Privacy</Link>
          <Link href="/terms" className="hover:text-ink">Terms</Link>
        </span>
      </footer>
    </div>
  );
}

export const supportEmail = () => process.env.SUPPORT_EMAIL || "support@sono.study";
