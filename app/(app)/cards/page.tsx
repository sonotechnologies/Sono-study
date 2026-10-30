import type { Metadata } from "next";
import Link from "next/link";
import { ChevronRight, Plus } from "lucide-react";
import { getDb } from "@/db";
import { courseFlashcardCount } from "@/lib/course-data";
import { dueCounts } from "@/lib/flashcards";
import { displayCourseCode } from "@/lib/format";
import { requireViewer } from "@/lib/viewer";

export const metadata: Metadata = { title: "Flashcards" };

/** Flashcard decks, one per course, with what's due now (reviews + today's new cards). */
export default async function CardsPage() {
  const viewer = await requireViewer();
  const db = await getDb();
  const decks = await Promise.all(
    viewer.courses.map(async (c) => ({ ...c, due: await dueCounts(db, viewer.id, c.id), total: await courseFlashcardCount(db, viewer.id, c.id) })),
  );
  const due = decks.reduce((s, d) => s + d.due.total, 0);
  return (
    <main className="mx-auto flex max-w-[720px] flex-col gap-5 px-5 pt-4 pb-6 lg:px-0 lg:py-10">
      <header className="flex flex-col gap-1">
        <h1 className="font-display text-[22px] font-bold lg:text-[32px]">Flashcards</h1>
        <p className="text-sm text-ink-muted">{due ? `${due} due now. A few minutes a day beats a long night before the exam.` : "Nothing due right now. Nice."}</p>
      </header>
      <ul className="flex flex-col divide-y divide-border rounded-2xl border border-border bg-surface">
        {decks.map((d) => (
          <li key={d.id} className="flex items-center gap-3 pr-2">
            <Link href={`/cards/${d.id}`} className="flex min-h-[72px] flex-1 items-center gap-4 px-4 py-3">
              <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className="font-display text-lg font-bold">{displayCourseCode(d.code)}</span>
                <span className="text-[13px] text-ink-muted">
                  {d.total} card{d.total === 1 ? "" : "s"}
                  {d.due.fresh ? ` · ${d.due.fresh} new today` : ""}
                </span>
              </span>
              <span className={d.due.total ? "font-display text-[22px] font-bold text-accent" : "text-[13px] text-ink-muted"}>{d.due.total ? d.due.total : "done"}</span>
              <ChevronRight size={20} className="text-ink-muted" aria-hidden />
            </Link>
            <Link href={`/cards/${d.id}/new`} aria-label={`Add a ${displayCourseCode(d.code)} card`} className="grid size-11 place-items-center rounded-full text-ink-muted hover:bg-surface-2">
              <Plus size={20} aria-hidden />
            </Link>
          </li>
        ))}
      </ul>
    </main>
  );
}
