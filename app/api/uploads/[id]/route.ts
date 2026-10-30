import { after, NextResponse } from "next/server";
import { getDb } from "@/db";
import { hasDueJobs } from "@/lib/jobs";
import { getUploadView, processQueue } from "@/lib/uploads";
import { getViewerId } from "@/lib/viewer";

export const dynamic = "force-dynamic";

/**
 * Progress for the upload screen (polled every few seconds). While someone is
 * watching, the poll also nudges the queue, so work never waits for the next cron tick.
 */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const userId = await getViewerId();
  if (!userId) return new NextResponse("Sign in", { status: 401 });
  const { id } = await params;
  const db = await getDb();
  const view = await getUploadView(db, userId, id);
  if (!view) return new NextResponse("Not found", { status: 404 });
  if (view.status !== "ready" && view.status !== "failed" && (await hasDueJobs(db))) {
    after(() => processQueue(db, { budgetMs: 25_000 }).catch((err) => console.error("[jobs]", err)));
  }
  return NextResponse.json(view, { headers: { "Cache-Control": "no-store" } });
}
