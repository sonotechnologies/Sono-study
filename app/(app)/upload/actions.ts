"use server";

import { after } from "next/server";
import { z } from "zod";
import { getDb } from "@/db";
import { confirmUpload, prepareUpload, processQueue, UploadError, type PrepareResult } from "@/lib/uploads";
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
  try {
    return { ok: true, ...(await prepareUpload(await getDb(), viewer.id, parsed.data)) };
  } catch (err) {
    if (err instanceof UploadError) return { ok: false, error: err.message, code: err.code };
    throw err;
  }
}

/** Step 2: files are in storage. Queue the work and start on it right away. */
export async function confirmUploadAction(uploadId: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const viewer = await requireViewer();
  const db = await getDb();
  try {
    await confirmUpload(db, viewer.id, uploadId);
  } catch (err) {
    if (err instanceof UploadError) return { ok: false, error: err.message };
    throw err;
  }
  after(() => processQueue(db, { budgetMs: 40_000 }).catch((err) => console.error("[jobs]", err)));
  return { ok: true };
}
