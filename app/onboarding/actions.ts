"use server";

import { and, eq, ne } from "drizzle-orm";
import { redirect } from "next/navigation";
import { getDb } from "@/db";
import { users } from "@/db/schema";
import { normaliseCourseCode } from "@/lib/courses";
import { normaliseHandle } from "@/lib/identity";
import { completeOnboarding, popularCourses, type OnboardingResult } from "@/lib/onboarding";
import { getViewerId } from "@/lib/viewer";

async function viewerIdOrLogin() {
  const id = await getViewerId();
  if (!id) redirect("/login");
  return id;
}

export async function suggestCourses(input: { schoolId: string; level: number; department: string; exclude: string[] }) {
  await viewerIdOrLogin();
  const db = await getDb();
  const exclude = input.exclude.map(normaliseCourseCode).filter((c): c is string => c !== null);
  return popularCourses(db, { schoolId: input.schoolId, level: input.level, department: input.department || null, exclude });
}

export async function checkHandle(raw: string): Promise<{ ok: boolean; error?: string }> {
  const userId = await viewerIdOrLogin();
  const handle = normaliseHandle(raw);
  if (!handle) return { ok: false, error: "3–20 letters, numbers, dots or underscores." };
  const db = await getDb();
  const [clash] = await db
    .select({ id: users.id })
    .from(users)
    .where(and(eq(users.handle, handle), ne(users.id, userId)));
  return clash ? { ok: false, error: `@${handle} is taken. Try another.` } : { ok: true };
}

export async function submitOnboarding(input: unknown, next: "/home" | "/profile"): Promise<OnboardingResult> {
  const userId = await viewerIdOrLogin();
  const db = await getDb();
  const result = await completeOnboarding(db, userId, input);
  if (result.ok) redirect(next === "/profile" ? "/profile" : "/home");
  return result;
}
