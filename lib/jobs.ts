import { and, count, eq, gt, inArray, lt, or, sql } from "drizzle-orm";
import type { Db } from "@/db";
import { aiJobs } from "@/db/schema";
import { AiError } from "@/lib/ai/provider";

/**
 * DB-backed job queue (build brief: ai_jobs + Vercel Cron every minute).
 * Workers claim with FOR UPDATE SKIP LOCKED, so cron, the post-upload kick and the
 * progress poll can all run at once without doing a job twice. A worker that dies
 * leaves its job "running"; after the lease it is claimed again.
 *
 * When every AI provider is cooling down the job is put back with runAfter = the
 * moment the first provider is free, without using up a retry (queue, don't fail).
 */

export type JobType = "ingest_upload" | "generate_chunk" | "embed_upload";
export type Job = typeof aiJobs.$inferSelect;
export type Handler = (db: Db, job: Job) => Promise<void>;

export const LEASE_MS = 5 * 60_000;
export const MAX_ATTEMPTS = 3;

/** Thrown by a handler that must wait (e.g. the same file is still being processed for someone else). */
export class RetryLater extends Error {
  constructor(readonly delayMs: number, message = "waiting") {
    super(message);
  }
}

export async function enqueue(
  db: Db,
  type: JobType,
  payload: Record<string, unknown>,
  opts: { userId?: string | null; priority?: number; runAfter?: Date } = {},
): Promise<string> {
  const [row] = await db
    .insert(aiJobs)
    .values({ type, payload, userId: opts.userId ?? null, priority: opts.priority ?? 0, runAfter: opts.runAfter ?? new Date() })
    .returning({ id: aiJobs.id });
  return row.id;
}

type RawJob = {
  id: string;
  type: string;
  user_id: string | null;
  payload: unknown;
  status: Job["status"];
  priority: number;
  provider: string | null;
  attempts: number;
  run_after: string | Date;
  locked_at: string | Date | null;
  finished_at: string | Date | null;
  error: string | null;
  created_at: string | Date;
};

const toDate = (v: string | Date | null) => (v === null ? null : v instanceof Date ? v : new Date(v));

/** Claims the next due job (highest priority, then oldest), or null. */
export async function claimJob(db: Db, now = new Date(), types?: JobType[]): Promise<Job | null> {
  const staleBefore = new Date(now.getTime() - LEASE_MS);
  const typeFilter = types?.length ? sql`and type in (${sql.join(types.map((t) => sql`${t}`), sql`, `)})` : sql``;
  const res = (await db.execute(sql`
    update ai_jobs set status = 'running', locked_at = ${now.toISOString()}, attempts = attempts + 1
    where id = (
      select id from ai_jobs
      where ((status = 'queued' and run_after <= ${now.toISOString()}) or (status = 'running' and locked_at < ${staleBefore.toISOString()}))
      ${typeFilter}
      order by priority desc, run_after, created_at
      limit 1
      for update skip locked
    )
    returning *
  `)) as unknown as { rows: RawJob[] };
  const r = res.rows[0];
  if (!r) return null;
  return {
    id: r.id,
    type: r.type,
    userId: r.user_id,
    payload: r.payload,
    status: r.status,
    priority: r.priority,
    provider: r.provider,
    attempts: r.attempts,
    runAfter: toDate(r.run_after)!,
    lockedAt: toDate(r.locked_at),
    finishedAt: toDate(r.finished_at),
    error: r.error,
    createdAt: toDate(r.created_at)!,
  };
}

/** Backoff after a real failure: 30 s, 2 min, … */
export const backoffMs = (attempts: number) => 30_000 * 4 ** Math.max(0, attempts - 1);

export async function settle(db: Db, job: Job, outcome: { ok: true } | { ok: false; error: unknown }, now = new Date(), onFinalFailure?: (job: Job, message: string) => Promise<void>) {
  if (outcome.ok) {
    await db.update(aiJobs).set({ status: "done", finishedAt: now, lockedAt: null, error: null }).where(eq(aiJobs.id, job.id));
    return "done" as const;
  }
  const err = outcome.error;
  if (err instanceof RetryLater || (err instanceof AiError && err.kind === "cooldown")) {
    const delay = err instanceof RetryLater ? err.delayMs : (err.retryAfterMs ?? 60_000);
    await db
      .update(aiJobs)
      .set({ status: "queued", lockedAt: null, attempts: Math.max(0, job.attempts - 1), runAfter: new Date(now.getTime() + delay), error: err.message })
      .where(eq(aiJobs.id, job.id));
    return "waiting" as const;
  }
  const message = err instanceof Error ? err.message : String(err);
  const permanent = err instanceof AiError && (err.kind === "not_configured" || err.kind === "blocked");
  if (!permanent && job.attempts < MAX_ATTEMPTS) {
    await db
      .update(aiJobs)
      .set({ status: "queued", lockedAt: null, runAfter: new Date(now.getTime() + backoffMs(job.attempts)), error: message })
      .where(eq(aiJobs.id, job.id));
    return "retry" as const;
  }
  await db.update(aiJobs).set({ status: "failed", finishedAt: now, lockedAt: null, error: message }).where(eq(aiJobs.id, job.id));
  await onFinalFailure?.(job, message);
  return "failed" as const;
}

export type RunSummary = { ran: number; done: number; waiting: number; retry: number; failed: number };

/**
 * Works through due jobs until the time budget runs out. Safe to call from
 * several places at once.
 */
export async function runJobs(
  db: Db,
  handlers: Partial<Record<JobType, Handler>>,
  opts: { budgetMs?: number; maxJobs?: number; types?: JobType[]; onFinalFailure?: (job: Job, message: string) => Promise<void> } = {},
): Promise<RunSummary> {
  const started = Date.now();
  const summary: RunSummary = { ran: 0, done: 0, waiting: 0, retry: 0, failed: 0 };
  const budget = opts.budgetMs ?? 45_000;
  while (Date.now() - started < budget && summary.ran < (opts.maxJobs ?? 50)) {
    const job = await claimJob(db, new Date(), opts.types);
    if (!job) break;
    summary.ran++;
    const handler = handlers[job.type as JobType];
    let outcome: { ok: true } | { ok: false; error: unknown };
    try {
      if (!handler) throw new Error(`No handler for job type ${job.type}`);
      await handler(db, job);
      outcome = { ok: true };
    } catch (error) {
      outcome = { ok: false, error };
    }
    summary[await settle(db, job, outcome, new Date(), opts.onFinalFailure)]++;
  }
  return summary;
}

/** Jobs waiting ahead of these (higher priority, or same priority and older), for "about N minutes". */
export async function jobsAhead(db: Db, jobIds: string[]): Promise<number> {
  if (!jobIds.length) return 0;
  const mine = await db
    .select({ priority: aiJobs.priority, createdAt: aiJobs.createdAt })
    .from(aiJobs)
    .where(and(inArray(aiJobs.id, jobIds), inArray(aiJobs.status, ["queued", "running"])));
  if (!mine.length) return 0;
  const first = mine.reduce((a, b) => (a.priority > b.priority || (a.priority === b.priority && a.createdAt < b.createdAt) ? a : b));
  const [{ n }] = await db
    .select({ n: count() })
    .from(aiJobs)
    .where(
      and(
        inArray(aiJobs.status, ["queued", "running"]),
        or(gt(aiJobs.priority, first.priority), and(eq(aiJobs.priority, first.priority), lt(aiJobs.createdAt, first.createdAt))),
      ),
    );
  return Number(n);
}

export async function hasDueJobs(db: Db, now = new Date()): Promise<boolean> {
  const res = (await db.execute(sql`
    select 1 from ai_jobs
    where (status = 'queued' and run_after <= ${now.toISOString()}) or (status = 'running' and locked_at < ${new Date(now.getTime() - LEASE_MS).toISOString()})
    limit 1
  `)) as unknown as { rows: unknown[] };
  return res.rows.length > 0;
}
