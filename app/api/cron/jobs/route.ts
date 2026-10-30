import { NextResponse, type NextRequest } from "next/server";
import { getDb } from "@/db";
import { ensureWeeklyChallenges } from "@/lib/challenges";
import { sendDueReminders } from "@/lib/push";
import { pruneRateLimits } from "@/lib/rate-limit";
import { expireClaims } from "@/lib/transfers";
import { processQueue } from "@/lib/uploads";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Queue worker (plus next Friday's challenges and push reminders), run every minute by Vercel Cron (vercel.json). Vercel sends
 * "Authorization: Bearer $CRON_SECRET"; any other scheduler can do the same.
 */
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (secret ? req.headers.get("authorization") !== `Bearer ${secret}` : process.env.NODE_ENV === "production") {
    return new NextResponse("Unauthorized", { status: 401 });
  }
  const db = await getDb();
  const challengesCreated = await ensureWeeklyChallenges(db);
  const reminders = await sendDueReminders(db);
  await pruneRateLimits(db);
  const claimsExpired = await expireClaims(db);
  const summary = await processQueue(db, { budgetMs: 40_000 });
  return NextResponse.json({ ...summary, challengesCreated, reminders, claimsExpired });
}
