import { and, eq, sql, type SQL } from "drizzle-orm";
import type { Db } from "@/db";
import { leaderboardEntries } from "@/db/schema";
import { publicName } from "./identity";
import { weekStart } from "./time";

/** Short quizzes don't count toward the weekly board. */
export const LEADERBOARD_MIN_QUESTIONS = 20;

export type BoardScope = "week" | "all" | "department";

export interface BoardRow {
  rank: number;
  userId: string;
  name: string;
  score: number;
  maxScore: number;
  timeSec: number;
  mocks: number;
  isViewer: boolean;
}

export interface Board {
  rows: BoardRow[];
  /** The viewer's own row, whether or not it's inside `rows`. */
  viewer: BoardRow | null;
  total: number;
}

interface Viewer {
  id: string;
  schoolId: string | null;
  department: string | null;
}

type RawRow = {
  rank: number;
  total: number;
  user_id: string;
  handle: string | null;
  anonymous: boolean;
  score: number;
  max_score: number;
  time_sec: number;
  mocks: number;
};

/** Ranking rule used everywhere: best score ratio first, then fastest time. */
export function compareResults(
  a: { score: number; maxScore: number; timeSec: number },
  b: { score: number; maxScore: number; timeSec: number },
): number {
  const ra = a.score / a.maxScore;
  const rb = b.score / b.maxScore;
  if (ra !== rb) return rb - ra;
  return a.timeSec - b.timeSec;
}

const RANK_ORDER = sql`(e.score::float / e.max_score) desc, e.time_sec asc`;

/**
 * Ranks the entries selected by `source` (a subquery with user_id, score,
 * max_score, time_sec, mocks) and returns the top `limit` plus the viewer.
 */
async function rankFrom(db: Db, source: SQL, viewerId: string, limit: number, filter?: SQL): Promise<Board> {
  // Neon and PGlite both return { rows } from execute().
  const result = (await db.execute(sql`
    with ranked as (
      select e.user_id, e.score, e.max_score, e.time_sec, e.mocks::int as mocks,
             u.handle, u.anonymous,
             (rank() over (order by ${RANK_ORDER}))::int as rank,
             (count(*) over ())::int as total
      from (${source}) e
      join users u on u.id = e.user_id
      ${filter ? sql`where ${filter}` : sql``}
    )
    select * from ranked
    where rank <= ${limit} or user_id = ${viewerId}
    order by rank asc, time_sec asc
  `)) as unknown as { rows: RawRow[] };
  const toRow = (r: RawRow): BoardRow => ({
    rank: Number(r.rank),
    userId: r.user_id,
    name: publicName({ id: r.user_id, handle: r.handle, anonymous: r.anonymous }),
    score: Number(r.score),
    maxScore: Number(r.max_score),
    timeSec: Number(r.time_sec),
    mocks: Number(r.mocks),
    isViewer: r.user_id === viewerId,
  });
  const all = result.rows.map(toRow);
  return {
    rows: all.filter((r) => r.rank <= limit).slice(0, limit),
    viewer: all.find((r) => r.isViewer) ?? null,
    total: result.rows[0] ? Number(result.rows[0].total) : 0,
  };
}

export async function getCourseBoard(
  db: Db,
  opts: { courseId: string; scope: BoardScope; viewer: Viewer; limit?: number; now?: Date },
): Promise<Board> {
  const limit = opts.limit ?? 9;
  const week = weekStart(opts.now);

  if (opts.scope === "all") {
    // Each student's best result across all weeks, with their total mock count.
    const source = sql`
      select distinct on (user_id) user_id, score, max_score, time_sec,
             sum(mocks) over (partition by user_id) as mocks
      from leaderboard_entries
      where course_id = ${opts.courseId} and week_start is not null
      order by user_id, (score::float / max_score) desc, time_sec asc`;
    return rankFrom(db, source, opts.viewer.id, limit);
  }

  const source = sql`
    select user_id, score, max_score, time_sec, mocks from leaderboard_entries
    where course_id = ${opts.courseId} and week_start = ${week}`;
  const filter =
    opts.scope === "department" && opts.viewer.department
      ? sql`u.school_id = ${opts.viewer.schoolId} and u.department = ${opts.viewer.department}`
      : undefined;
  return rankFrom(db, source, opts.viewer.id, limit, filter);
}

export async function getChallengeBoard(db: Db, opts: { challengeId: string; viewerId: string; limit?: number }) {
  const source = sql`
    select user_id, score, max_score, time_sec, mocks from leaderboard_entries
    where challenge_id = ${opts.challengeId}`;
  return rankFrom(db, source, opts.viewerId, opts.limit ?? 10);
}

/**
 * Records a submitted mock on the weekly board, keeping the student's best
 * result and counting every qualifying mock. Called by the exam engine on submit.
 */
export async function recordWeeklyResult(
  db: Db,
  r: { courseId: string; userId: string; score: number; maxScore: number; timeSec: number; now?: Date },
): Promise<boolean> {
  if (r.maxScore < LEADERBOARD_MIN_QUESTIONS) return false;
  const week = weekStart(r.now);
  const [existing] = await db
    .select()
    .from(leaderboardEntries)
    .where(
      and(
        eq(leaderboardEntries.courseId, r.courseId),
        eq(leaderboardEntries.weekStart, week),
        eq(leaderboardEntries.userId, r.userId),
      ),
    );
  if (!existing) {
    await db.insert(leaderboardEntries).values({
      courseId: r.courseId, weekStart: week, userId: r.userId, score: r.score, maxScore: r.maxScore, timeSec: r.timeSec,
    });
    return true;
  }
  const better = compareResults(r, existing) < 0;
  await db
    .update(leaderboardEntries)
    .set({
      mocks: existing.mocks + 1,
      updatedAt: new Date(),
      ...(better ? { score: r.score, maxScore: r.maxScore, timeSec: r.timeSec } : {}),
    })
    .where(eq(leaderboardEntries.id, existing.id));
  return true;
}
