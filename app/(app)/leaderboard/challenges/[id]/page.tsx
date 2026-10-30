import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getDb } from "@/db";
import { RewardLine } from "@/components/account/challenge-cards";
import { ShareRankButton } from "@/components/account/share-rank-button";
import { TopBar } from "@/components/account/top-bar";
import { buttonClass, Card } from "@/components/ui/primitives";
import { cn } from "@/lib/cn";
import { getChallenge, getClosedChallengeResult } from "@/lib/challenges";
import { formatClock } from "@/lib/format";
import type { BoardRow } from "@/lib/leaderboard";
import { requireViewer } from "@/lib/viewer";

export const metadata: Metadata = { title: "Challenge results" };

/** 3b — closed challenge results. Results only reveal once the challenge has closed. */
export default async function ChallengeResultPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const viewer = await requireViewer();
  const db = await getDb();
  const challenge = await getChallenge(db, id);
  if (!challenge || !viewer.courses.some((c) => c.id === challenge.courseId)) notFound();
  const back = `/leaderboard?course=${challenge.courseId}`;

  if (challenge.endsAt > new Date()) {
    return (
      <main className="mx-auto flex max-w-[720px] flex-col gap-4 pb-6 lg:pt-6">
        <TopBar back={back} title={`${challenge.title} · open`} />
        <p className="px-5 text-[15px] text-ink-muted lg:px-0">Results reveal when the challenge closes.</p>
      </main>
    );
  }

  const result = await getClosedChallengeResult(db, challenge, viewer.id, 10);
  const me = result.viewer;
  const standings = me && !result.standings.some((r) => r.isViewer) ? [...result.standings, me] : result.standings;
  const stats = [
    ["Score", me ? `${me.score}/${me.maxScore}` : "—"],
    ["Time", me ? formatClock(me.timeSec) : "—"],
    ["Class avg", `${result.classAverage}/${challenge.questionCount}`],
  ];

  return (
    <main className="mx-auto flex min-h-[calc(100dvh-64px)] max-w-[720px] flex-col lg:min-h-dvh lg:pt-6">
      <TopBar back={back} title={`${challenge.title} · closed`} />
      <div className="flex flex-col gap-4 px-5 pb-4 lg:px-0">
        {me ? (
          <div className="flex flex-col gap-1.5">
            <span className="text-sm text-ink-muted">You placed</span>
            <div className="flex items-baseline gap-2">
              <span className="font-display text-[56px] font-bold leading-none">#{me.rank}</span>
              <span className="text-base text-ink-muted">of {result.total}</span>
            </div>
            <RewardLine reward={me.reward} topPercent={me.topPercent} className="text-[15px]" />
          </div>
        ) : (
          <div className="flex flex-col gap-1.5">
            <span className="font-display text-[28px] font-bold leading-tight">{result.total} classmates took it.</span>
            <span className="text-[15px] text-ink-muted">You missed this one. The next challenge is on the leaderboard.</span>
          </div>
        )}
        <div className="grid grid-cols-3 gap-2">
          {stats.map(([label, value]) => (
            <Card key={label} className="flex flex-col gap-0.5 rounded-[12px] px-3 py-2.5">
              <span className="text-xs text-ink-muted">{label}</span>
              <span className="font-display text-base font-bold">{value}</span>
            </Card>
          ))}
        </div>
      </div>

      <section className="flex-1 px-5 lg:px-0">
        <h2 className="pb-1.5 text-[13px] text-ink-muted">Final standings</h2>
        <ol>
          {standings.map((r) => (
            <StandingRow key={r.userId} row={r} gap={r.isViewer && standings.length > result.standings.length} />
          ))}
        </ol>
      </section>

      {me && (
        <div className="sticky bottom-[calc(64px+env(safe-area-inset-bottom))] bg-bg px-5 pb-5 pt-3 lg:bottom-0 lg:px-0">
          <ShareRankButton
            challengeId={challenge.id}
            text={`I placed #${me.rank} of ${result.total} in the ${challenge.title} on Sono Study. Beat me next Friday?`}
            className={buttonClass("primary", "lg", "w-full")}
          >
            Share my rank
          </ShareRankButton>
        </div>
      )}
    </main>
  );
}

function StandingRow({ row, gap }: { row: BoardRow; gap: boolean }) {
  const me = row.isViewer;
  return (
    <li
      aria-current={me ? "true" : undefined}
      className={cn(
        "grid min-h-[46px] grid-cols-[32px_1fr_auto_44px] items-center gap-3 border-b border-border",
        me && "rounded-[10px] border-b-0 bg-accent-soft px-2",
        gap && "mt-3",
      )}
    >
      <span className={cn("font-display text-[15px] font-bold", me ? "text-accent" : row.rank === 1 ? "text-spark" : "text-ink")}>
        {row.rank}
      </span>
      <span className={cn("truncate text-[15px]", me && "font-semibold")}>{me ? `You · ${row.name}` : row.name}</span>
      <span className="font-display text-[15px] font-bold">
        {row.score}/{row.maxScore}
      </span>
      <span className="text-right text-[13px] text-ink-muted">{formatClock(row.timeSec)}</span>
    </li>
  );
}
