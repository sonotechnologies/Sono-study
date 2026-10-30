import type { Metadata } from "next";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { getDb } from "@/db";
import { DailyLimitState } from "@/components/account/state-cards";
import { TopBar } from "@/components/account/top-bar";
import { ButtonLink } from "@/components/ui/primitives";
import { UploadPicker } from "@/components/upload/picker";
import { displayCourseCode } from "@/lib/format";
import { inviteUrl } from "@/lib/invite";
import { MAX_PHOTOS, MAX_UPLOAD_BYTES, PLANS } from "@/lib/plans";
import { recentUploads } from "@/lib/uploads";
import { getReferralProgress, getUsage } from "@/lib/usage";
import { requireViewer } from "@/lib/viewer";

export const metadata: Metadata = { title: "Upload" };

const STATUS: Record<string, string> = { queued: "Waiting", extracting: "Reading", generating: "Making questions", ready: "Ready", failed: "Didn't work" };

export default async function UploadPage({ searchParams }: { searchParams: Promise<{ course?: string }> }) {
  const viewer = await requireViewer();
  const db = await getDb();
  const plan = viewer.effectivePlan;
  const [uploadsLeft, aiLeft, recent] = await Promise.all([
    getUsage(db, viewer.id, "upload", plan),
    getUsage(db, viewer.id, "ai_questions", plan),
    recentUploads(db, viewer.id),
  ]);

  const blocked = uploadsLeft.remaining === 0 ? uploadsLeft : aiLeft.remaining === 0 ? aiLeft : null;
  if (blocked) {
    const code = viewer.referralCode ?? viewer.handle ?? viewer.id;
    return (
      <main className="flex min-h-[calc(100dvh-64px)] flex-col lg:min-h-dvh">
        <DailyLimitState
          variant="screen"
          action={blocked.action}
          limit={blocked.limit}
          resetsAt={blocked.resetsAt}
          referralsDone={await getReferralProgress(db, viewer.id)}
          inviteLink={inviteUrl(code)}
          inviteDisplay={inviteUrl(code, { display: true })}
        />
      </main>
    );
  }

  const { course } = await searchParams;
  const courses = viewer.courses.map((c) => ({ id: c.id, label: `${displayCourseCode(c.code)} · ${c.title}` }));

  return (
    <main className="mx-auto flex min-h-[calc(100dvh-64px)] max-w-[720px] flex-col lg:min-h-0 lg:pt-6">
      <TopBar back="/home" heading="Upload notes" />
      {courses.length === 0 ? (
        <div className="flex flex-col gap-4 px-5 pt-4 lg:px-0">
          <p className="text-[15px] leading-relaxed text-ink-muted">Add a course first, so we know where your questions belong.</p>
          <ButtonLink href="/courses" className="self-start">
            Add a course
          </ButtonLink>
        </div>
      ) : (
        <UploadPicker
          courses={courses}
          defaultCourseId={courses.some((c) => c.id === course) ? course! : courses[0].id}
          schoolName={viewer.school?.shortName ?? null}
          maxBytes={MAX_UPLOAD_BYTES}
          maxPhotos={Math.min(MAX_PHOTOS, PLANS[plan].pagesPerUpload)}
          pagesPerUpload={PLANS[plan].pagesPerUpload}
        />
      )}
      <p className="px-5 pb-2 text-[13px] text-ink-muted lg:px-0">
        {uploadsLeft.remaining} of {uploadsLeft.limit} uploads and {aiLeft.remaining} of {aiLeft.limit} AI questions left today. Your files stay private.
      </p>
      {recent.length > 0 && (
        <section className="flex flex-col px-5 pb-6 pt-4 lg:px-0">
          <h2 className="pb-1.5 text-[13px] text-ink-muted">Your uploads</h2>
          <ul className="flex flex-col divide-y divide-border rounded-2xl border border-border bg-surface">
            {recent.map((u) => (
              <li key={u.id}>
                <Link href={`/upload/${u.id}`} className="flex min-h-14 items-center gap-3 px-4 py-2.5">
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate text-[15px]">{u.title}</span>
                    <span className="text-[13px] text-ink-muted">
                      {displayCourseCode(u.courseCode)} · {u.status === "ready" ? `${u.questionsMade} questions` : STATUS[u.status]}
                    </span>
                  </span>
                  <ChevronRight size={18} className="text-ink-muted" aria-hidden />
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </main>
  );
}
