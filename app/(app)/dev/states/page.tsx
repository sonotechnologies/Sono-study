import { notFound } from "next/navigation";
import { DailyLimitState, PaymentSuccessState, QueueBusyState } from "@/components/account/state-cards";
import { HomeSkeleton } from "@/components/account/skeletons";
import { inviteUrl } from "@/lib/invite";
import { PASSES } from "@/lib/plans";
import { addDays, nextDailyReset } from "@/lib/time";

export const metadata = { title: "States preview" };

/** Dev-only gallery of the 6d inline states and 6e skeleton, with sample values. */
export default function StatesPreview() {
  if (process.env.NODE_ENV === "production") notFound();
  const now = new Date();
  return (
    <main className="flex flex-col gap-10 px-5 py-6 lg:px-12 lg:py-10">
      <h1 className="font-display text-[28px] font-bold">Queue, limit and payment states</h1>
      <div className="grid gap-6 lg:grid-cols-3">
        <QueueBusyState variant="card" etaMinutes={4} place={18} progress={0.35} savedWhat="18 pages" cardsDue={12} />
        <DailyLimitState
          variant="card"
          action="upload"
          limit={2}
          resetsAt={nextDailyReset(now)}
          referralsDone={1}
          inviteLink={inviteUrl("tolu")}
          inviteDisplay={inviteUrl("tolu", { display: true })}
        />
        <PaymentSuccessState
          variant="card"
          passName={PASSES.semester.name}
          proUntil={addDays(now, PASSES.semester.days)}
          amountKobo={PASSES.semester.amountKobo}
          reference="SONO-7Q2M81XA-K3"
        />
      </div>
      <h2 className="font-display text-[22px] font-bold">Phone: queue busy</h2>
      <div className="flex max-w-[390px] flex-col rounded-[28px] border border-border px-5">
        <QueueBusyState variant="screen" etaMinutes={4} place={18} progress={0.35} savedWhat="6 photos" courseCode="GST 111" cardsDue={12} />
      </div>
      <h2 className="font-display text-[22px] font-bold">Home skeleton</h2>
      <div className="overflow-hidden rounded-2xl border border-border">
        <HomeSkeleton />
      </div>
    </main>
  );
}
