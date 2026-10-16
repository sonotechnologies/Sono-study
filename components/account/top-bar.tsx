import Link from "next/link";
import { ChevronLeft } from "lucide-react";

/** 56px screen top bar with a 48px back button. `heading` renders a bold page title instead of the muted label. */
export function TopBar({ back, title, heading }: { back: string; title?: string; heading?: string }) {
  return (
    <div className="flex h-14 items-center gap-1 pl-1 pr-4 lg:-ml-3 lg:pl-0">
      <Link href={back} aria-label="Back" className="grid size-12 place-items-center rounded-full text-ink hover:bg-surface-2">
        <ChevronLeft size={22} strokeWidth={2} aria-hidden />
      </Link>
      {heading ? <h1 className="flex-1 font-display text-lg font-bold">{heading}</h1> : <span className="flex-1 text-sm text-ink-muted">{title}</span>}
    </div>
  );
}
