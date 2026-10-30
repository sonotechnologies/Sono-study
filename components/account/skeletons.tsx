import { cn } from "@/lib/cn";

/**
 * Static skeletons (no shimmer — saves battery on cheap phones). Boxes match
 * the final layout so nothing jumps when data arrives.
 */
function Bar({ className }: { className?: string }) {
  return <span aria-hidden className={cn("block rounded-md bg-surface-2", className)} />;
}

export function LeaderboardSkeleton() {
  return (
    <div role="status" aria-label="Loading leaderboard" className="flex flex-col gap-3.5 px-5 pt-3 lg:grid lg:grid-cols-[1fr_380px] lg:gap-8 lg:px-12 lg:py-10">
      <div className="flex flex-col gap-3.5 lg:gap-5">
        <div className="flex items-end justify-between">
          <div className="flex flex-col gap-2">
            <Bar className="hidden h-4 w-40 lg:block" />
            <Bar className="h-7 w-48 rounded-lg lg:h-9 lg:w-72" />
          </div>
          <Bar className="hidden h-11 w-80 rounded-[12px] lg:block" />
        </div>
        <Bar className="h-12 rounded-[12px] lg:hidden" />
        <span className="block h-[156px] rounded-2xl bg-surface lg:hidden" />
        <div className="flex flex-col lg:rounded-2xl lg:border lg:border-border lg:bg-surface lg:px-5 lg:py-2">
          {Array.from({ length: 9 }, (_, i) => (
            <div key={i} className="flex min-h-12 items-center gap-3 border-b border-border lg:min-h-[52px]">
              <Bar className="h-4 w-5" />
              <span className="size-7 rounded-full bg-surface-2 lg:size-8" />
              <Bar className="h-3.5 w-32" />
            </div>
          ))}
        </div>
      </div>
      <div className="hidden flex-col gap-4 pt-[58px] lg:flex">
        <span className="block h-[236px] rounded-2xl bg-surface" />
        <span className="block h-[220px] rounded-2xl border border-border bg-surface" />
      </div>
    </div>
  );
}

export function ProfileSkeleton() {
  const group = (rows: number) => (
    <div className="flex flex-col lg:rounded-2xl lg:border lg:border-border lg:bg-surface lg:px-5 lg:py-2">
      <Bar className="mb-2 h-3 w-20 lg:mt-3" />
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="flex min-h-[52px] items-center justify-between border-b border-border last:border-0">
          <Bar className="h-3.5 w-28" />
          <Bar className="h-3.5 w-20" />
        </div>
      ))}
    </div>
  );
  return (
    <div role="status" aria-label="Loading profile" className="flex flex-col gap-6 px-5 pt-4 lg:gap-7 lg:px-12 lg:py-10">
      <div className="flex items-center gap-3.5 lg:gap-5">
        <span className="size-14 rounded-full bg-surface-2 lg:size-[72px]" />
        <div className="flex flex-col gap-2">
          <Bar className="h-6 w-40 lg:h-8 lg:w-56" />
          <Bar className="h-3.5 w-52" />
        </div>
      </div>
      <div className="flex flex-col gap-6 lg:grid lg:grid-cols-2">
        <div className="flex flex-col gap-6">
          {group(3)}
          {group(2)}
        </div>
        <div className="flex flex-col gap-6">
          <span className="block h-[104px] rounded-2xl border border-border bg-surface" />
          {group(3)}
        </div>
      </div>
    </div>
  );
}

/** 6e — Home skeleton for the full Home dashboard (desktop + phone). */
export function HomeSkeleton() {
  return (
    <div role="status" aria-label="Loading home">
      <div className="flex flex-col gap-4 px-5 pt-3 lg:hidden">
        <div className="flex justify-between">
          <Bar className="h-[22px] w-[110px] rounded-lg" />
          <Bar className="h-[30px] w-24 rounded-full" />
        </div>
        <div className="flex h-80 flex-col items-center justify-center gap-4 rounded-2xl border border-border bg-surface">
          <Bar className="h-3 w-[120px]" />
          <span className="size-32 rounded-full border-[12px] border-surface-2" />
          <Bar className="h-[52px] w-[85%] rounded-[12px]" />
        </div>
        <div className="flex gap-2">
          <span className="h-12 flex-1 rounded-[12px] bg-surface" />
          <span className="h-12 flex-1 rounded-[12px] bg-surface" />
        </div>
        <Bar className="h-3.5 w-3/5" />
        <Bar className="h-3.5 w-4/5" />
      </div>
      <div className="hidden flex-col gap-5 p-8 lg:flex">
        <Bar className="h-4 w-[180px]" />
        <Bar className="h-8 w-80 rounded-lg" />
        <div className="grid grid-cols-[1.3fr_1fr] gap-4">
          <div className="flex h-[220px] items-center gap-6 rounded-2xl border border-border bg-surface p-6">
            <span className="size-[140px] flex-none rounded-full border-[14px] border-surface-2" />
            <div className="flex flex-1 flex-col gap-2.5">
              <Bar className="h-3.5 w-3/5" />
              <Bar className="h-6 w-4/5 rounded-lg" />
              <Bar className="mt-3 h-11 w-[70%] rounded-[12px]" />
            </div>
          </div>
          <div className="flex h-[220px] flex-col gap-3.5 rounded-2xl border border-border bg-surface p-6">
            <Bar className="h-[18px] w-1/2" />
            <Bar className="h-3" />
            <Bar className="h-3 w-[90%]" />
            <Bar className="h-3 w-3/4" />
          </div>
        </div>
        <div className="grid grid-cols-4 gap-4">
          {Array.from({ length: 4 }, (_, i) => (
            <span key={i} className="h-[104px] rounded-2xl border border-border bg-surface" />
          ))}
        </div>
      </div>
    </div>
  );
}
