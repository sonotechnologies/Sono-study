"use server";

import { revalidatePath } from "next/cache";
import { getDb } from "@/db";
import { eq } from "drizzle-orm";
import { users, type CardRating } from "@/db/schema";
import { CardError, reviewCard, saveCard, sessionSummary, type SessionSummary } from "@/lib/flashcards";
import { requireViewer } from "@/lib/viewer";

export async function reviewCardAction(flashcardId: string, rating: CardRating): Promise<{ ok: true } | { ok: false; error: string }> {
  const viewer = await requireViewer();
  try {
    await reviewCard(await getDb(), viewer.id, flashcardId, rating);
    return { ok: true };
  } catch (err) {
    if (err instanceof CardError) return { ok: false, error: err.message };
    throw err;
  }
}

export async function sessionSummaryAction(courseId: string, sinceIso: string): Promise<SessionSummary & { streakDays: number }> {
  const viewer = await requireViewer();
  const since = new Date(sinceIso);
  const summary = await sessionSummary(await getDb(), viewer.id, courseId, Number.isNaN(since.getTime()) ? new Date() : since);
  revalidatePath("/home");
  // The viewer row may have been read before the reviews: read the streak again.
  const [u] = await (await getDb()).select({ streakDays: users.streakDays }).from(users).where(eq(users.id, viewer.id));
  return { ...summary, streakDays: u?.streakDays ?? viewer.streakDays };
}

export type CardFormState = { error: string | null; saved: number };

export async function saveCardAction(courseId: string, cardId: string | null, prev: CardFormState, form: FormData): Promise<CardFormState> {
  const viewer = await requireViewer();
  if (!viewer.courses.some((c) => c.id === courseId)) return { error: "Add this course first.", saved: prev.saved };
  try {
    await saveCard(await getDb(), viewer.id, {
      courseId,
      cardId,
      front: String(form.get("front") ?? ""),
      back: String(form.get("back") ?? ""),
      topicId: String(form.get("topicId") ?? "") || null,
    });
  } catch (err) {
    if (err instanceof CardError) return { error: err.message, saved: prev.saved };
    throw err;
  }
  revalidatePath(`/cards/${courseId}`);
  return { error: null, saved: prev.saved + 1 };
}
