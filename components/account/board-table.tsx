import { Avatar } from "@/components/ui/primitives";
import { cn } from "@/lib/cn";
import { formatClock } from "@/lib/format";
import type { BoardRow } from "@/lib/leaderboard";

/** Mobile: # · student · best · time. Desktop adds a Mocks column and wider cells. */
const GRID = "grid grid-cols-[32px_1fr_auto_44px] gap-3 lg:grid-cols-[56px_1fr_120px_100px_80px]";

function scoreText(r: BoardRow) {
  return `${r.score}/${r.maxScore}`;
}

function Row({ row, viewerName, pinned }: { row: BoardRow; viewerName: string; pinned?: boolean }) {
  const me = row.isViewer;
  return (
    <li
      aria-current={me ? "true" : undefined}
      className={cn(
        GRID,
        "items-center",
        me
          ? "min-h-14 rounded-[12px] border border-accent bg-accent-soft px-2 lg:px-3"
          : "min-h-12 border-b border-border lg:min-h-[52px]",
        me && !pinned && "my-1.5 -mx-2 lg:-mx-3",
      )}
    >
      <span className={cn("font-display text-[15px] font-bold lg:text-base", me ? "text-accent" : row.rank === 1 ? "text-spark" : "text-ink")}>
        {row.rank}
      </span>
      <span className={cn("flex min-w-0 items-center gap-2.5 text-[15px] lg:gap-3", me && "font-semibold")}>
        <Avatar name={me ? viewerName : row.name} highlight={me} className="size-7 text-[11px] lg:size-8 lg:text-xs" />
        <span className="truncate">
          {me ? (
            <>
              You<span className="hidden lg:inline"> · {row.name}</span>
            </>
          ) : (
            row.name
          )}
        </span>
      </span>
      <span className="font-display text-[15px] font-bold lg:text-base">{scoreText(row)}</span>
      <span className="text-right text-[13px] text-ink-muted lg:text-left lg:text-sm">{formatClock(row.timeSec)}</span>
      <span className="hidden text-right text-sm text-ink-muted lg:block">{row.mocks}</span>
    </li>
  );
}

export function BoardTable({
  rows,
  viewer,
  viewerName,
  mocksLabel = "Mocks",
  emptyText,
}: {
  rows: BoardRow[];
  viewer: BoardRow | null;
  viewerName: string;
  mocksLabel?: string;
  emptyText: string;
}) {
  const viewerInRows = rows.some((r) => r.isViewer);
  return (
    <div className="flex flex-col lg:rounded-2xl lg:border lg:border-border lg:bg-surface lg:px-5 lg:py-2">
      <div className={cn(GRID, "pb-1.5 text-xs text-ink-muted lg:border-b lg:border-border lg:py-2.5 lg:text-[13px]")}>
        <span>
          <span className="lg:hidden">#</span>
          <span className="hidden lg:inline">Rank</span>
        </span>
        <span>Student</span>
        <span>
          <span className="lg:hidden">Best</span>
          <span className="hidden lg:inline">Best score</span>
        </span>
        <span className="text-right lg:text-left">Time</span>
        <span className="hidden text-right lg:block">{mocksLabel}</span>
      </div>
      {rows.length === 0 ? (
        <p className="py-10 text-center text-[15px] text-ink-muted">{emptyText}</p>
      ) : (
        <ol>
          {rows.map((r) => (
            <Row key={r.userId} row={r} viewerName={viewerName} />
          ))}
        </ol>
      )}
      {viewer && !viewerInRows && (
        <ol className="sticky bottom-[calc(76px+env(safe-area-inset-bottom))] z-10 mt-2.5 mb-2 lg:static lg:-mx-3">
          <Row row={viewer} viewerName={viewerName} pinned />
        </ol>
      )}
    </div>
  );
}
