import { getDb } from "@/db";
import { syncAttempt } from "@/lib/exam-engine/service";
import type { SyncRequest } from "@/lib/exam-engine/types";
import { getViewerId } from "@/lib/viewer";

/** The mock's sync endpoint: answers in, acknowledgements (and the result once submitted) out. */
export async function POST(req: Request, ctx: { params: Promise<{ attemptId: string }> }) {
  const userId = await getViewerId();
  if (!userId) return Response.json({ ok: false, error: "Signed out." }, { status: 401 });
  const { attemptId } = await ctx.params;
  let body: SyncRequest;
  try {
    body = (await req.json()) as SyncRequest;
  } catch {
    return Response.json({ ok: false, error: "Bad request." }, { status: 400 });
  }
  if (body?.attemptId !== attemptId) return Response.json({ ok: false, error: "Bad request." }, { status: 400 });
  const res = await syncAttempt(await getDb(), userId, body);
  return Response.json(res, { status: res.ok ? 200 : 404, headers: { "Cache-Control": "no-store" } });
}
