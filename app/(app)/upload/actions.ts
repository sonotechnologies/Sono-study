"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { after } from "next/server";
import { z } from "zod";
import { getDb } from "@/db";
import { uploads } from "@/db/schema";
import { setUploadSharing } from "@/lib/banks";
import { ExamError, startAttempt } from "@/lib/exam-engine/service";
import { checkRateLimit, RateLimitError, requestIp } from "@/lib/rate-limit";
import { confirmUpload, prepareUpload, processQueue, questionSourceId, UploadError, type PrepareResult } from "@/lib/uploads";
import { requireViewer } from "@/lib/viewer";

const prepareInput = z.object({
  courseId: z.string().min(1),
  contribute: z.boolean(),
  files: z
    .array(z.object({ name: z.string().max(300), type: z.string().max(200), size: z.number().int().positive(), hash: z.string() }))
    .min(1)
    .max(60),
});

export type PrepareActionResult = ({ ok: true } & PrepareResult) | { ok: false; error: string; code?: UploadError["code"] };

/** Step 1: limits, instant reuse of an identical file, or signed upload URLs. */
export async function prepareUploadAction(raw: z.infer<typeof prepareInput>): Promise<PrepareActionResult> {
  const parsed = prepareInput.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "Pick your files again." };
  const viewer = await requireViewer();
  const db = await getDb();
  try {
    await checkRateLimit(db, "upload", { userId: viewer.id, ip: await requestIp() });
    return { ok: true, ...(await prepareUpload(db, viewer.id, parsed.data)) };
  } catch (err) {
    if (err instanceof UploadError) return { ok: false, error: err.message, code: err.code };
    if (err instanceof RateLimitError) return { ok: false, error: err.message };
    throw err;
  }
}

/** Step 2: files are in storage. Queue the work and start on it right away. */
export async function confirmUploadAction(uploadId: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const viewer = await requireViewer();
  const db = await getDb();
  try {
    await checkRateLimit(db, "upload", { userId: viewer.id, ip: await requestIp() });
    await confirmUpload(db, viewer.id, uploadId);
  } catch (err) {
    if (err instanceof UploadError || err instanceof RateLimitError) return { ok: false, error: err.message };
    throw err;
  }
  after(() => processQueue(db, { budgetMs: 40_000 }).catch((err) => console.error("[jobs]", err)));
  return { ok: true };
}

/** Ready screen (2g): "Start a 20-question mock" / "Practise" from this upload's questions. */
export async function startFromUploadAction(uploadId: string, mode: "mock" | "practice") {
  const viewer = await requireViewer();
  const db = await getDb();
  const [u] = await db.select().from(uploads).where(and(eq(uploads.id, uploadId), eq(uploads.userId, viewer.id)));
  if (!u || u.status !== "ready") redirect(`/upload/${uploadId}`);
  const sourceId = await questionSourceId(db, u);
  const count = Math.max(1, Math.min(20, u.questionsMade));
  let id: string;
  try {
    const attempt =
      mode === "mock"
        ? await startAttempt(db, viewer.id, {
            mode: "mock",
            courseId: u.courseId,
            config: { count, timeLimitSec: count * 60, topicIds: [], difficulty: "mixed", bankId: null, uploadId: sourceId },
          })
        : await startAttempt(db, viewer.id, { mode: "practice", courseId: u.courseId, topicIds: [], count: 10, uploadId: sourceId });
    id = attempt.id;
  } catch (err) {
    if (err instanceof ExamError) redirect(`/upload/${uploadId}?error=${encodeURIComponent(err.message)}`);
    throw err;
  }
  redirect(`/mock/${id}`);
}

/** The contribute toggle after an upload is done. */
export async function setUploadSharingAction(uploadId: string, contribute: boolean): Promise<{ ok: boolean }> {
  const viewer = await requireViewer();
  const ok = await setUploadSharing(await getDb(), viewer.id, uploadId, contribute);
  revalidatePath("/upload", "layout");
  revalidatePath("/courses", "layout");
  return { ok };
}
