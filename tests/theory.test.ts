import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { createHash } from "node:crypto";
import { beforeAll, describe, expect, it } from "vitest";
import { and, eq } from "drizzle-orm";
import { createPgliteDb, type Db } from "@/db";
import { enrollments, questions, theoryAttempts, users } from "@/db/schema";
import { seed } from "@/db/seed";
import { setAiProvidersForTests } from "@/lib/ai";
import { fakeProvider } from "@/lib/ai/fake";
import { selectQuestions } from "@/lib/exam-engine/service";
import { putObject } from "@/lib/storage";
import { ensureRubric, gradeAnswer, nextTheoryQuestion, TheoryError, theoryQuestions } from "@/lib/theory";
import { verdictFor } from "@/lib/theory-copy";
import { confirmUpload, prepareUpload, processQueue } from "@/lib/uploads";
import { makeNotesPdf } from "./fixtures/notes";

const NOW = new Date("2026-10-16T18:05:00Z");
const GST = "crs-gst111";
let db: Db;
const free = (id: string) => ({ id, effectivePlan: "free" as const });

beforeAll(async () => {
  process.env.LOCAL_STORAGE_DIR = await mkdtemp(path.join(tmpdir(), "sono-theory-"));
  db = await createPgliteDb();
  await seed(db, NOW);
  setAiProvidersForTests([fakeProvider("fake")]);
  for (const id of ["writer", "uploader"]) {
    await db.insert(users).values({ id, name: "S", email: `${id}@example.com`, schoolId: "sch-unilag", onboardedAt: NOW });
    await db.insert(enrollments).values({ userId: id, courseId: GST });
  }
});

describe("theory grading", () => {
  it("seeded courses have theory questions with stored marking guides, kept out of mocks", async () => {
    const list = await theoryQuestions(db, "writer", GST);
    expect(list.length).toBe(2);
    expect(list.every((q) => q.rubric && q.rubric.length >= 3)).toBe(true);
    expect(list.find((q) => q.topic === "Listening skills")?.marks).toBe(10);
    const pool = await selectQuestions(db, { userId: "writer", courseId: GST, topicIds: [], difficulty: "mixed", count: 1000, seed: "s" });
    expect(pool.some((q) => list.some((t) => t.id === q.id))).toBe(false);
  });

  it("scores against the guide: points covered, points missed, one tip", async () => {
    const q = (await theoryQuestions(db, "writer", GST)).find((x) => x.topic === "Listening skills")!;
    const strong = await gradeAnswer(
      db,
      free("writer"),
      q.id,
      "Hearing is the passive, physical reception of sound by the ear. Listening is active: attending to, interpreting and responding to the message. A good listener gives feedback and asks questions to check understanding, avoids interrupting and shuts out distractions to concentrate on the speaker, and takes notes or summarises the main points.",
      NOW,
    );
    expect(strong.maxScore).toBe(10);
    expect(strong.score).toBeGreaterThanOrEqual(8);
    expect(strong.feedback.covered.length).toBeGreaterThanOrEqual(4);

    const thin = await gradeAnswer(db, free("writer"), q.id, "Hearing is when sound enters your ears. Listening is when you pay attention to the lecturer.", NOW);
    expect(thin.score).toBeLessThan(strong.score);
    expect(thin.feedback.missed.length).toBeGreaterThan(0);
    expect(thin.feedback.tip).toMatch(/Add a point on/);
    expect(thin.feedback.verdict).toBe(verdictFor(thin.score, thin.maxScore));

    const saved = await db.select().from(theoryAttempts).where(eq(theoryAttempts.userId, "writer"));
    expect(saved).toHaveLength(2);
  });

  it("refuses one-liners and stops at the free plan's 3 gradings a day", async () => {
    const q = (await theoryQuestions(db, "writer", GST))[1];
    await expect(gradeAnswer(db, free("writer"), q.id, "Concord means agreement.", NOW)).rejects.toBeInstanceOf(TheoryError);
    await gradeAnswer(db, free("writer"), q.id, "Subject-verb concord means the verb agrees with its subject in number, for example the student writes.", NOW);
    await expect(gradeAnswer(db, free("writer"), q.id, "A verb agrees with its subject in number; collective nouns take a singular verb when acting as one.", NOW)).rejects.toThrow(/3 theory gradings/);
    // A new Lagos day resets it.
    await gradeAnswer(db, free("writer"), q.id, "A verb agrees with its subject in number; collective nouns take a singular verb when acting as one.", new Date(NOW.getTime() + 864e5));
  });

  it("makes a marking guide once for a question without one, and stores it", async () => {
    const [q] = await db
      .insert(questions)
      .values({ courseId: GST, type: "theory", stem: "Discuss the causes of semantic noise in a lecture hall.", options: [], answer: { kind: "theory", modelAnswer: "" }, visibility: "shared" })
      .returning();
    const rubric = await ensureRubric(db, q.id);
    expect(rubric.length).toBeGreaterThanOrEqual(2);
    const [stored] = await db.select().from(questions).where(eq(questions.id, q.id));
    expect(stored.rubric).toEqual(rubric);
    expect(await ensureRubric(db, q.id)).toEqual(rubric); // not regenerated
  });

  it("uploads add theory questions with their own guide; Next question walks the list", async () => {
    const pdf = await makeNotesPdf(6);
    const hash = createHash("sha256").update(pdf).digest("hex");
    const prep = await prepareUpload(db, "uploader", { courseId: GST, contribute: false, files: [{ name: "Week 4.pdf", type: "application/pdf", size: pdf.byteLength, hash }] });
    if (prep.reused) throw new Error("expected a new upload");
    await putObject(prep.targets[0].key, pdf, "application/pdf");
    await confirmUpload(db, "uploader", prep.uploadId);
    for (let i = 0; i < 10 && (await processQueue(db, { budgetMs: 60_000 })).ran; i++);
    const made = await db.select().from(questions).where(and(eq(questions.sourceUploadId, prep.uploadId), eq(questions.type, "theory")));
    expect(made.length).toBeGreaterThan(0);
    expect(made[0]).toMatchObject({ visibility: "private", answer: { kind: "theory" } });
    expect(made[0].rubric!.length).toBeGreaterThanOrEqual(2);
    // Private upload: only the uploader sees its theory questions.
    expect((await theoryQuestions(db, "uploader", GST)).some((t) => t.id === made[0].id)).toBe(true);
    expect((await theoryQuestions(db, "writer", GST)).some((t) => t.id === made[0].id)).toBe(false);
    const list = await theoryQuestions(db, "uploader", GST);
    expect(await nextTheoryQuestion(db, "uploader", GST, list[0].id)).toBe(list[1].id);
  });
});
