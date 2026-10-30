import { and, count, eq, isNotNull, sql } from "drizzle-orm";
import type { Db } from "@/db";
import { aiUsage, mockAttempts, users } from "@/db/schema";
import { limitFor, type LimitedAction, type PlanName } from "./plans";
import { lagosDate, nextDailyReset } from "./time";

export interface UsageStatus {
  action: LimitedAction;
  used: number;
  limit: number;
  remaining: number;
  resetsAt: Date;
}

export async function getUsage(db: Db, userId: string, action: LimitedAction, plan: PlanName, now = new Date()): Promise<UsageStatus> {
  const [row] = await db
    .select({ count: aiUsage.count })
    .from(aiUsage)
    .where(and(eq(aiUsage.userId, userId), eq(aiUsage.date, lagosDate(now)), eq(aiUsage.action, action)));
  const used = row?.count ?? 0;
  const limit = limitFor(plan, action);
  return { action, used, limit, remaining: Math.max(0, limit - used), resetsAt: nextDailyReset(now) };
}

/** Atomically counts usage for today (Lagos). Callers check the limit first. */
export async function recordUsage(db: Db, userId: string, action: LimitedAction, amount = 1, now = new Date()) {
  await db
    .insert(aiUsage)
    .values({ userId, date: lagosDate(now), action, count: amount })
    .onConflictDoUpdate({
      target: [aiUsage.userId, aiUsage.date, aiUsage.action],
      set: { count: sql`${aiUsage.count} + ${amount}` },
    });
}

/** Referred classmates who signed up and finished at least one mock. */
export async function getReferralProgress(db: Db, userId: string): Promise<number> {
  const [row] = await db
    .select({ n: count(sql`distinct ${users.id}`) })
    .from(users)
    .innerJoin(mockAttempts, and(eq(mockAttempts.userId, users.id), isNotNull(mockAttempts.submittedAt)))
    .where(eq(users.referredById, userId));
  return Number(row?.n ?? 0);
}
