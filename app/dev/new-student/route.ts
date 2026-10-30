import { NextResponse } from "next/server";
import { getDb } from "@/db";
import { eq } from "drizzle-orm";
import { enrollments, users } from "@/db/schema";
import { DEMO_USER_ID } from "@/db/seed";
import { demoMode } from "@/lib/auth";
import { DEV_USER_COOKIE } from "@/lib/viewer";

/**
 * Demo mode only (never with real sign-in): start onboarding as a brand-new student.
 * ?ready=1 skips onboarding: a classmate of the demo student (same school, department and courses).
 * ?next=/path picks where to land. ?reset=1 goes back to the demo student.
 */
export async function GET(req: Request) {
  if (!demoMode) return new Response("Not found", { status: 404 });
  const url = new URL(req.url);
  if (url.searchParams.get("reset")) {
    const res = NextResponse.redirect(new URL("/home", req.url));
    res.cookies.delete(DEV_USER_COOKIE);
    return res;
  }
  const id = `dev-${crypto.randomUUID().slice(0, 8)}`;
  const db = await getDb();
  const ready = !!url.searchParams.get("ready");
  const [demo] = ready ? await db.select().from(users).where(eq(users.id, DEMO_USER_ID)) : [];
  await db.insert(users).values({
    id,
    name: "Chioma Eze",
    email: `${id}@example.com`,
    ...(demo ? { schoolId: demo.schoolId, department: demo.department, level: demo.level, handle: id, onboardedAt: new Date() } : {}),
  });
  if (demo) {
    const courses = await db.select({ courseId: enrollments.courseId }).from(enrollments).where(eq(enrollments.userId, DEMO_USER_ID));
    if (courses.length) await db.insert(enrollments).values(courses.map((c) => ({ userId: id, courseId: c.courseId })));
  }
  const next = url.searchParams.get("next");
  const res = NextResponse.redirect(new URL(next?.startsWith("/") ? next : demo ? "/home" : "/onboarding", req.url));
  res.cookies.set(DEV_USER_COOKIE, id, { path: "/", httpOnly: true, sameSite: "lax" });
  return res;
}
