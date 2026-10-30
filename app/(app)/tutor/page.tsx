import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ChevronRight } from "lucide-react";
import { displayCourseCode } from "@/lib/format";
import { requireViewer } from "@/lib/viewer";

export const metadata: Metadata = { title: "Tutor" };

/** The tutor is scoped to one course: pick it (straight in when there's only one). */
export default async function TutorIndexPage() {
  const viewer = await requireViewer();
  if (viewer.courses.length === 1) redirect(`/tutor/${viewer.courses[0].id}`);
  return (
    <main className="mx-auto flex max-w-[720px] flex-col gap-5 px-5 pt-4 pb-6 lg:px-0 lg:py-10">
      <header className="flex flex-col gap-1">
        <h1 className="font-display text-[22px] font-bold lg:text-[32px]">Tutor</h1>
        <p className="text-sm text-ink-muted">Ask anything from your notes. Pick a course.</p>
      </header>
      <ul className="flex flex-col divide-y divide-border rounded-2xl border border-border bg-surface">
        {viewer.courses.map((c) => (
          <li key={c.id}>
            <Link href={`/tutor/${c.id}`} className="flex min-h-16 items-center gap-3 px-4">
              <span className="flex flex-1 flex-col">
                <span className="font-display text-lg font-bold">{displayCourseCode(c.code)}</span>
                <span className="text-[13px] text-ink-muted">{c.title}</span>
              </span>
              <ChevronRight size={20} className="text-ink-muted" aria-hidden />
            </Link>
          </li>
        ))}
      </ul>
    </main>
  );
}
