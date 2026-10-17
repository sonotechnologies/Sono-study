import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { createHash } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { and, eq } from "drizzle-orm";
import { createPgliteDb, type Db } from "@/db";
import { banks, courses, enrollments, questions, users } from "@/db/schema";
import { seed } from "@/db/seed";
import { setAiProvidersForTests } from "@/lib/ai";
import { fakeProvider } from "@/lib/ai/fake";
import { classBank, courseBanksView, rateBank, setUploadSharing } from "@/lib/banks";
import type { CourseTopic } from "@/lib/course-data";
import { selectQuestions, startAttempt, syncAttempt } from "@/lib/exam-engine/service";
import { openReports, reportQuestion, resolveReports } from "@/lib/reports";
import { putObject } from "@/lib/storage";
import { dailyPlan, daysUntilExam, examCountdown, readiness, readNext, trackReadiness } from "@/lib/study-plan";
import { confirmUpload, prepareUpload, processQueue } from "@/lib/uploads";
import { makeNotesPdf } from "./fixtures/notes";

const NOW = new Date("2026-10-16T18:05:00Z");
let db: Db;
let pdf: Uint8Array;
const GST = "crs-gst111";
const sha = (b: Uint8Array) => createHash("sha256").update(b).digest("hex");

beforeAll(async () => {
  process.env.LOCAL_STORAGE_DIR = await mkdtemp(path.join(tmpdir(), "sono-banks-"));
  db = await createPgliteDb();
  await seed(db, NOW);
  pdf = await makeNotesPdf(8);
  setAiProvidersForTests([fakeProvider("fake")]);
  // The same course code at another school: a different course, a different bank.
  await db.insert(courses).values({ id: "crs-gst111-yct", schoolId: "sch-yabatech", code: "GST111", title: "Communication in English" });
});
afterAll(() => setAiProvidersForTests(null));

async function student(id: string, courseId = GST, school = "sch-unilag") {
  await db.insert(users).values({ id, name: "Student", email: `${id}@example.com`, schoolId: school, onboardedAt: NOW });
  await db.insert(enrollments).values({ userId: id, courseId });
  return id;
}

async function upload(userId: string, bytes: Uint8Array, contribute: boolean) {
  const prep = await prepareUpload(db, userId, { courseId: GST, contribute, files: [{ name: "Week 3 notes.pdf", type: "application/pdf", size: bytes.byteLength, hash: sha(bytes) }] });
  if (!prep.reused) {
    for (const t of prep.targets) await putObject(t.key, bytes, "application/pdf");
    await confirmUpload(db, userId, prep.uploadId);
  }
  for (let i = 0; i < 10 && (await processQueue(db, { budgetMs: 60_000 })).ran; i++);
  return prep.uploadId;
}

const ownIds = async (uploadId: string) => (await db.select({ id: questions.id }).from(questions).where(eq(questions.sourceUploadId, uploadId))).map((q) => q.id);

describe("shared course banks (Milestone 4 acceptance)", () => {
  let uploadId: string;
  let bankId: string;

  it("a contributed upload becomes a shared bank on the course", async () => {
    const ada = await student("ada");
    uploadId = await upload(ada, pdf, true);
    const [bank] = await db.select().from(banks).where(eq(banks.uploadId, uploadId));
    expect(bank).toMatchObject({ ownerId: ada, isShared: true, courseId: GST, title: "Week 3 notes" });
    expect(bank.questionIds.length).toBeGreaterThan(10);
    bankId = bank.id;
  });

  it("a second student on the same school + course sees it and practises its questions", async () => {
    const bisi = await student("bisi");
    const list = await courseBanksView(db, bisi, GST);
    const theirs = list.find((b) => b.id === bankId);
    expect(theirs).toMatchObject({ mine: false, isShared: true, verified: false });
    expect(list[0].verified).toBe(true); // the seeded sample paper stays on top

    const attempt = await startAttempt(db, bisi, { mode: "mock", courseId: GST, config: { count: 100, timeLimitSec: null, topicIds: [], difficulty: "mixed", bankId, uploadId: null } });
    const fromAda = new Set(await ownIds(uploadId));
    expect(attempt.snapshot.length).toBe(theirs!.questions);
    expect(attempt.snapshot.every((q) => fromAda.has(q.id))).toBe(true);
    await syncAttempt(db, bisi, { attemptId: attempt.id, currentIndex: 0, answers: [], submit: true });

    // "Build my own" draws from the class bank too.
    const pool = await selectQuestions(db, { userId: bisi, courseId: GST, topicIds: [], difficulty: "mixed", count: 500, seed: "x" });
    expect(pool.some((q) => fromAda.has(q.id))).toBe(true);
    expect((await classBank(db, GST)).questions).toBe(fromAda.size);
    expect((await courseBanksView(db, bisi, GST)).find((b) => b.id === bankId)?.students).toBe(1);
  });

  it("a student at another school with the same course code doesn't", async () => {
    const yct = await student("yct-student", "crs-gst111-yct", "sch-yabatech");
    expect(await courseBanksView(db, yct, "crs-gst111-yct")).toEqual([]);
    const pool = await selectQuestions(db, { userId: yct, courseId: "crs-gst111-yct", topicIds: [], difficulty: "mixed", count: 500, seed: "x" });
    expect(pool).toEqual([]);
  });

  it("ratings: only after taking the bank, never your own, averaged", async () => {
    await expect(rateBank(db, "ada", bankId, 5)).rejects.toThrow(/own|Finish/);
    await expect(rateBank(db, "yct-student", bankId, 5)).rejects.toThrow(/Finish/);
    expect(await rateBank(db, "bisi", bankId, 4)).toEqual({ rating: 4, count: 1 });
    expect(await rateBank(db, "bisi", bankId, 2)).toEqual({ rating: 2, count: 1 }); // changing your mind replaces it
  });

  it("turning the contribute toggle off takes the questions and the bank back", async () => {
    await setUploadSharing(db, "ada", uploadId, false);
    expect((await courseBanksView(db, "bisi", GST)).some((b) => b.id === bankId)).toBe(false);
    expect((await courseBanksView(db, "ada", GST)).find((b) => b.id === bankId)).toMatchObject({ mine: true, isShared: false });
    const pool = await selectQuestions(db, { userId: "bisi", courseId: GST, topicIds: [], difficulty: "mixed", count: 500, seed: "x" });
    const fromAda = new Set(await ownIds(uploadId));
    expect(pool.some((q) => fromAda.has(q.id))).toBe(false);
    await setUploadSharing(db, "ada", uploadId, true);
    expect(await setUploadSharing(db, "bisi", uploadId, false)).toBe(false); // not theirs
  });

  it("a private upload never reaches classmates", async () => {
    const chidi = await student("chidi");
    const id = await upload(chidi, new Uint8Array([...pdf, 1]), false);
    const [bank] = await db.select().from(banks).where(eq(banks.uploadId, id));
    expect(bank.isShared).toBe(false);
    expect((await courseBanksView(db, "bisi", GST)).some((b) => b.id === bank.id)).toBe(false);
  });
});

describe("reporting", () => {
  it("three reports hide a question pending review; an admin restores or removes it", async () => {
    const [q] = await db.select({ id: questions.id }).from(questions).where(and(eq(questions.courseId, GST), eq(questions.status, "active"))).limit(1);
    for (const id of ["r1", "r2"]) await student(id);
    expect(await reportQuestion(db, "r1", { questionId: q.id, reason: "wrong_answer", note: "Answer should be B" })).toEqual({ hidden: false, already: false });
    expect(await reportQuestion(db, "r1", { questionId: q.id, reason: "off_topic" })).toEqual({ hidden: false, already: true });
    await reportQuestion(db, "r2", { questionId: q.id, reason: "wrong_answer" });
    expect(await reportQuestion(db, "bisi", { questionId: q.id, reason: "copied" })).toEqual({ hidden: true, already: false });
    const [hidden] = await db.select().from(questions).where(eq(questions.id, q.id));
    expect(hidden).toMatchObject({ status: "reported", reports: 3 });
    const pool = await selectQuestions(db, { userId: "bisi", courseId: GST, topicIds: [], difficulty: "mixed", count: 1000, seed: "y" });
    expect(pool.some((x) => x.id === q.id)).toBe(false);

    const [item] = await openReports(db);
    expect(item).toMatchObject({ questionId: q.id, status: "reported", total: 3, notes: ["Answer should be B"] });
    expect(item.reasons[0]).toEqual({ reason: "wrong_answer", count: 2 });

    await resolveReports(db, q.id, "restore");
    expect((await db.select().from(questions).where(eq(questions.id, q.id)))[0].status).toBe("active");
    expect(await openReports(db)).toEqual([]);
    // Old (resolved) reports don't count towards hiding it again.
    await reportQuestion(db, "chidi", { questionId: q.id, reason: "inappropriate" });
    expect((await db.select().from(questions).where(eq(questions.id, q.id)))[0].status).toBe("active");
    await resolveReports(db, q.id, "remove");
    expect((await db.select().from(questions).where(eq(questions.id, q.id)))[0].status).toBe("hidden");
  });
});

describe("study plan and readiness", () => {
  const topic = (id: string, questions: number, mastery: number | null): CourseTopic => ({
    id,
    name: `Topic ${id}`,
    questions,
    mastery,
    label: mastery === null ? null : mastery < 0.34 ? "weak" : mastery < 0.6 ? "shaky" : mastery < 1 ? "good" : "mastered",
  });
  const none = { answeredByTopic: new Map<string, number>(), mocksDone: 0 };

  it("readiness weighs topics by bank size (capped) and counts untried topics as 0", () => {
    expect(readiness([])).toBeNull();
    expect(readiness([topic("a", 10, null)])).toBeNull(); // nothing practised yet
    expect(readiness([topic("a", 10, 1), topic("b", 10, null)])).toBe(0.5);
    expect(readiness([topic("a", 300, 1), topic("b", 30, 0)])).toBe(0.5); // capped at 30 each
    expect(readiness([topic("a", 2, 0), topic("b", 10, 0.8)])).toBe(0.8); // tiny topics ignored
  });

  it("free gets the two most useful items; Pro gets the full plan and the week ahead", () => {
    const topics = [topic("a", 30, 0.2), topic("b", 30, 0.5), topic("c", 30, null), topic("d", 30, 1)];
    const now = new Date("2026-10-16T10:00:00Z");
    const free = dailyPlan({ topics, examDate: "2026-10-20", tier: "basic", activity: none, now });
    expect(free.daysLeft).toBe(4);
    expect(free.items.map((i) => i.label)).toEqual(["20 questions on Topic a", "Timed mock · 30 questions"]);
    expect(free.lockedItems).toBe(2);
    const pro = dailyPlan({ topics, examDate: "2026-10-20", tier: "full", activity: none, now });
    expect(pro.items.map((i) => i.id)).toEqual(["practice:a", "mock", "practice:b", "new_topic:c"]);
    expect(pro.week.map((w) => w.date)).toEqual(["2026-10-17", "2026-10-18", "2026-10-19", "2026-10-20"]);
    expect(pro.week.at(-1)!.label).toMatch(/Exam day/);
    expect(pro.week.at(-2)!.label).toMatch(/Full 30-question mock/);
    // Far from the exam: lighter days.
    expect(dailyPlan({ topics, examDate: "2026-12-20", tier: "basic", activity: none, now }).items[0].count).toBe(10);
    expect(dailyPlan({ topics, examDate: null, tier: "basic", activity: none, now }).items[1].label).toBe("Timed mock · 20 questions");
  });

  it("ticks items off from today's activity", () => {
    const topics = [topic("a", 30, 0.2), topic("b", 30, 0.5)];
    const plan = dailyPlan({ topics, examDate: "2026-10-20", tier: "full", activity: { answeredByTopic: new Map([["a", 20], ["b", 5]]), mocksDone: 0 }, now: new Date("2026-10-16T10:00:00Z") });
    expect(plan.items.map((i) => [i.id, i.done])).toEqual([["practice:a", true], ["mock", false], ["practice:b", false]]);
    expect(plan.doneCount).toBe(1);
    expect(plan.next?.id).toBe("mock");
    expect(plan.items[2]).toMatchObject({ count: 15, progress: 5 / 15 });
  });

  it("no questions yet: the plan says upload or pick a bank", () => {
    expect(dailyPlan({ topics: [topic("a", 1, null)], examDate: null, tier: "full", activity: none }).items[0].kind).toBe("upload");
  });

  it("counts days in Lagos time", () => {
    expect(daysUntilExam("2026-10-17", new Date("2026-10-16T22:59:00Z"))).toBe(1);
    expect(daysUntilExam("2026-10-17", new Date("2026-10-16T23:01:00Z"))).toBe(0); // already the 17th in Lagos
    expect(examCountdown("2026-10-17", new Date("2026-10-16T12:00:00Z"))).toBe("Exam tomorrow");
    expect(examCountdown("2026-10-10", new Date("2026-10-16T12:00:00Z"))).toBeNull();
  });

  it("tracks readiness by day and reports the change over the week", async () => {
    const day = (n: number) => new Date(Date.UTC(2026, 9, 10 + n, 12));
    expect(await trackReadiness(db, "bisi", GST, 0.4, day(0))).toBeNull();
    await trackReadiness(db, "bisi", GST, 0.45, day(0)); // same day: replaced
    await trackReadiness(db, "bisi", GST, 0.5, day(3));
    expect(await trackReadiness(db, "bisi", GST, 0.61, day(6))).toBe(16); // vs day 0 (0.45)
  });

  it("read next points at the student's own notes only", async () => {
    const adaTopics = await db.select({ topicId: questions.topicId }).from(questions).innerJoin(banks, eq(banks.ownerId, "ada")).where(eq(questions.courseId, GST)).limit(1);
    const ids = [adaTopics[0].topicId!];
    const mine = await readNext(db, "ada", GST, ids);
    expect(mine.length).toBeGreaterThan(0);
    expect(mine[0]).toMatchObject({ title: "Week 3 notes" });
    expect(mine[0].label).toMatch(/^p\.\d/);
    expect(mine[0].page).toBeGreaterThan(0);
    expect(await readNext(db, "bisi", GST, ids)).toEqual([]);
  });
});
