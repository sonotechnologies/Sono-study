import { and, count, desc, eq, inArray, isNotNull, ne, notInArray, or } from "drizzle-orm";
import { z } from "zod";
import type { Db } from "@/db";
import { courses, enrollments, schools, users } from "@/db/schema";
import { normaliseCourseCode, LEVELS } from "./courses";
import { normaliseHandle } from "./identity";

export interface SchoolOption {
  id: string;
  name: string;
  shortName: string;
  type: "university" | "poly" | "coe";
  town: string | null;
  state: string;
  students: number;
}

/** All selectable schools with student counts — small enough to filter on the phone. */
export async function listSchools(db: Db, viewerId: string): Promise<SchoolOption[]> {
  const rows = await db
    .select({
      id: schools.id,
      name: schools.name,
      shortName: schools.shortName,
      type: schools.type,
      town: schools.town,
      state: schools.state,
      students: count(users.id),
    })
    .from(schools)
    .leftJoin(users, and(eq(users.schoolId, schools.id), isNotNull(users.onboardedAt)))
    .where(or(eq(schools.verified, true), eq(schools.requestedById, viewerId)))
    .groupBy(schools.id);
  return rows
    .map((r) => ({ ...r, students: Number(r.students) }))
    .sort((a, b) => b.students - a.students || a.name.localeCompare(b.name));
}

/** Most-enrolled course codes among classmates at the same school and level (and department when known). */
export async function popularCourses(
  db: Db,
  opts: { schoolId: string; level: number; department?: string | null; exclude?: string[]; limit?: number },
): Promise<string[]> {
  const peerFilter = and(
    eq(users.schoolId, opts.schoolId),
    eq(users.level, opts.level),
    opts.department ? eq(users.department, opts.department) : undefined,
  );
  const rows = await db
    .select({ code: courses.code, n: count() })
    .from(enrollments)
    .innerJoin(users, eq(users.id, enrollments.userId))
    .innerJoin(courses, eq(courses.id, enrollments.courseId))
    .where(and(peerFilter, eq(courses.schoolId, opts.schoolId), opts.exclude?.length ? notInArray(courses.code, opts.exclude) : undefined))
    .groupBy(courses.code)
    .orderBy(desc(count()), courses.code)
    .limit(opts.limit ?? 4);
  return rows.map((r) => r.code);
}

const time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);
const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

export const onboardingInput = z.object({
  school: z.union([
    z.object({ id: z.string().min(1) }),
    z.object({ newName: z.string().trim().min(4).max(120), state: z.string().trim().min(2).max(40) }),
  ]),
  name: z.string().trim().min(1).max(60),
  handle: z.string(),
  anonymous: z.boolean(),
  department: z.string().trim().min(2).max(60),
  level: z.number().refine((l) => (LEVELS as readonly number[]).includes(l)),
  courses: z
    .array(
      z.object({
        code: z.string(),
        examDate: day.nullable().optional(),
        examTime: time.nullable().optional(),
      }),
    )
    .min(1)
    .max(15),
});
export type OnboardingInput = z.infer<typeof onboardingInput>;

export type OnboardingResult = { ok: true } | { ok: false; field: "handle" | "courses" | "school" | "form"; error: string };

/** Saves the whole onboarding in one go: school (or a new pending one), profile, courses and exam dates. */
export async function completeOnboarding(db: Db, userId: string, raw: unknown, now = new Date()): Promise<OnboardingResult> {
  const parsed = onboardingInput.safeParse(raw);
  if (!parsed.success) return { ok: false, field: "form", error: "Some answers look incomplete. Check each step and try again." };
  const input = parsed.data;

  const handle = normaliseHandle(input.handle);
  if (!handle) return { ok: false, field: "handle", error: "Handles are 3–20 letters, numbers, dots or underscores." };
  const codes = [...new Set(input.courses.map((c) => normaliseCourseCode(c.code)))];
  if (codes.some((c) => c === null)) return { ok: false, field: "courses", error: "One of the course codes doesn't look right, e.g. GST 111." };

  const [clash] = await db
    .select({ id: users.id })
    .from(users)
    .where(and(eq(users.handle, handle), ne(users.id, userId)));
  if (clash) return { ok: false, field: "handle", error: `@${handle} is taken. Try another.` };

  return db.transaction(async (tx) => {
    let schoolId: string;
    if ("id" in input.school) {
      const [school] = await tx
        .select({ id: schools.id })
        .from(schools)
        .where(and(eq(schools.id, input.school.id), or(eq(schools.verified, true), eq(schools.requestedById, userId))));
      if (!school) return { ok: false, field: "school", error: "Pick your school from the list." } as const;
      schoolId = school.id;
    } else {
      const name = input.school.newName;
      const shortName = name
        .split(/\s+/)
        .filter((w) => /^[A-Z]/.test(w) && !["Of", "And", "The"].includes(w))
        .map((w) => w[0])
        .join("")
        .slice(0, 10) || name.slice(0, 10);
      const [school] = await tx
        .insert(schools)
        .values({ name, shortName, type: /poly/i.test(name) ? "poly" : /education/i.test(name) ? "coe" : "university", state: input.school.state, verified: false, requestedById: userId })
        .returning({ id: schools.id });
      schoolId = school.id;
    }

    await tx
      .update(users)
      .set({ name: input.name, handle, anonymous: input.anonymous, schoolId, department: input.department, level: input.level, onboardedAt: now })
      .where(eq(users.id, userId));

    // Courses are unique per school + code; create any the school doesn't have yet.
    await tx
      .insert(courses)
      .values(codes.map((code) => ({ schoolId, code: code!, title: code!.replace(/^([A-Z]+)(\d+)/, "$1 $2") })))
      .onConflictDoNothing();
    const rows = await tx
      .select({ id: courses.id, code: courses.code })
      .from(courses)
      .where(and(eq(courses.schoolId, schoolId), inArray(courses.code, codes as string[])));
    const byCode = new Map(rows.map((r) => [r.code, r.id]));

    // Replace the student's course list with what they picked, keeping enrollments that stay.
    const keepIds = rows.map((r) => r.id);
    await tx.delete(enrollments).where(and(eq(enrollments.userId, userId), notInArray(enrollments.courseId, keepIds)));
    for (const c of input.courses) {
      const courseId = byCode.get(normaliseCourseCode(c.code)!)!;
      const examDate = c.examDate ?? null;
      const examTime = examDate ? (c.examTime ?? null) : null;
      await tx
        .insert(enrollments)
        .values({ userId, courseId, examDate, examTime })
        .onConflictDoUpdate({ target: [enrollments.userId, enrollments.courseId], set: { examDate, examTime } });
    }
    return { ok: true } as const;
  });
}

/** Students who signed in but never finished onboarding. */
export function needsOnboarding(user: { onboardedAt: Date | null }) {
  return user.onboardedAt === null;
}

