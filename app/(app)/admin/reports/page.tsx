import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getDb } from "@/db";
import { buttonClass } from "@/components/ui/primitives";
import { isAdmin } from "@/lib/admin";
import { cn } from "@/lib/cn";
import { displayCourseCode, timeAgo } from "@/lib/format";
import { AUTO_HIDE_REPORTS, openReports, REPORT_REASONS } from "@/lib/reports";
import { requireViewer } from "@/lib/viewer";
import { resolveReportAction } from "./actions";

export const metadata: Metadata = { title: "Reported questions" };

const now = () => new Date();

/** Admin: reported questions (brief: "an admin page lists reported items"). Auto-hidden ones first. */
export default async function ReportsAdminPage() {
  const viewer = await requireViewer();
  if (!isAdmin(viewer)) notFound();
  const items = await openReports(await getDb());
  const at = now();
  return (
    <main className="mx-auto flex max-w-[860px] flex-col gap-5 px-5 pt-4 pb-8 lg:px-12 lg:py-10">
      <header className="flex flex-col gap-1">
        <h1 className="font-display text-[22px] font-bold lg:text-[32px]">Reported questions</h1>
        <p className="text-sm text-ink-muted">
          {items.length === 0
            ? "Nothing to review."
            : `${items.length} question${items.length === 1 ? "" : "s"} reported. ${AUTO_HIDE_REPORTS} reports hide a question until you decide.`}
        </p>
      </header>
      <ul className="flex flex-col gap-3">
        {items.map((it) => {
          const hidden = it.status === "reported";
          return (
            <li key={it.questionId} className="flex flex-col gap-3 rounded-2xl border border-border bg-surface p-4">
              <div className="flex flex-wrap items-center gap-2 text-[13px] text-ink-muted">
                <span className={cn("rounded-full px-2.5 py-1 font-semibold", hidden ? "bg-wrong-soft text-wrong" : "bg-surface-2 text-ink")}>
                  {hidden ? "Hidden pending review" : it.status === "hidden" ? "Removed by author" : "Live"}
                </span>
                <span>
                  {displayCourseCode(it.courseCode)}
                  {it.school ? ` · ${it.school}` : ""}
                  {it.uploaderHandle ? ` · from @${it.uploaderHandle}` : " · sample bank"}
                  {` · first report ${timeAgo(it.firstAt, at)}`}
                </span>
              </div>
              <p className="text-[15px] leading-relaxed">{it.stem}</p>
              {it.source && <span className="text-xs text-ink-muted">{it.source}</span>}
              <ul className="flex flex-wrap gap-2" aria-label="Reasons">
                {it.reasons.map((r) => (
                  <li key={r.reason} className="rounded-full border border-border px-3 py-1 text-[13px]">
                    {REPORT_REASONS[r.reason]} · {r.count}
                  </li>
                ))}
              </ul>
              {it.notes.length > 0 && (
                <ul className="flex flex-col gap-1 border-l-2 border-border pl-3 text-sm text-ink-muted">
                  {it.notes.map((n, i) => (
                    <li key={i}>&ldquo;{n}&rdquo;</li>
                  ))}
                </ul>
              )}
              <div className="flex gap-2">
                <form action={resolveReportAction.bind(null, it.questionId, "restore")}>
                  <button type="submit" className={buttonClass("secondary", "sm")}>
                    {hidden ? "Restore" : "Dismiss reports"}
                  </button>
                </form>
                <form action={resolveReportAction.bind(null, it.questionId, "remove")}>
                  <button type="submit" className={buttonClass("ghost", "sm", "text-wrong hover:text-wrong")}>
                    Remove question
                  </button>
                </form>
              </div>
            </li>
          );
        })}
      </ul>
    </main>
  );
}
