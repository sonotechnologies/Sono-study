import { NextResponse, type NextRequest } from "next/server";
import { getDb } from "@/db";
import { processQueue } from "@/lib/uploads";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Queue worker, run every minute by Vercel Cron (vercel.json). Vercel sends
 * "Authorization: Bearer $CRON_SECRET"; any other scheduler can do the same.
 */
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (secret ? req.headers.get("authorization") !== `Bearer ${secret}` : process.env.NODE_ENV === "production") {
    return new NextResponse("Unauthorized", { status: 401 });
  }
  const summary = await processQueue(await getDb(), { budgetMs: 50_000 });
  return NextResponse.json(summary);
}
