import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { createHash } from "node:crypto";
import { afterEach, beforeAll, describe, expect, it } from "vitest";
import { and, count, eq, isNotNull } from "drizzle-orm";
import { createPgliteDb, type Db } from "@/db";
import { aiJobs, aiProviders, chunks, courses, enrollments, flashcards, questions, uploads, users } from "@/db/schema";
import { seed } from "@/db/seed";
import { AiError, setAiProvidersForTests, withAi, type AiProvider } from "@/lib/ai";
import { fakeProvider } from "@/lib/ai/fake";
import { claimJob, enqueue, RetryLater, settle } from "@/lib/jobs";
import { putObject } from "@/lib/storage";
import { getUsage } from "@/lib/usage";
import { confirmUpload, getUploadView, prepareUpload, processQueue, UploadError } from "@/lib/uploads";
import { z } from "zod";
import { makeNotesPdf } from "./fixtures/notes";

const NOW = new Date("2026-10-16T18:05:00Z");
let db: Db;
let courseId: string;
let pdf: Uint8Array;
const sha = (b: Uint8Array) => createHash("sha256").update(b).digest("hex");

beforeAll(async () => {
  process.env.LOCAL_STORAGE_DIR = await mkdtemp(path.join(tmpdir(), "sono-uploads-"));
  db = await createPgliteDb();
  await seed(db, NOW);
  courseId = (await db.select({ id: courses.id }).from(courses).where(eq(courses.code, "GST111")))[0].id;
  pdf = await makeNotesPdf(20);
});

afterEach(() => setAiProvidersForTests(null));

async function student(id: string, plan: "free" | "pro" = "free") {
  await db.insert(users).values({ id, name: "Test Student", email: `${id}@example.com`, ...(plan === "pro" ? { plan, proUntil: new Date(Date.now() + 864e5) } : {}) });
  await db.insert(enrollments).values({ userId: id, courseId });
  return id;
}

/** What the phone does: prepare → PUT to the signed URL → confirm. */
async function uploadPdf(userId: string, bytes: Uint8Array, contribute = true) {
  const prep = await prepareUpload(db, userId, { courseId, contribute, files: [{ name: "GST111 week 3 notes.pdf", type: "application/pdf", size: bytes.byteLength, hash: sha(bytes) }] });
  if (!prep.reused) {
    for (const t of prep.targets) await putObject(t.key, bytes, "application/pdf");
    await confirmUpload(db, userId, prep.uploadId);
  }
  return prep;
}

async function drain() {
  for (let i = 0; i < 10; i++) {
    const s = await processQueue(db, { budgetMs: 60_000 });
    if (!s.ran) break;
  }
}

describe("upload pipeline (offline provider)", () => {
  it("turns a 20-page PDF into 30+ questions and flashcards", async () => {
    const userId = await student("pipe-a", "pro");
    setAiProvidersForTests([fakeProvider("fake")]);
    const prep = await uploadPdf(userId, pdf);
    expect(prep.reused).toBe(false);
    await drain();

    const view = await getUploadView(db, userId, prep.uploadId);
    expect(view?.status).toBe("ready");
    expect(view?.pageCount).toBe(20);
    expect(view?.questionsMade).toBeGreaterThanOrEqual(30);
    expect(view?.flashcardsMade).toBeGreaterThan(0);
    expect(view?.topics.length).toBeGreaterThanOrEqual(3);
    expect(view?.topics.map((t) => t.name)).toContain("Barriers to communication");
    expect(view?.xpEarned).toBe(60);

    const qs = await db.select().from(questions).where(eq(questions.sourceUploadId, prep.uploadId));
    expect(qs.length).toBe(view?.questionsMade);
    expect(qs.every((q) => q.visibility === "shared" && q.explanation && q.sourceLabel?.startsWith("GST111 week 3 notes · p."))).toBe(true);
    const [{ n: cards }] = await db.select({ n: count() }).from(flashcards).where(eq(flashcards.sourceUploadId, prep.uploadId));
    expect(Number(cards)).toBe(view?.flashcardsMade);
    // Usage counted; embeddings written for the tutor.
    expect((await getUsage(db, userId, "ai_questions", "pro")).used).toBe(view?.questionsMade);
    const embedded = await db.select({ id: chunks.id }).from(chunks).where(and(eq(chunks.uploadId, prep.uploadId), isNotNull(chunks.embedding)));
    expect(embedded.length).toBe(view?.chunksTotal);
  });

  it("re-uploading the same file is instant and spends no AI", async () => {
    const userId = await student("pipe-b");
    let calls = 0;
    const counting = fakeProvider("fake");
    setAiProvidersForTests([{ ...counting, generate: (r) => (calls++, counting.generate(r)) }]);
    const prep = await uploadPdf(userId, pdf);
    expect(prep.reused).toBe(true);
    const view = await getUploadView(db, userId, prep.uploadId);
    expect(view?.status).toBe("ready");
    expect(view?.reused).toBe(true);
    expect(view?.linked).toBe(true); // same course, original shared: no copies needed
    expect(view?.questionsMade).toBeGreaterThanOrEqual(30);
    expect(view?.topics.length).toBeGreaterThanOrEqual(3);
    expect(calls).toBe(0);
    expect((await getUsage(db, userId, "ai_questions", "free")).used).toBe(0);
    expect((await getUsage(db, userId, "upload", "free")).used).toBe(1);
    const [{ n }] = await db.select({ n: count() }).from(chunks).where(eq(chunks.uploadId, prep.uploadId));
    expect(Number(n)).toBe(view?.chunksTotal);
  });

  it("caps free-plan generation at today's AI-question allowance", async () => {
    const userId = await student("pipe-c");
    setAiProvidersForTests([fakeProvider("fake")]);
    const other = await makeNotesPdf(12);
    const tweaked = new Uint8Array([...other, 10]); // different hash
    const prep = await uploadPdf(userId, tweaked);
    await drain();
    const view = await getUploadView(db, userId, prep.uploadId);
    expect(view?.status).toBe("ready");
    expect(view?.pagesUsed).toBe(12);
    expect(view?.questionsMade).toBeLessThanOrEqual(40);
    expect(view?.questionsMade).toBeGreaterThanOrEqual(30);
    expect((await getUsage(db, userId, "ai_questions", "free")).used).toBe(view?.questionsMade);
  });

  it("blocks a third upload on the free plan", async () => {
    const userId = await student("pipe-d");
    setAiProvidersForTests([fakeProvider("fake")]);
    for (let i = 0; i < 2; i++) {
      const b = new Uint8Array([...pdf, i]);
      await uploadPdf(userId, b, false);
    }
    await expect(uploadPdf(userId, new Uint8Array([...pdf, 9]))).rejects.toBeInstanceOf(UploadError);
  });

  it("marks a scanned (text-free) PDF as failed with advice", async () => {
    const userId = await student("pipe-e", "pro");
    setAiProvidersForTests([fakeProvider("fake")]);
    const { PDFDocument } = await import("pdf-lib");
    const doc = await PDFDocument.create();
    for (let i = 0; i < 3; i++) doc.addPage();
    const prep = await uploadPdf(userId, await doc.save());
    await drain();
    const view = await getUploadView(db, userId, prep.uploadId);
    expect(view?.status).toBe("failed");
    expect(view?.error).toMatch(/photos/);
  });
});

describe("provider fallback", () => {
  const limited = (name: string): AiProvider => ({
    name,
    vision: true,
    generate: async () => {
      throw new AiError("429", "limit", 120_000);
    },
  });

  it("switches to the next provider when one fails, and cools the failed one down", async () => {
    const used: string[] = [];
    const ok = fakeProvider("fake-backup");
    setAiProvidersForTests([limited("gemini"), { ...ok, generate: (r) => (used.push("fake-backup"), ok.generate(r)) }]);
    const now = new Date();
    const res = await withAi(db, "text", (p) => p.generate({ task: "flashcards", system: "", parts: [], schema: {}, parse: z.object({ flashcards: z.array(z.any()) }), context: { text: "Noise is any interference that distorts a message between the sender and receiver.", label: "p.1", count: 1 } }), now);
    expect(res.provider).toBe("fake-backup");
    const [g] = await db.select().from(aiProviders).where(eq(aiProviders.name, "gemini"));
    expect(g.cooldownUntil!.getTime()).toBe(now.getTime() + 120_000);

    // While cooling down, gemini is skipped without being called.
    let geminiCalls = 0;
    setAiProvidersForTests([{ ...limited("gemini"), generate: async () => (geminiCalls++, Promise.reject(new Error("x"))) }, ok]);
    const again = await withAi(db, "text", async (p) => p.name, new Date(now.getTime() + 60_000));
    expect(again.provider).toBe("fake-backup");
    expect(geminiCalls).toBe(0);
  });

  it("when every provider is cooling down, the job waits in the queue without using a retry", async () => {
    setAiProvidersForTests([limited("p1"), limited("p2")]);
    const now = new Date();
    await expect(withAi(db, "text", (p) => p.generate({ task: "flashcards", system: "", parts: [], schema: {}, parse: z.any() }), now)).rejects.toMatchObject({ kind: "cooldown" });

    const id = await enqueue(db, "embed_upload", { uploadId: "none" }, { runAfter: new Date(0) });
    const job = (await claimJob(db, new Date(), ["embed_upload"]))!;
    expect(job.id).toBe(id);
    const err = new AiError("resting", "cooldown", 90_000);
    expect(await settle(db, job, { ok: false, error: err }, now)).toBe("waiting");
    const [row] = await db.select().from(aiJobs).where(eq(aiJobs.id, id));
    expect(row.status).toBe("queued");
    expect(row.attempts).toBe(0);
    expect(row.runAfter.getTime()).toBe(now.getTime() + 90_000);
    expect(await settle(db, { ...job, attempts: 1 }, { ok: false, error: new RetryLater(1000) }, now)).toBe("waiting");
  });

  it("a fresh upload processes end to end on the backup when the first provider is out of quota", async () => {
    const userId = await student("pipe-f", "pro");
    setAiProvidersForTests([limited("gemini-down"), fakeProvider("fake-backup")]);
    const prep = await uploadPdf(userId, new Uint8Array([...pdf, 42]));
    await drain();
    const view = await getUploadView(db, userId, prep.uploadId);
    expect(view?.status).toBe("ready");
    expect(view?.questionsMade).toBeGreaterThanOrEqual(30);
    const providers = await db.select({ p: aiJobs.provider }).from(aiJobs).where(and(eq(aiJobs.type, "generate_chunk"), isNotNull(aiJobs.provider)));
    expect(providers.some((r) => r.p === "fake-backup")).toBe(true);
    expect(providers.some((r) => r.p === "gemini-down")).toBe(false);
  });
});

describe("upload rows", () => {
  it("keeps files private: the stored file URL is a storage key, never a public link", async () => {
    const rows = await db.select({ fileUrl: uploads.fileUrl }).from(uploads);
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.every((r) => r.fileUrl.startsWith("uploads/"))).toBe(true);
  });
});
