import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { asc, eq, inArray } from "drizzle-orm";
import { getDb, type Db } from "@/db";
import { courses, enrollments, users } from "@/db/schema";
import { OnboardingFlow } from "@/components/onboarding/flow";
import { anonymousName } from "@/lib/identity";
import { listSchools } from "@/lib/onboarding";
import { lagosDate } from "@/lib/time";
import { getViewerId } from "@/lib/viewer";

export const metadata: Metadata = { title: "Set up" };

/** First name (or email name) as a handle, with digits added until it's free. */
async function suggestHandle(db: Db, name: string | null, email: string | null): Promise<string> {
  const raw = (name?.split(" ")[0] ?? email?.split("@")[0] ?? "student").toLowerCase().replace(/[^a-z0-9]/g, "");
  const base = (raw.length >= 3 ? raw : `${raw}study`).slice(0, 16);
  const candidates = [base, ...Array.from({ length: 5 }, () => `${base}${Math.floor(10 + Math.random() * 990)}`)];
  const taken = new Set(
    (await db.select({ handle: users.handle }).from(users).where(inArray(users.handle, candidates))).map((r) => r.handle),
  );
  return candidates.find((c) => !taken.has(c)) ?? `${base}${Date.now() % 10000}`;
}

export default async function OnboardingPage({ searchParams }: { searchParams: Promise<{ edit?: string; step?: string }> }) {
  const sp = await searchParams;
  const userId = await getViewerId();
  if (!userId) redirect("/login");
  const db = await getDb();
  const [user] = await db.select().from(users).where(eq(users.id, userId));
  if (!user) redirect("/login");
  const editing = sp.edit === "1" && user.onboardedAt !== null;
  if (!editing && user.onboardedAt) redirect("/home");

  const [schoolList, enrolled] = await Promise.all([
    listSchools(db, userId),
    db
      .select({ code: courses.code, examDate: enrollments.examDate, examTime: enrollments.examTime })
      .from(enrollments)
      .innerJoin(courses, eq(courses.id, enrollments.courseId))
      .where(eq(enrollments.userId, userId))
      .orderBy(asc(enrollments.createdAt)),
  ]);
  const step = Math.min(4, Math.max(1, Number(sp.step) || 1));

  return (
    <OnboardingFlow
      schools={schoolList}
      editing={editing}
      initialStep={editing ? step : 1}
      anonymousName={anonymousName(userId)}
      today={lagosDate()}
      initial={{
        schoolId: user.schoolId,
        name: user.name ?? "",
        handle: user.handle ?? (await suggestHandle(db, user.name, user.email)),
        anonymous: user.anonymous,
        department: user.department ?? "",
        level: user.level ?? 100,
        courses: enrolled.map((c) => ({ code: c.code, examDate: c.examDate, examTime: c.examTime })),
      }}
    />
  );
}
