"use server";

import { revalidatePath } from "next/cache";
import { getDb } from "@/db";
import { getChallenge, joinChallenge } from "@/lib/challenges";
import { requireViewer } from "@/lib/viewer";

/** "Join · remind me" on an upcoming challenge. */
export async function joinChallengeAction(form: FormData) {
  const challengeId = String(form.get("challengeId") ?? "");
  const viewer = await requireViewer();
  const db = await getDb();
  const challenge = await getChallenge(db, challengeId);
  if (!challenge || challenge.endsAt <= new Date()) return;
  if (!viewer.courses.some((c) => c.id === challenge.courseId)) return;
  await joinChallenge(db, challengeId, viewer.id);
  revalidatePath("/leaderboard");
}
