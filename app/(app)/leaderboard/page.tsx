import type { Metadata } from "next";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { getDb } from "@/db";
import { BoardTable } from "@/components/account/board-table";
import { LastChallengeCard, UpcomingChallengeCard } from "@/components/account/challenge-cards";
import { CourseSwitcher } from "@/components/account/course-switcher";
import { ButtonLink, Card, Segmented } from "@/components/ui/primitives";
import { getClosedChallengeResult, getClosedChallenges, getLastClosedChallenge, getUpcomingChallenge } from "@/lib/challenges";
import { formatDate } from "@/lib/format";
import { getCourseBoard, type BoardScope } from "@/lib/leaderboard";
import { requireViewer } from "@/lib/viewer";

export const metadata: Metadata = { title: "Leaderboard" };

type View = BoardScope | "challenges";
const VIEWS: View[] = ["week", "all", "department", "challenges"];
const SCOPE_TITLE: Record<BoardScope, string> = { week: "This week", all: "All time", department: "My department" };

export default async function LeaderboardPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const viewer = await requireViewer();
  const view: View = VIEWS.includes(sp.view as View) ? (sp.view as View) : "week";

  if (viewer.courses.length === 0) {
    return (
      <main className="flex flex-col gap-4 px-5 pt-6 lg:px-12 lg:py-10">
        <h1 className="font-display text-[22px] font-bold lg:text-[32px]">Leaderboard</h1>
        <p className="text-[15px] text-ink-muted">Add a course to see how you stack up against your classmates.</p>
        <ButtonLink href="/onboarding?edit=1&step=3" className="self-start">Add a course</ButtonLink>
      </main>
    );
  }

  const course = viewer.courses.find((c) => c.id === sp.course) ?? viewer.courses[0];
  const href = (v: View) => `/leaderboard?${new URLSearchParams({ course: course.id, view: v })}`;
  const db = await getDb();
  const scope: BoardScope = view === "challenges" ? "week" : view;
  const [board, upcoming, last] = await Promise.all([
    view === "challenges" ? null : getCourseBoard(db, { courseId: course.id, scope, viewer }),
    getUpcomingChallenge(db, course.id, viewer.id),
    getLastClosedChallenge(db, course.id, viewer.id),
  ]);
  const viewerName = viewer.name ?? viewer.handle ?? "You";
  const school = viewer.school?.shortName ?? "";

  return (
    <main className="flex flex-col gap-3.5 px-5 pt-3 pb-4 lg:grid lg:grid-cols-[minmax(0,1fr)_380px] lg:content-start lg:gap-x-8 lg:gap-y-5 lg:px-12 lg:py-10">
      {/* On desktop this wrapper dissolves so the header sits above both the table and the challenge column. */}
      <div className="flex min-w-0 flex-col gap-3.5 lg:contents lg:[&>*]:col-start-1">
        {/* Header — phone */}
        <header className="flex items-baseline justify-between lg:hidden">
          <h1 className="font-display text-[22px] font-bold">
            <CourseSwitcher courses={viewer.courses} value={course.id} /> {school && `· ${school}`}
          </h1>
          <span className="text-[13px] text-ink-muted">Resets Sun</span>
        </header>
        {/* Header — desktop */}
        <header className="hidden items-end justify-between gap-6 lg:flex">
          <div className="flex flex-col gap-1.5">
            <span className="text-sm text-ink-muted">{school ? `${school} · resets Sunday` : "Resets Sunday"}</span>
            <h1 className="font-display text-[32px] font-bold">
              <CourseSwitcher courses={viewer.courses} value={course.id} /> · {view === "challenges" ? "Challenges" : SCOPE_TITLE[scope]}
            </h1>
          </div>
          <Segmented
            label="Leaderboard scope"
            value={view}
            options={(["week", "all", "department"] as const).map((v) => ({ value: v, label: SCOPE_TITLE[v], href: href(v) }))}
          />
        </header>

        <Segmented
          label="Leaderboard view"
          className="lg:hidden"
          value={view === "challenges" ? "challenges" : "week"}
          options={[
            { value: "week", label: "This week", href: href("week") },
            { value: "challenges", label: "Challenges", href: href("challenges") },
          ]}
        />

        {view === "challenges" ? (
          <ChallengesList courseId={course.id} viewerId={viewer.id} upcoming={upcoming} last={last} viewerName={viewerName} />
        ) : (
          <>
            {upcoming && <UpcomingChallengeCard data={upcoming} className="lg:hidden" />}
            <BoardTable
              rows={board!.rows}
              viewer={board!.viewer}
              viewerName={viewerName}
              emptyText={
                scope === "department" && !viewer.department
                  ? "Add your department in Profile to see this board."
                  : "No mocks yet this week. Take one and you're on the board."
              }
            />
            {!board!.viewer && board!.rows.length > 0 && (
              <p className="text-sm text-ink-muted">Finish a 20+ question mock this week to get on the board.</p>
            )}
          </>
        )}
      </div>

      <aside aria-label="Challenges" className="hidden flex-col gap-4 lg:col-start-2 lg:row-span-3 lg:row-start-2 lg:flex">
        {upcoming && <UpcomingChallengeCard data={upcoming} />}
        {last && <LastChallengeCard data={last} viewerName={viewerName} />}
      </aside>
    </main>
  );
}

async function ChallengesList({
  courseId,
  viewerId,
  upcoming,
  last,
  viewerName,
}: {
  courseId: string;
  viewerId: string;
  upcoming: Awaited<ReturnType<typeof getUpcomingChallenge>>;
  last: Awaited<ReturnType<typeof getLastClosedChallenge>>;
  viewerName: string;
}) {
  const db = await getDb();
  const past = await getClosedChallenges(db, courseId, new Date(), 8);
  const results = await Promise.all(past.slice(1).map((c) => getClosedChallengeResult(db, c, viewerId, 1)));
  return (
    <div className="flex flex-col gap-3.5">
      {upcoming && <UpcomingChallengeCard data={upcoming} className="lg:hidden" />}
      {last ? (
        <div className="lg:hidden">
          <LastChallengeCard data={last} viewerName={viewerName} />
        </div>
      ) : (
        <p className="text-[15px] text-ink-muted">No challenges have closed yet. The first results show here.</p>
      )}
      {results.length > 0 && (
        <Card className="px-5 py-2">
          <h2 className="py-2.5 text-[13px] text-ink-muted">Earlier challenges</h2>
          <ul>
            {results.map((r) => (
              <li key={r.challenge.id} className="border-t border-border">
                <Link href={`/leaderboard/challenges/${r.challenge.id}`} className="flex min-h-[52px] items-center gap-3 text-[15px]">
                  <span className="flex-1">
                    {r.challenge.title} · {formatDate(r.challenge.startsAt, { year: false })}
                  </span>
                  <span className="text-sm text-ink-muted">{r.viewer ? `#${r.viewer.rank} of ${r.total}` : `${r.total} took it`}</span>
                  <ChevronRight size={18} className="text-ink-muted" aria-hidden />
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
