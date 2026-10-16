import type { Metadata } from "next";
import { getDb } from "@/db";
import { DailyLimitState } from "@/components/account/state-cards";
import { ComingSoon } from "@/components/coming-soon";
import { inviteUrl } from "@/lib/invite";
import { getReferralProgress, getUsage } from "@/lib/usage";
import { requireViewer } from "@/lib/viewer";

export const metadata: Metadata = { title: "Upload" };

export default async function UploadPage() {
  const viewer = await requireViewer();
  const db = await getDb();
  const usage = await getUsage(db, viewer.id, "upload", viewer.effectivePlan);

  if (usage.remaining === 0) {
    const code = viewer.referralCode ?? viewer.handle ?? viewer.id;
    return (
      <main className="flex min-h-[calc(100dvh-64px)] flex-col lg:min-h-dvh">
        <DailyLimitState
          variant="screen"
          action="upload"
          limit={usage.limit}
          resetsAt={usage.resetsAt}
          referralsDone={await getReferralProgress(db, viewer.id)}
          inviteLink={inviteUrl(code)}
          inviteDisplay={inviteUrl(code, { display: true })}
        />
      </main>
    );
  }
  return (
    <ComingSoon
      title="Upload notes"
      body={`You have ${usage.remaining} of ${usage.limit} uploads left today. Turning notes into questions arrives with the upload pipeline milestone.`}
    />
  );
}
