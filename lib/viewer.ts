import { cache } from "react";
import { redirect } from "next/navigation";
import { asc, eq, sql } from "drizzle-orm";
import { getDb } from "@/db";
import { courses, enrollments, schools, users, type User } from "@/db/schema";
import { DEMO_USER_ID } from "@/db/seed";
import { auth, authEnabled, demoMode } from "./auth";
import { effectivePlan } from "./billing";
import type { PlanName } from "./plans";

export const getViewerId = cache(async (): Promise<string | null> => {
  if (authEnabled) {
    const session = await auth();
    return session?.user?.id ?? null;
  }
  if (!demoMode) return null;
  {
    // Demo/local testing only: /dev/new-student signs you in as a fresh throwaway student.
    const { cookies } = await import("next/headers");
    const devUser = (await cookies()).get(DEV_USER_COOKIE)?.value;
    if (devUser?.startsWith("dev-")) return devUser;
  }
  return DEMO_USER_ID;
});

export const DEV_USER_COOKIE = "sono_dev_user";

export interface Viewer extends User {
  effectivePlan: PlanName;
  school: { name: string; shortName: string } | null;
  courses: { id: string; code: string; title: string; examDate: string | null; examTime: string | null }[];
}

/** The signed-in student with school and enrolled courses. Redirects to /login when signed out. */
export const requireViewer = cache(async (): Promise<Viewer> => {
  const id = await getViewerId();
  if (!id) redirect("/login");
  const db = await getDb();
  const [row] = await db
    .select({ user: users, school: { name: schools.name, shortName: schools.shortName } })
    .from(users)
    .leftJoin(schools, eq(schools.id, users.schoolId))
    .where(eq(users.id, id));
  if (!row) redirect("/login");
  const enrolled = await db
    .select({ id: courses.id, code: courses.code, title: courses.title, examDate: enrollments.examDate, examTime: enrollments.examTime })
    .from(enrollments)
    .innerJoin(courses, eq(courses.id, enrollments.courseId))
    .where(eq(enrollments.userId, id))
    // Nearest exam first, then by code.
    .orderBy(sql`${enrollments.examDate} asc nulls last`, asc(courses.code));
  return {
    ...row.user,
    effectivePlan: effectivePlan(row.user),
    school: row.school?.name ? row.school : null,
    courses: enrolled,
  };
});
