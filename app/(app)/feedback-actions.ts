"use server";

import { revalidatePath } from "next/cache";
import { getDb } from "@/db";
import { BankError, rateBank } from "@/lib/banks";
import { REPORT_REASONS, ReportError, reportQuestion, type ReportReason } from "@/lib/reports";
import { requireViewer } from "@/lib/viewer";

export type ReportResult = { ok: true; hidden: boolean; already: boolean } | { ok: false; error: string };

/** "Report question": wrong answer, off-topic, copied or inappropriate. */
export async function reportQuestionAction(questionId: string, reason: string, note: string): Promise<ReportResult> {
  if (!(reason in REPORT_REASONS)) return { ok: false, error: "Pick a reason." };
  const viewer = await requireViewer();
  try {
    const res = await reportQuestion(await getDb(), viewer.id, { questionId, reason: reason as ReportReason, note });
    return { ok: true, ...res };
  } catch (err) {
    if (err instanceof ReportError) return { ok: false, error: err.message };
    throw err;
  }
}

/** Shared bank ratings: 1–5 stars after finishing a mock from the bank. */
export async function rateBankAction(bankId: string, stars: number): Promise<{ ok: true; rating: number; count: number } | { ok: false; error: string }> {
  const viewer = await requireViewer();
  try {
    const res = await rateBank(await getDb(), viewer.id, bankId, stars);
    revalidatePath("/courses", "layout");
    return { ok: true, ...res };
  } catch (err) {
    if (err instanceof BankError) return { ok: false, error: err.message };
    throw err;
  }
}
