import { beforeAll, describe, expect, it } from "vitest";
import { count, eq } from "drizzle-orm";
import { createPgliteDb, type Db } from "@/db";
import { banks, challenges, courses, enrollments, questions, users } from "@/db/schema";
import { seed } from "@/db/seed";
import { ensureWeeklyChallenges, nextFridayChallengeStart, WEEKLY_CHALLENGE } from "@/lib/challenges";
import { startAttempt } from "@/lib/exam-engine/service";

const NOW = new Date("2026-10-19T09:00:00Z"); // a Monday
let db: Db;

beforeAll(async () => {
  db = await createPgliteDb();
  await seed(db, NOW);
  await db.insert(courses).values({ id: "crs-thin", schoolId: "sch-unilag", code: "THN101", title: "Thin course" });
  await db.insert(questions).values(
    Array.from({ length: 5 }, (_, i) => ({ courseId: "crs-thin", stem: `Q${i}`, options: [{ id: "a", text: "A" }], answer: { kind: "single" as const, correct: "a" } })),
  );
});

describe("weekly challenges", () => {
  it("starts Friday 18:00 Lagos", () => {
    expect(nextFridayChallengeStart(NOW).toISOString()).toBe("2026-10-23T17:00:00.000Z");
    // Friday evening after the start: next week's.
    expect(nextFridayChallengeStart(new Date("2026-10-23T17:30:00Z")).toISOString()).toBe("2026-10-30T17:00:00.000Z");
  });

  it("creates next Friday's challenge for courses with enough shared questions, once", async () => {
    // The seed already scheduled GST 111 for this Friday; move it out of the way to test creation.
    await db.delete(challenges).where(eq(challenges.id, "chl-gst111-next"));
    const created = await ensureWeeklyChallenges(db, NOW);
    expect(created).toContain("chl-crs-gst111-2026-10-23");
    expect(created.some((id) => id.includes("crs-thin"))).toBe(false); // only 5 questions

    const [c] = await db.select().from(challenges).where(eq(challenges.id, "chl-crs-gst111-2026-10-23"));
    expect(c.startsAt.toISOString()).toBe("2026-10-23T17:00:00.000Z");
    expect(c.endsAt.getTime() - c.startsAt.getTime()).toBe(WEEKLY_CHALLENGE.windowMs);
    expect(c.questionCount).toBe(20);
    const [bank] = await db.select().from(banks).where(eq(banks.id, c.bankId!));
    expect(bank.questionIds).toHaveLength(20);
    expect(new Set(bank.questionIds).size).toBe(20);
    expect(bank.isShared).toBe(false); // not listed among the class's banks

    // Again (and concurrently): nothing new.
    const again = await Promise.all([ensureWeeklyChallenges(db, NOW), ensureWeeklyChallenges(db, new Date(NOW.getTime() + 60_000))]);
    expect(again.flat()).toEqual([]);
    const [{ n }] = await db.select({ n: count() }).from(challenges).where(eq(challenges.startsAt, c.startsAt));
    expect(n).toBe(created.length);
  });

  it("everyone sits the same fixed paper", async () => {
    for (const id of ["chl-a", "chl-b"]) {
      await db.insert(users).values({ id, name: id, email: `${id}@example.com`, schoolId: "sch-unilag", onboardedAt: NOW });
      await db.insert(enrollments).values({ userId: id, courseId: "crs-gst111" });
    }
    const live = new Date("2026-10-23T17:10:00Z");
    const a = await startAttempt(db, "chl-a", { mode: "challenge", challengeId: "chl-crs-gst111-2026-10-23" }, live);
    // A new question added after the challenge was made doesn't change the paper.
    await db.insert(questions).values({ courseId: "crs-gst111", stem: "Late question", options: [{ id: "a", text: "A" }], answer: { kind: "single", correct: "a" } });
    const b = await startAttempt(db, "chl-b", { mode: "challenge", challengeId: "chl-crs-gst111-2026-10-23" }, live);
    expect(a.questionIds).toHaveLength(20);
    expect([...b.questionIds].sort()).toEqual([...a.questionIds].sort());
  });
});
