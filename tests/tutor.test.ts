import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { createHash } from "node:crypto";
import { afterEach, beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { createPgliteDb, type Db } from "@/db";
import { enrollments, tutorMessages, users } from "@/db/schema";
import { seed } from "@/db/seed";
import { setAiProvidersForTests, type AiProvider } from "@/lib/ai";
import { fakeProvider } from "@/lib/ai/fake";
import { startAttempt } from "@/lib/exam-engine/service";
import { putObject } from "@/lib/storage";
import { askTutor, isExamInProgressRequest, retrieve, splitPages, tutorSources, TutorError } from "@/lib/tutor";
import { confirmUpload, prepareUpload, processQueue } from "@/lib/uploads";
import { makeTutorPdf } from "./fixtures/notes";

const NOW = new Date("2026-10-16T18:05:00Z");
const GST = "crs-gst111";
let db: Db;
const sha = (b: Uint8Array) => createHash("sha256").update(b).digest("hex");
const free = (id: string) => ({ id, effectivePlan: "free" as const });

beforeAll(async () => {
  process.env.LOCAL_STORAGE_DIR = await mkdtemp(path.join(tmpdir(), "sono-tutor-"));
  db = await createPgliteDb();
  await seed(db, NOW);
  setAiProvidersForTests([fakeProvider("fake")]);
  await student("tutee");
  await student("mate");
  const pdf = await makeTutorPdf();
  const prep = await prepareUpload(db, "tutee", { courseId: GST, contribute: true, files: [{ name: "Week 3 slides.pdf", type: "application/pdf", size: pdf.byteLength, hash: sha(pdf) }] });
  if (prep.reused) throw new Error("expected a fresh upload");
  await putObject(prep.targets[0].key, pdf, "application/pdf");
  await confirmUpload(db, "tutee", prep.uploadId);
  for (let i = 0; i < 10 && (await processQueue(db, { budgetMs: 60_000 })).ran; i++);
});
afterEach(() => setAiProvidersForTests([fakeProvider("fake")]));

async function student(id: string) {
  await db.insert(users).values({ id, name: "S", email: `${id}@example.com`, schoolId: "sch-unilag", onboardedAt: NOW });
  await db.insert(enrollments).values({ userId: id, courseId: GST });
}

describe("tutor (Milestone 5 acceptance)", () => {
  it("answers from the notes and cites the right page", async () => {
    const r = await askTutor(db, free("tutee"), GST, { text: "What are the four stages of listening?" });
    expect(r.notInNotes).toBe(false);
    expect(r.content).toMatch(/receiving, understanding, evaluating and responding/);
    expect(r.citations.map((c) => c.label)).toEqual(["Week 3 slides · p.3"]);
    expect(r.citations[0]).toMatchObject({ page: 3, own: true });

    const s = await askTutor(db, free("tutee"), GST, { text: "What causes semantic noise?" });
    expect(s.citations[0].label).toBe("Week 3 slides · p.4");
    const c = await askTutor(db, free("tutee"), GST, { text: "What is subject-verb concord?" });
    expect(c.citations[0].label).toBe("Week 3 slides · p.5");
  });

  it("refuses to invent an answer the notes don't contain", async () => {
    const r = await askTutor(db, free("tutee"), GST, { text: "Who won the 2018 FIFA World Cup final?" });
    expect(r).toMatchObject({ notInNotes: true, citations: [] });
    expect(r.content).toMatch(/don't cover that, so I won't guess/);
  });

  it("treats an answer that cites none of the given passages as not in the notes", async () => {
    const inventive: AiProvider = {
      ...fakeProvider("inventive"),
      generate: async <T,>() => ({ answer: "France won it, 4–2.", citedChunkIds: ["made-up"], notInNotes: false }) as T,
    };
    setAiProvidersForTests([inventive]);
    const r = await askTutor(db, free("tutee"), GST, { text: "What are the stages of listening?" });
    expect(r).toMatchObject({ notInNotes: true, citations: [] });
    expect(r.content).not.toMatch(/France/);
  });

  it("quick actions follow up on the last answer, with citations", async () => {
    await askTutor(db, free("tutee"), GST, { text: "What is a thesis statement?" });
    const r = await askTutor(db, free("tutee"), GST, { action: "simpler" });
    expect(r.content).toMatch(/^Explain your last answer more simply/);
    expect(r.citations[0].label).toBe("Week 3 slides · p.6");
    const stored = await db.select().from(tutorMessages).where(eq(tutorMessages.userId, "tutee"));
    expect(stored.find((m) => m.content === "Explain simpler")?.role).toBe("user");
  });

  it("a classmate sees contributed notes, labelled as a classmate's (files stay private)", async () => {
    const r = await askTutor(db, free("mate"), GST, { text: "What is the difference between hearing and listening?" });
    expect(r.citations[0]).toMatchObject({ label: "Classmate's notes · p.2", own: false });
    expect(await tutorSources(db, "mate", GST)).toEqual({ own: 0, shared: 1 });
    expect(await tutorSources(db, "tutee", GST)).toEqual({ own: 1, shared: 0 });
  });

  it("declines to help with an exam in progress", async () => {
    expect(isExamInProgressRequest("I'm writing my GST exam right now, what is concord?")).toBe(true);
    expect(isExamInProgressRequest("Quiz me on concord for my exam next week")).toBe(false);
    const r = await askTutor(db, free("mate"), GST, { text: "I'm in the exam hall writing the test, quick: what is concord?" });
    expect(r).toMatchObject({ declined: true, citations: [] });

    await startAttempt(db, "mate", { mode: "mock", courseId: GST, config: { count: 5, timeLimitSec: 600, topicIds: [], difficulty: "mixed", bankId: null } });
    const during = await askTutor(db, free("mate"), GST, { text: "What is concord?" });
    expect(during.declined).toBe(true);
    expect(during.content).toMatch(/timed mock running/);
  });

  it("stops at the free plan's 10 messages a day", async () => {
    await student("chatty");
    for (let i = 0; i < 10; i++) await askTutor(db, free("chatty"), GST, { text: `What are the stages of listening? (${i})` });
    await expect(askTutor(db, free("chatty"), GST, { text: "One more about listening?" })).rejects.toBeInstanceOf(TutorError);
    // Pro gets 100.
    await askTutor(db, { id: "chatty", effectivePlan: "pro" }, GST, { text: "One more about listening stages?" });
  });

  it("falls back to word overlap when no embedding provider is available", async () => {
    const noEmbed: AiProvider = { ...fakeProvider("text-only"), embed: undefined };
    setAiProvidersForTests([noEmbed]);
    const passages = await retrieve(db, "tutee", GST, "collective nouns singular verb");
    expect(passages[0].label).toBe("Week 3 slides · p.5");
  });

  it("splits multi-page chunks back into pages", () => {
    expect(splitPages("[p.1]\nOne.\n\n[p.2]\nTwo.", "p.1–2", 1)).toEqual([
      { label: "p.1", page: 1, text: "One." },
      { label: "p.2", page: 2, text: "Two." },
    ]);
    expect(splitPages("Just one page.", "slide 4", 4)).toEqual([{ label: "slide 4", page: 4, text: "Just one page." }]);
  });
});
