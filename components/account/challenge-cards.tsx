import Link from "next/link";
import { Check } from "lucide-react";
import { joinChallengeAction } from "@/app/(app)/leaderboard/actions";
import { startChallengeAction } from "@/app/(app)/courses/actions";
import { Countdown } from "@/components/account/countdown";
import { ShareRankButton } from "@/components/account/share-rank-button";
import { buttonClass, Card } from "@/components/ui/primitives";
import { cn } from "@/lib/cn";
import { formatClock } from "@/lib/format";
import type { ClosedChallenge, UpcomingChallenge } from "@/lib/challenges";

function challengeMeta(c: { title: string; questionCount: number; durationSec: number }) {
  return `${c.title} · ${c.questionCount} Qs · ${Math.round(c.durationSec / 60)} min`;
}

/** Accent card with a live countdown: "Friday Challenge · 30 Qs · 20 min / 1d 04h 12m to start". */
export function UpcomingChallengeCard({ data, className }: { data: UpcomingChallenge; className?: string }) {
  const { challenge, live, joined, viewerJoined } = data;
  return (
    <section
      aria-label={challenge.title}
      className={cn("flex flex-col gap-2.5 rounded-2xl bg-accent p-4 text-on-accent lg:gap-3 lg:p-6", className)}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-[13px] font-semibold lg:text-sm">{challengeMeta(challenge)}</span>
        <span className="text-xs font-semibold lg:hidden">{joined} joined</span>
      </div>
      <div className="flex items-baseline gap-2 lg:flex-col lg:gap-3">
        <Countdown
          to={(live ? challenge.endsAt : challenge.startsAt).toISOString()}
          className="font-display text-[28px] font-bold leading-none lg:text-[40px]"
        />
        <span className="text-[13px] lg:text-sm">
          {live ? "left to take it" : "to start"}
          <span className="hidden lg:inline"> · {joined} joined · same questions for everyone</span>
        </span>
      </div>
      {live ? (
        <form action={startChallengeAction.bind(null, challenge.id)}>
          <button type="submit" className={buttonClass("inverse", "sm", "w-full text-[15px] lg:mt-1 lg:h-12")}>
            Take the challenge
          </button>
        </form>
      ) : viewerJoined ? (
        <p className={buttonClass("inverse", "sm", "pointer-events-none lg:mt-1 lg:h-12 lg:text-[15px]")}>
          <Check size={18} strokeWidth={2.5} aria-hidden /> Joined · we&apos;ll remind you
        </p>
      ) : (
        <form action={joinChallengeAction}>
          <input type="hidden" name="challengeId" value={challenge.id} />
          <button type="submit" className={buttonClass("inverse", "sm", "w-full text-[15px] lg:mt-1 lg:h-12")}>
            Join · remind me
          </button>
        </form>
      )}
    </section>
  );
}

/** "Last challenge · Closed / #6 of 212 · 26/30 · 14:02 / Top 3%. +150 XP and a Top 10 badge." */
export function LastChallengeCard({ data, viewerName }: { data: ClosedChallenge; viewerName: string }) {
  const { challenge, total, viewer } = data;
  return (
    <Card className="flex flex-col gap-3 p-5">
      <div className="flex items-baseline justify-between">
        <h2 className="font-display text-lg font-bold">Last challenge</h2>
        <span className="text-[13px] text-ink-muted">Closed</span>
      </div>
      {viewer ? (
        <>
          <div className="flex items-baseline gap-2">
            <span className="font-display text-[44px] font-bold leading-none">#{viewer.rank}</span>
            <span className="text-[15px] text-ink-muted">
              of {total} · {viewer.score}/{viewer.maxScore} · {formatClock(viewer.timeSec)}
            </span>
          </div>
          <RewardLine reward={viewer.reward} topPercent={viewer.topPercent} />
        </>
      ) : (
        <p className="text-sm leading-normal text-ink-muted">
          You sat this one out. {total} classmates took it — join the next one.
        </p>
      )}
      <div className="flex gap-2">
        <Link href={`/leaderboard/challenges/${challenge.id}`} className={buttonClass("secondary", "sm", "flex-1")}>
          Standings
        </Link>
        {viewer && (
          <ShareRankButton
            challengeId={challenge.id}
            text={`I placed #${viewer.rank} of ${total} in the ${challenge.title} on Sono Study. Think you can beat ${viewerName.split(" ")[0]}?`}
            className={buttonClass("secondary", "sm", "flex-1")}
          >
            Share rank
          </ShareRankButton>
        )}
      </div>
    </Card>
  );
}

export function RewardLine({ reward, topPercent, className }: { reward: { xp: number; badge: string | null }; topPercent: number; className?: string }) {
  return (
    <p className={cn("text-sm leading-normal lg:text-sm", className)}>
      Top {topPercent}%. <span className="font-semibold text-spark">+{reward.xp} XP</span>
      {reward.badge ? ` and a ${reward.badge} badge.` : "."}
    </p>
  );
}
