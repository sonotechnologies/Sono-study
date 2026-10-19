import type { Metadata } from "next";
import Link from "next/link";
import { cookies } from "next/headers";
import { Avatar, ButtonLink, Pill } from "@/components/ui/primitives";
import {
  DeleteAccountRow,
  HandleEditor,
  PushRow,
  ReminderTime,
  SignOutRow,
  ThemeRow,
  ToggleRow,
} from "@/components/account/settings-controls";
import { getDb } from "@/db";
import { isAdmin } from "@/lib/admin";
import { authEnabled } from "@/lib/auth";
import { cn } from "@/lib/cn";
import { displayCourseCode, formatDate, formatNaira } from "@/lib/format";
import { anonymousName } from "@/lib/identity";
import { PASSES, planSummary } from "@/lib/plans";
import { vapidPublicKey } from "@/lib/push";
import { openReportCount } from "@/lib/reports";
import { requireViewer } from "@/lib/viewer";

export const metadata: Metadata = { title: "Profile" };

/** Phone: plain grouped list. Desktop: each group is a card. */
const GROUP = "flex flex-col lg:rounded-2xl lg:border lg:border-border lg:bg-surface lg:px-5 lg:py-2";
const ROW = "flex min-h-[52px] items-center justify-between gap-4 text-[15px]";
const VALUE = "min-w-0 truncate text-right text-ink-muted";

function Group({ label, className, children }: { label: string; className?: string; children: React.ReactNode }) {
  return (
    <section aria-label={label} className={cn(GROUP, className)}>
      <h2 className="pb-1.5 text-[13px] text-ink-muted lg:pb-1 lg:pt-3">{label}</h2>
      <div className="flex flex-col [&>*:not(:last-child)]:border-b [&>*:not(:last-child)]:border-border">{children}</div>
    </section>
  );
}

export default async function ProfilePage() {
  const viewer = await requireViewer();
  const theme = (await cookies()).get("theme")?.value === "light" ? "light" : "dark";
  const name = viewer.name ?? (viewer.handle ? `@${viewer.handle}` : "Student");
  const isPro = viewer.effectivePlan === "pro";
  const codes = viewer.courses.map((c) => displayCourseCode(c.code));
  const examsSet = viewer.courses.filter((c) => c.examDate).length;
  const school = viewer.school;
  const studyLine = [school?.shortName, viewer.department, viewer.level ? `${viewer.level}L` : null].filter(Boolean).join(" · ");
  const xp = viewer.xp.toLocaleString("en-NG");

  return (
    <main className="flex flex-col gap-6 px-5 pt-4 pb-6 lg:gap-7 lg:px-12 lg:py-10">
      <header className="flex items-center gap-3.5 lg:gap-5">
        <Avatar name={name} highlight className="size-14 font-display text-xl lg:size-[72px] lg:text-[26px]" />
        <div className="flex min-w-0 flex-1 flex-col gap-0.5 lg:gap-1">
          <h1 className="truncate font-display text-[22px] font-bold lg:text-[32px]">{name}</h1>
          <p className="text-sm text-ink-muted lg:hidden">
            {viewer.handle ? `@${viewer.handle} · ` : ""}
            {xp} XP · {viewer.streakDays}-day streak
          </p>
          <p className="hidden text-[15px] text-ink-muted lg:block">
            {[viewer.handle ? `@${viewer.handle}` : null, studyLine].filter(Boolean).join(" · ")}
          </p>
        </div>
        <div className="hidden gap-2.5 lg:flex">
          <Pill className="font-bold text-spark">{viewer.streakDays}-day streak</Pill>
          <Pill>{xp} XP</Pill>
        </div>
      </header>

      <div className="flex flex-col gap-6 lg:grid lg:grid-cols-2 lg:items-start">
        <div className="contents lg:flex lg:flex-col lg:gap-6">
          <Group label="Study" className="order-1 lg:order-none">
            <Link href="/onboarding?edit=1&step=1" className={ROW}>
              <span>School</span>
              <span className={VALUE}>
                <span className="lg:hidden">{studyLine || "Not set"}</span>
                <span className="hidden lg:inline">{school?.name ?? "Not set"} · Edit</span>
              </span>
            </Link>
            <Link href="/onboarding?edit=1&step=3" className={ROW}>
              <span>Courses</span>
              <span className={VALUE}>
                <span className="lg:hidden">
                  {codes.length > 2 ? `${codes.slice(0, 2).join(", ")} +${codes.length - 2}` : codes.join(", ") || "Add courses"}
                </span>
                <span className="hidden lg:inline">{codes.join(", ") || "Add courses"}</span>
              </span>
            </Link>
            <Link href="/onboarding?edit=1&step=4" className={ROW}>
              <span>Exam dates</span>
              <span className={VALUE}>
                {examsSet} of {codes.length} set
              </span>
            </Link>
          </Group>

          <Group label="Leaderboards" className="order-2 lg:order-none">
            <div className={ROW}>
              <span>Handle</span>
              <HandleEditor handle={viewer.handle} />
            </div>
            <ToggleRow
              setting="anonymous"
              initial={viewer.anonymous}
              label="Appear as anonymous"
              hint={`Shown as "${anonymousName(viewer.id)}" to others`}
            />
          </Group>
        </div>

        <div className="contents lg:flex lg:flex-col lg:gap-6">
          <section
            aria-label="Plan"
            className="order-4 flex items-center gap-3 rounded-2xl border border-border bg-surface p-4 lg:order-none lg:gap-4 lg:p-5"
          >
            <div className="flex min-w-0 flex-1 flex-col gap-0.5 lg:gap-1">
              <span className="text-[13px] text-ink-muted">Plan</span>
              <span className="font-display text-lg font-bold lg:text-[22px]">{isPro ? "Pro" : "Free"}</span>
              <span className="text-[13px] text-ink-muted lg:text-sm">
                {isPro ? `Active until ${formatDate(viewer.proUntil!)}` : planSummary("free")}
              </span>
            </div>
            <ButtonLink href="/profile?paywall=1" scroll={false} size="sm" className="lg:h-12 lg:px-5 lg:text-[15px]">
              {isPro ? (
                "Add time"
              ) : (
                <>
                  Upgrade<span className="-ml-1 hidden lg:inline">from {formatNaira(PASSES.week.amountKobo)}</span>
                </>
              )}
            </ButtonLink>
          </section>

          <Group label="Notifications" className="order-3 lg:order-none">
            {vapidPublicKey() && <PushRow publicKey={vapidPublicKey()!} />}
            <ToggleRow setting="notifyDailyReminder" initial={viewer.notifyDailyReminder} label="Daily study reminder">
              <ReminderTime initial={viewer.reminderTime} />
            </ToggleRow>
            <ToggleRow setting="notifyStreak" initial={viewer.notifyStreak} label="Streak about to break" />
            <ToggleRow setting="notifyChallenge" initial={viewer.notifyChallenge} label="Challenge starts" />
          </Group>

          <Group label="Your data" className="order-5 lg:order-none">
            <a href="/api/me/export" download className={ROW}>
              <span>Export my data</span>
              <span className={VALUE}>JSON file</span>
            </a>
            <ThemeRow theme={theme} />
            {authEnabled && <SignOutRow />}
            <DeleteAccountRow />
          </Group>

          {isAdmin(viewer) && (
            <Group label="Admin" className="order-6 lg:order-none">
              <Link href="/admin/reports" className={ROW}>
                <span>Reported questions</span>
                <span className={VALUE}>{await openReportCount(await getDb())} open</span>
              </Link>
            </Group>
          )}
        </div>
      </div>
    </main>
  );
}
