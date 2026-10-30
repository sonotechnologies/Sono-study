import { beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { createPgliteDb, type Db } from "@/db";
import { enrollments, flashcards, users } from "@/db/schema";
import { seed } from "@/db/seed";
import { CardError, dueCounts, dueQueue, intervalLabel, MIN_EASE, previewIntervals, reviewCard, reviewedToday, saveCard, schedule, sessionSummary, XP_PER_CARD } from "@/lib/flashcards";
import { dailyPlan } from "@/lib/study-plan";

const NOW = new Date("2026-10-16T18:05:00Z");
const GST = "crs-gst111";
let db: Db;

beforeAll(async () => {
  db = await createPgliteDb();
  await seed(db, NOW);
});

async function student(id: string) {
  await db.insert(users).values({ id, name: "S", email: `${id}@example.com`, schoolId: "sch-unilag", onboardedAt: NOW });
  await db.insert(enrollments).values({ userId: id, courseId: GST });
  return id;
}

describe("SM-2 scheduling (design 2k buttons)", () => {
  it("new cards: Again <1 min, Hard 6 min, Good 1 day, Easy 4 days", () => {
    expect(previewIntervals(null)).toEqual({ again: "<1 min", hard: "6 min", good: "1 day", easy: "4 days" });
  });

  it("grows learned cards by ease and resets on a lapse", () => {
    let s = schedule(null, "good"); // 1 day
    s = schedule(s, "good"); // ×2.5
    expect(s.intervalDays).toBe(2.5);
    s = schedule(s, "easy");
    expect(s.ease).toBeCloseTo(2.65);
    expect(s.intervalDays).toBeCloseTo(2.5 * 2.5 * 1.3);
    const lapsed = schedule(s, "again");
    expect(lapsed).toMatchObject({ lapses: 1, ease: 2.45 });
    expect(intervalLabel(lapsed.intervalDays)).toBe("<1 min");
    expect(schedule(s, "hard").intervalDays).toBeCloseTo(s.intervalDays * 1.2);
  });

  it("never lets ease fall below 1.3", () => {
    let s = schedule(null, "good");
    for (let i = 0; i < 20; i++) s = schedule(s, "again");
    expect(s.ease).toBe(MIN_EASE);
  });

  it("labels intervals for the buttons", () => {
    expect([intervalLabel(0.5 / 1440), intervalLabel(6 / 1440), intervalLabel(1), intervalLabel(4), intervalLabel(21), intervalLabel(90)]).toEqual(["<1 min", "6 min", "1 day", "4 days", "3 wk", "3 mo"]);
  });
});

describe("reviews", () => {
  it("serves due cards, reschedules them, logs XP and keeps the streak", async () => {
    const id = await student("cards-a");
    const before = await dueCounts(db, id, GST, NOW);
    expect(before).toMatchObject({ review: 0, fresh: 20, total: 20 }); // 20 seeded sample cards, all new

    const queue = await dueQueue(db, id, GST, 5, NOW);
    expect(queue).toHaveLength(5);
    expect(queue[0]).toMatchObject({ isNew: true, editable: false, intervals: { good: "1 day" } });

    const ratings = ["good", "again", "easy", "hard", "good"] as const;
    for (let i = 0; i < 5; i++) await reviewCard(db, id, queue[i].id, ratings[i], NOW);
    const [u] = await db.select().from(users).where(eq(users.id, id));
    expect(u.xp).toBe(5 * XP_PER_CARD);
    expect(u.streakDays).toBe(1);
    expect(await reviewedToday(db, id, GST, NOW)).toBe(5);

    // A minute later, only the "Again" card is due again; new cards left for today: 15.
    const later = new Date(NOW.getTime() + 60_000);
    expect(await dueCounts(db, id, GST, later)).toMatchObject({ review: 1, fresh: 15 });
    expect((await dueQueue(db, id, GST, 20, later))[0].id).toBe(queue[1].id);

    const summary = await sessionSummary(db, id, GST, new Date(NOW.getTime() - 1000), NOW);
    expect(summary).toMatchObject({ total: 5, xp: 15, counts: { again: 1, hard: 1, good: 2, easy: 1 }, again: [queue[1].id] });
    expect(summary.nextDue?.count).toBe(2); // the two "Good" cards, tomorrow
  });

  it("students write their own (private) cards and may edit only theirs", async () => {
    const id = await student("cards-b");
    const cardId = await saveCard(db, id, { courseId: GST, front: "What is semantic noise?", back: "Different meanings of the same words." });
    const [c] = await db.select().from(flashcards).where(eq(flashcards.id, cardId));
    expect(c).toMatchObject({ visibility: "private", createdById: id });
    expect((await dueQueue(db, id, GST, 50, NOW)).find((x) => x.id === cardId)?.editable).toBe(true);
    expect((await dueQueue(db, "cards-a", GST, 50, NOW)).some((x) => x.id === cardId)).toBe(false);
    await saveCard(db, id, { courseId: GST, cardId, front: "What is semantic noise?", back: "When words mean different things to sender and receiver." });
    await expect(saveCard(db, "cards-a", { courseId: GST, cardId, front: "x y", back: "z" })).rejects.toBeInstanceOf(CardError);
    await expect(saveCard(db, id, { courseId: GST, front: " ", back: "" })).rejects.toBeInstanceOf(CardError);
  });

  it("puts due cards first in the day's plan, free plan included", () => {
    const topics = [{ id: "a", name: "A", questions: 30, mastery: 0.2, label: "weak" as const }];
    const plan = dailyPlan({ topics, examDate: null, tier: "basic", activity: { answeredByTopic: new Map(), mocksDone: 0 }, cards: { due: 12, reviewedToday: 3 } });
    expect(plan.items[0]).toMatchObject({ kind: "cards", label: "Review 15 flashcards", done: false });
    expect(plan.items).toHaveLength(3);
    const done = dailyPlan({ topics, examDate: null, tier: "basic", activity: { answeredByTopic: new Map(), mocksDone: 0 }, cards: { due: 0, reviewedToday: 8 } });
    expect(done.items[0].done).toBe(true);
  });
});
