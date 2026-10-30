import { beforeAll, describe, expect, it } from "vitest";
import { and, eq } from "drizzle-orm";
import { createPgliteDb, type Db } from "@/db";
import { courses, enrollments, schools, users } from "@/db/schema";
import { DEMO_USER_ID, seed } from "@/db/seed";
import { SCHOOLS } from "@/db/schools-list";
import { normaliseCourseCode, levelLabel } from "@/lib/courses";
import { completeOnboarding, listSchools, popularCourses } from "@/lib/onboarding";

const NOW = new Date("2026-10-16T18:05:00Z");
let db: Db;
const NEW = "new-student";

beforeAll(async () => {
  db = await createPgliteDb();
  await seed(db, NOW);
  await db.insert(users).values({ id: NEW, email: "new@example.com", name: "Amaka Obi" });
});

const base = {
  school: { id: "sch-unilag" },
  name: "Amaka Obi",
  handle: "amaka_o",
  anonymous: true,
  department: "Mass Communication",
  level: 100,
  courses: [
    { code: "gst 111", examDate: "2026-10-20", examTime: "09:00" },
    { code: "PHY-101" },
    { code: "mac111", examDate: null },
  ],
};

describe("course codes", () => {
  it("normalises common spellings", () => {
    expect(normaliseCourseCode("gst 111")).toBe("GST111");
    expect(normaliseCourseCode("PHY-101")).toBe("PHY101");
    expect(normaliseCourseCode("csc.201a")).toBe("CSC201A");
    expect(normaliseCourseCode("hello")).toBeNull();
    expect(normaliseCourseCode("G 1")).toBeNull();
    expect(levelLabel(300, "poly")).toBe("HND1");
    expect(levelLabel(300, "university")).toBe("300L");
  });
});

describe("school search", () => {
  it("lists every seeded school, busiest first", async () => {
    const list = await listSchools(db, NEW);
    expect(list).toHaveLength(SCHOOLS.length);
    expect(list[0]).toMatchObject({ shortName: "UNILAG" });
    expect(list[0].students).toBeGreaterThan(200);
  });
});

describe("popular courses", () => {
  it("suggests what classmates at the same school and level take", async () => {
    const codes = await popularCourses(db, { schoolId: "sch-unilag", level: 100, department: "Mass Communication", exclude: ["GST111", "MTH101"] });
    expect(codes.length).toBeGreaterThan(0);
    expect(codes).not.toContain("GST111");
    expect(codes).not.toContain("MTH101");
    expect(codes).toContain("PHY101");
  });
});

describe("completeOnboarding", () => {
  it("rejects a taken handle and bad course codes", async () => {
    expect(await completeOnboarding(db, NEW, { ...base, handle: "tolu" })).toMatchObject({ ok: false, field: "handle" });
    expect(await completeOnboarding(db, NEW, { ...base, handle: "x" })).toMatchObject({ ok: false, field: "handle" });
    expect(await completeOnboarding(db, NEW, { ...base, courses: [{ code: "maths" }] })).toMatchObject({ ok: false, field: "courses" });
    expect(await completeOnboarding(db, NEW, { ...base, courses: [] })).toMatchObject({ ok: false, field: "form" });
    expect(await completeOnboarding(db, NEW, { ...base, school: { id: "nope" } })).toMatchObject({ ok: false, field: "school" });
  });

  it("saves profile, joins existing courses and creates new ones", async () => {
    expect(await completeOnboarding(db, NEW, base, NOW)).toEqual({ ok: true });
    const [u] = await db.select().from(users).where(eq(users.id, NEW));
    expect(u).toMatchObject({ schoolId: "sch-unilag", handle: "amaka_o", anonymous: true, department: "Mass Communication", level: 100 });
    expect(u.onboardedAt?.toISOString()).toBe(NOW.toISOString());
    const rows = await db
      .select({ id: courses.id, code: courses.code, examDate: enrollments.examDate, examTime: enrollments.examTime })
      .from(enrollments)
      .innerJoin(courses, eq(courses.id, enrollments.courseId))
      .where(eq(enrollments.userId, NEW));
    const byCode = Object.fromEntries(rows.map((r) => [r.code, r]));
    expect(Object.keys(byCode).sort()).toEqual(["GST111", "MAC111", "PHY101"]);
    expect(byCode.GST111).toMatchObject({ id: "crs-gst111", examDate: "2026-10-20", examTime: "09:00" });
    expect(byCode.PHY101.examDate).toBeNull();
  });

  it("replaces the course list when edited later", async () => {
    await completeOnboarding(db, NEW, { ...base, courses: [{ code: "GST111" }, { code: "ZZZ 999" }] }, NOW);
    const rows = await db
      .select({ code: courses.code, schoolId: courses.schoolId, title: courses.title })
      .from(enrollments)
      .innerJoin(courses, eq(courses.id, enrollments.courseId))
      .where(eq(enrollments.userId, NEW));
    expect(rows.map((r) => r.code).sort()).toEqual(["GST111", "ZZZ999"]);
    expect(rows.find((r) => r.code === "ZZZ999")).toMatchObject({ schoolId: "sch-unilag", title: "ZZZ 999" });
  });

  it("adds a missing school as pending, visible only to the student who added it", async () => {
    const res = await completeOnboarding(db, NEW, { ...base, school: { newName: "Federal University Lokoja", state: "Kogi" } }, NOW);
    expect(res).toEqual({ ok: true });
    const [school] = await db.select().from(schools).where(eq(schools.name, "Federal University Lokoja"));
    expect(school).toMatchObject({ verified: false, requestedById: NEW, shortName: "FUL", type: "university" });
    expect((await listSchools(db, NEW)).some((s) => s.id === school.id)).toBe(true);
    expect((await listSchools(db, DEMO_USER_ID)).some((s) => s.id === school.id)).toBe(false);
    const [gst] = await db
      .select()
      .from(courses)
      .where(and(eq(courses.schoolId, school.id), eq(courses.code, "GST111")));
    expect(gst).toBeDefined();
  });
});
