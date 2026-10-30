import { createHash } from "node:crypto";
import { and, asc, count, desc, eq, inArray, isNull, ne, sql } from "drizzle-orm";
import type { Db } from "@/db";
import { aiJobs, chunks, courses, enrollments, flashcards, questions, topics, uploads, users } from "@/db/schema";
import { toRow } from "@/db/question-bank";
import { ensureUploadBank } from "@/lib/banks";
import { ai, aiConfigured, AiError, nextProviderAt } from "@/lib/ai";
import { looksLikePastPaper, toBankQuestion, type GeneratedSet, type Photo } from "@/lib/ai/tasks";
import { effectivePlan } from "@/lib/billing";
import { displayCourseCode } from "@/lib/format";
import { chunkPages, flashcardTarget, questionTargets } from "@/lib/ingest/chunk";
import { extractDocument, ExtractError, tooLittleText, type Page } from "@/lib/ingest/extract";
import { headingOf, matchTopic, tidyTopic } from "@/lib/ingest/topics";
import { enqueue, jobsAhead, RetryLater, runJobs, type Handler, type Job, type JobType } from "@/lib/jobs";
import { MAX_PHOTOS, MAX_UPLOAD_BYTES, PLANS, UPLOAD_XP } from "@/lib/plans";
import { notifyUploadReady } from "@/lib/push";
import { isUploadMime, newObjectKey, readObject, signedPutUrl, storageMode, UPLOAD_TYPES, type SignedPut, type UploadMime } from "@/lib/storage";
import { getUsage, recordUsage } from "@/lib/usage";

/**
 * Upload → questions pipeline (build brief §2):
 * hash check → extract text (vision for photos) → chunk → detect topics →
 * generate questions, explanations and flashcards in batches → embed chunks.
 *
 *   ingest_upload    read the file(s), reuse an identical upload, chunk, plan the AI budget
 *   generate_chunk   one AI call per chunk: questions + flashcards (or a past paper transcribed)
 *   embed_upload     vectors for tutor retrieval (never blocks "ready")
 */

export type Upload = typeof uploads.$inferSelect;

export class UploadError extends Error {
  constructor(
    message: string,
    readonly code: "limit" | "invalid" | "not_found" | "not_ready" | "ai_limit" = "invalid",
  ) {
    super(message);
  }
}

export type FileMeta = { name: string; type: string; size: number; hash: string };

const HASH = /^[0-9a-f]{64}$/;

const sha256 = (data: Uint8Array | string) => createHash("sha256").update(data).digest("hex");

/** One file: its own hash. Photos: the hash of their hashes in order, so the same set of photos matches. */
export function combinedHash(hashes: string[]): string {
  return hashes.length === 1 ? hashes[0] : sha256(`photos:${hashes.join(",")}`);
}

export function titleFromName(name: string): string {
  const t = name
    .replace(/\.[a-z0-9]{2,5}$/i, "")
    .replace(/[_]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return (t || "Notes").slice(0, 80);
}

async function viewerPlan(db: Db, userId: string) {
  const [u] = await db.select({ proUntil: users.proUntil }).from(users).where(eq(users.id, userId));
  if (!u) throw new UploadError("Sign in again.", "not_found");
  return effectivePlan(u);
}

async function courseFor(db: Db, userId: string, courseId: string) {
  const [c] = await db
    .select({ id: courses.id, code: courses.code, title: courses.title })
    .from(courses)
    .innerJoin(enrollments, and(eq(enrollments.courseId, courses.id), eq(enrollments.userId, userId)))
    .where(eq(courses.id, courseId));
  if (!c) throw new UploadError("Add this course first.", "not_found");
  return c;
}

/** A finished upload of the same file, followed back to the original. */
async function findReusable(db: Db, hash: string, excludeId?: string): Promise<Upload | null> {
  const rows = await db
    .select()
    .from(uploads)
    .where(and(eq(uploads.fileHash, hash), eq(uploads.status, "ready"), isNull(uploads.reusedFromId), excludeId ? ne(uploads.id, excludeId) : undefined))
    .orderBy(desc(uploads.completedAt))
    .limit(1);
  return rows[0] ?? null;
}

export type PrepareResult = { uploadId: string; reused: true } | { uploadId: string; reused: false; targets: SignedPut[] };

/**
 * Step 1 (before any bytes move): check limits, then either reuse an identical
 * finished upload instantly or hand back short-lived signed URLs for the files.
 */
export async function prepareUpload(
  db: Db,
  userId: string,
  input: { courseId: string; files: FileMeta[]; contribute: boolean },
  now = new Date(),
): Promise<PrepareResult> {
  const course = await courseFor(db, userId, input.courseId);
  const plan = await viewerPlan(db, userId);
  const files = input.files;
  if (!files.length) throw new UploadError("Pick a file or take a photo first.");
  if (files.some((f) => !isUploadMime(f.type))) throw new UploadError("Use a PDF, PowerPoint (.pptx), Word (.docx) file or photos.");
  if (files.some((f) => !HASH.test(f.hash))) throw new UploadError("That file couldn't be read on your phone. Try again.");
  const photos = files.every((f) => UPLOAD_TYPES[f.type as UploadMime].kind === "photo");
  if (!photos && files.length > 1) throw new UploadError("Upload one document at a time (or several photos).");
  const maxPhotos = Math.min(MAX_PHOTOS, PLANS[plan].pagesPerUpload);
  if (photos && files.length > maxPhotos) throw new UploadError(`Up to ${maxPhotos} photos per upload on your plan.`);
  const size = files.reduce((s, f) => s + f.size, 0);
  if (size > MAX_UPLOAD_BYTES) throw new UploadError(`Keep uploads under ${MAX_UPLOAD_BYTES / 1024 / 1024} MB.`);

  const uploadsLeft = await getUsage(db, userId, "upload", plan, now);
  if (uploadsLeft.remaining <= 0) throw new UploadError(`You've used today's ${uploadsLeft.limit} uploads.`, "limit");

  const fileHash = combinedHash(files.map((f) => f.hash));
  const kind = photos ? "photos" : UPLOAD_TYPES[files[0].type as UploadMime].kind;
  const title = photos ? `${files.length} photo${files.length === 1 ? "" : "s"}` : titleFromName(files[0].name);
  const visibility = input.contribute ? ("contribute" as const) : ("private" as const);

  // Same file already turned into questions (by anyone): reuse it, no AI and no upload needed.
  const source = await findReusable(db, fileHash);
  if (source) {
    const [row] = await db
      .insert(uploads)
      .values({ userId, courseId: course.id, fileUrl: source.fileUrl, fileKeys: source.fileKeys, fileHash, type: kind, title, sizeBytes: size, visibility })
      .returning();
    await recordUsage(db, userId, "upload", 1, now);
    await reuseInto(db, row, source, now);
    return { uploadId: row.id, reused: true };
  }

  if (!aiConfigured()) throw new UploadError("Making questions isn't switched on yet. Practise a shared bank for now.");
  if (storageMode() === "none") throw new UploadError("Uploads aren't switched on yet. Practise a shared bank for now.");
  const aiLeft = await getUsage(db, userId, "ai_questions", plan, now);
  if (aiLeft.remaining <= 0) throw new UploadError(`You've used today's ${aiLeft.limit} AI questions.`, "ai_limit");

  const keys = files.map((f) => newObjectKey(userId, f.type as UploadMime));
  const [row] = await db
    .insert(uploads)
    .values({ userId, courseId: course.id, fileUrl: keys[0], fileKeys: keys, fileHash, type: kind, title, sizeBytes: size, visibility, statusLine: "Uploading" })
    .returning({ id: uploads.id });
  const targets = await Promise.all(keys.map((k, i) => signedPutUrl(k, files[i].type)));
  return { uploadId: row.id, reused: false, targets };
}

/** Step 2: the phone finished uploading. Count the upload and queue the work. */
export async function confirmUpload(db: Db, userId: string, uploadId: string, now = new Date()): Promise<void> {
  const [u] = await db.select().from(uploads).where(and(eq(uploads.id, uploadId), eq(uploads.userId, userId)));
  if (!u) throw new UploadError("Upload not found.", "not_found");
  if (u.status !== "queued" || u.statusLine !== "Uploading") return; // already confirmed
  const plan = await viewerPlan(db, userId);
  const left = await getUsage(db, userId, "upload", plan, now);
  if (left.remaining <= 0) throw new UploadError(`You've used today's ${left.limit} uploads.`, "limit");
  await recordUsage(db, userId, "upload", 1, now);
  await db.update(uploads).set({ statusLine: "Waiting for a free slot" }).where(eq(uploads.id, uploadId));
  await enqueue(db, "ingest_upload", { uploadId }, { userId, priority: PLANS[plan].queuePriority });
}

// ── Reuse ────────────────────────────────────────────────────────────────────

/**
 * Same file seen before. Its chunks (with embeddings) are copied for the tutor.
 * Questions: if the original was shared on this same course they are already in
 * the student's bank, so nothing is copied; otherwise they are copied in.
 */
export function linksToSource(target: Pick<Upload, "courseId">, source: Pick<Upload, "courseId" | "visibility">) {
  return source.courseId === target.courseId && source.visibility === "contribute";
}

export async function reuseInto(db: Db, target: Upload, source: Upload, now = new Date()) {
  const srcChunks = await db.select().from(chunks).where(eq(chunks.uploadId, source.id)).orderBy(asc(chunks.position));
  if (srcChunks.length) {
    await db.insert(chunks).values(
      srcChunks.map((c) => ({
        uploadId: target.id,
        position: c.position,
        text: c.text,
        page: c.page,
        pageEnd: c.pageEnd,
        label: c.label,
        topic: c.topic,
        questionTarget: 0,
        generatedAt: c.generatedAt ?? now,
        embedding: c.embedding,
      })),
    );
  }
  let questionsMade = source.questionsMade;
  let flashcardsMade = source.flashcardsMade;
  if (!linksToSource(target, source)) {
    const visibility = target.visibility === "contribute" ? ("shared" as const) : ("private" as const);
    const topicIdFor = await topicResolver(db, target.courseId);
    const srcQuestions = await db
      .select({ q: questions, topic: topics.name })
      .from(questions)
      .leftJoin(topics, eq(topics.id, questions.topicId))
      .where(and(eq(questions.sourceUploadId, source.id), eq(questions.status, "active")));
    const qRows: (typeof questions.$inferInsert)[] = [];
    for (const { q, topic } of srcQuestions) {
      qRows.push({
        courseId: target.courseId,
        topicId: await topicIdFor(topic ?? "General"),
        sourceUploadId: target.id,
        type: q.type,
        stem: q.stem,
        options: q.options,
        answer: q.answer,
        explanation: q.explanation,
        rubric: q.rubric,
        sourceLabel: q.sourceLabel?.replace(/^.*? · /, `${target.title} · `) ?? null,
        difficulty: q.difficulty,
        isPastQuestion: q.isPastQuestion,
        visibility,
      });
    }
    if (qRows.length) await db.insert(questions).values(qRows);
    const srcCards = await db
      .select({ f: flashcards, topic: topics.name })
      .from(flashcards)
      .leftJoin(topics, eq(topics.id, flashcards.topicId))
      .where(eq(flashcards.sourceUploadId, source.id));
    const fRows: (typeof flashcards.$inferInsert)[] = [];
    for (const { f, topic } of srcCards) {
      fRows.push({ courseId: target.courseId, topicId: await topicIdFor(topic ?? "General"), front: f.front, back: f.back, sourceUploadId: target.id, sourceLabel: f.sourceLabel, visibility });
    }
    if (fRows.length) await db.insert(flashcards).values(fRows);
    questionsMade = qRows.length;
    flashcardsMade = fRows.length;
  }
  await db
    .update(uploads)
    .set({
      status: "ready",
      statusLine: null,
      error: null,
      reusedFromId: source.id,
      pageCount: source.pageCount,
      pagesUsed: source.pagesUsed,
      chunksTotal: srcChunks.length,
      chunksDone: srcChunks.length,
      questionsMade,
      flashcardsMade,
      isPastPaper: source.isPastPaper,
      completedAt: now,
    })
    .where(eq(uploads.id, target.id));
  if (!linksToSource(target, source)) await ensureUploadBank(db, target.id);
}

/** Finds or creates the course topic a generated topic name belongs to (merging near-duplicates). */
async function topicResolver(db: Db, courseId: string) {
  const known = await db.select({ id: topics.id, name: topics.name }).from(topics).where(eq(topics.courseId, courseId));
  return async (raw: string): Promise<string> => {
    const name = tidyTopic(raw) || "General";
    const hit = matchTopic(name, known);
    if (hit) return hit.id;
    const [row] = await db.insert(topics).values({ courseId, name }).returning({ id: topics.id, name: topics.name });
    known.push(row);
    return row.id;
  };
}

// ── Jobs ─────────────────────────────────────────────────────────────────────

type UploadPayload = { uploadId: string };
type ChunkPayload = { uploadId: string; chunkId: string };

async function loadUpload(db: Db, id: string) {
  const [row] = await db
    .select({ u: uploads, code: courses.code, courseTitle: courses.title })
    .from(uploads)
    .innerJoin(courses, eq(courses.id, uploads.courseId))
    .where(eq(uploads.id, id));
  return row ?? null;
}

async function fail(db: Db, uploadId: string, message: string) {
  await db.update(uploads).set({ status: "failed", error: message, statusLine: null, completedAt: new Date() }).where(eq(uploads.id, uploadId));
}

const PHOTO_BATCH = 4;

async function readPhotos(db: Db, keys: string[], course: { code: string; title: string }, onProgress: (done: number) => Promise<void>) {
  const pages: Page[] = [];
  let pastPaper = false;
  for (let i = 0; i < keys.length; i += PHOTO_BATCH) {
    const batch: Photo[] = [];
    for (const key of keys.slice(i, i + PHOTO_BATCH)) {
      const bytes = await readObject(key);
      if (!bytes) throw new ExtractError("One of your photos didn't finish uploading. Try again.");
      const ext = key.split(".").pop();
      batch.push({ mimeType: ext === "png" ? "image/png" : ext === "webp" ? "image/webp" : "image/jpeg", base64: Buffer.from(bytes).toString("base64") });
    }
    const { value } = await ai.readImage(db, { course, photos: batch });
    if (value.kind === "past_paper") pastPaper = true;
    value.pages.forEach((p, j) => pages.push({ n: i + j + 1, label: `photo ${i + j + 1}`, text: p.text }));
    await onProgress(Math.min(keys.length, i + PHOTO_BATCH));
  }
  return { pages, pastPaper };
}

export const ingestUpload: Handler = async (db, job) => {
  const { uploadId } = job.payload as UploadPayload;
  const row = await loadUpload(db, uploadId);
  if (!row || (row.u.status !== "queued" && row.u.status !== "extracting")) return;
  const { u } = row;
  const course = { code: displayCourseCode(row.code), title: row.courseTitle };
  await db.update(uploads).set({ status: "extracting", statusLine: "Reading your notes" }).where(eq(uploads.id, u.id));

  try {
    // Hash check on the server (the phone's hash was only used to skip uploading).
    const files: Uint8Array[] = [];
    if (u.type !== "photos") {
      const bytes = await readObject(u.fileKeys[0] ?? u.fileUrl);
      if (!bytes) throw new ExtractError("Your file didn't finish uploading. Try again.");
      files.push(bytes);
    }
    const serverHash = u.type === "photos" ? combinedHash(await Promise.all(u.fileKeys.map(async (k) => sha256((await readObject(k)) ?? new Uint8Array())))) : sha256(files[0]);
    if (serverHash !== u.fileHash) await db.update(uploads).set({ fileHash: serverHash }).where(eq(uploads.id, u.id));

    const source = await findReusable(db, serverHash, u.id);
    if (source) {
      await reuseInto(db, { ...u, fileHash: serverHash }, source);
      return;
    }
    // The same file is being processed for someone who uploaded it first: wait for theirs.
    const [inFlight] = await db
      .select({ id: uploads.id })
      .from(uploads)
      .where(and(eq(uploads.fileHash, serverHash), inArray(uploads.status, ["extracting", "generating"]), ne(uploads.id, u.id), sql`${uploads.createdAt} < ${u.createdAt.toISOString()}`))
      .limit(1);
    if (inFlight) {
      await db.update(uploads).set({ status: "queued", statusLine: "A classmate is uploading the same file. Using theirs…" }).where(eq(uploads.id, u.id));
      throw new RetryLater(15_000, "same file in progress");
    }

    const plan = await viewerPlan(db, u.userId);
    const maxPages = PLANS[plan].pagesPerUpload;
    let pages: Page[];
    let pageCount: number;
    let pastPaper = false;
    if (u.type === "photos") {
      const read = await readPhotos(db, u.fileKeys.slice(0, maxPages), course, (done) =>
        db.update(uploads).set({ statusLine: `Read ${done} of ${u.fileKeys.length} photos` }).where(eq(uploads.id, u.id)).then(() => {}),
      );
      pages = read.pages;
      pageCount = u.fileKeys.length;
      pastPaper = read.pastPaper;
    } else {
      const extracted = await extractDocument(files[0], u.type as "pdf" | "pptx" | "docx", maxPages);
      pages = extracted.pages;
      pageCount = extracted.pageCount;
      if (tooLittleText(pages)) {
        throw new ExtractError(
          u.type === "pdf"
            ? "This PDF looks like scanned pictures, so there's no text to read. Take photos of the pages instead."
            : "We couldn't find enough text in this file. Try photos of the pages instead.",
        );
      }
    }
    const text = pages.map((p) => p.text).join("\n");
    if (!pastPaper) pastPaper = looksLikePastPaper(text);

    const parts = chunkPages(pages);
    if (!parts.length) throw new ExtractError("We couldn't find any readable text. Try clearer photos or another file.");
    const allowance = await getUsage(db, u.userId, "ai_questions", plan);
    const targets = questionTargets(parts, allowance.remaining);
    const inserted = await db
      .insert(chunks)
      .values(parts.map((c, i) => ({ uploadId: u.id, position: c.position, text: c.text, page: c.page, pageEnd: c.pageEnd, label: c.label, questionTarget: targets[i] })))
      .returning({ id: chunks.id, position: chunks.position });
    await db
      .update(uploads)
      .set({
        status: "generating",
        statusLine: pastPaper ? "Copying out the past questions" : "Making questions",
        pageCount,
        pagesUsed: pages.length,
        chunksTotal: inserted.length,
        chunksDone: 0,
        questionBudget: targets.reduce((s, n) => s + n, 0),
        isPastPaper: pastPaper,
      })
      .where(eq(uploads.id, u.id));
    for (const c of inserted.sort((a, b) => a.position - b.position)) {
      await enqueue(db, "generate_chunk", { uploadId: u.id, chunkId: c.id }, { userId: u.userId, priority: job.priority });
    }
  } catch (err) {
    if (err instanceof ExtractError) return fail(db, u.id, err.message);
    if (err instanceof AiError && err.kind === "cooldown") {
      await db.update(uploads).set({ status: "queued", statusLine: "Waiting for a free slot" }).where(eq(uploads.id, u.id));
    }
    throw err;
  }
};

export const generateChunk: Handler = async (db, job) => {
  const { uploadId, chunkId } = job.payload as ChunkPayload;
  const [chunk] = await db.select().from(chunks).where(eq(chunks.id, chunkId));
  if (!chunk || chunk.generatedAt) return;
  const row = await loadUpload(db, uploadId);
  if (!row || row.u.status !== "generating") return;
  const { u } = row;
  const course = { code: displayCourseCode(row.code), title: row.courseTitle };
  const heading = headingOf(chunk.text);
  const pageNote = u.pagesUsed && chunk.page ? ` (${u.type === "pptx" ? "slide" : u.type === "photos" ? "photo" : u.type === "docx" ? "section" : "page"} ${chunk.page} of ${u.pagesUsed})` : "";
  await db
    .update(uploads)
    .set({ statusLine: `${u.isPastPaper ? "Answering past questions" : "Writing questions"}${heading ? ` on ${heading}` : ""}${pageNote}` })
    .where(eq(uploads.id, u.id));

  const plan = await viewerPlan(db, u.userId);
  const left = (await getUsage(db, u.userId, "ai_questions", plan)).remaining;
  const n = Math.max(0, Math.min(chunk.questionTarget, left));
  const knownTopics = (await db.select({ name: topics.name }).from(topics).where(eq(topics.courseId, u.courseId))).map((t) => t.name);

  let set: GeneratedSet = { topic: heading ?? "", questions: [], flashcards: [], theory: [] };
  let provider: string | null = null;
  try {
    const res = u.isPastPaper
      ? await ai.extractPastQuestions(db, { course, text: chunk.text, label: chunk.label ?? "", max: n, knownTopics })
      : await ai.generateQuestions(db, { course, text: chunk.text, label: chunk.label ?? "", questionCount: n, flashcardCount: flashcardTarget(chunk.text, n), theoryCount: n > 0 ? 1 : 0, knownTopics });
    set = res.value;
    provider = res.provider;
  } catch (err) {
    // Invalid output after one retry is discarded (brief); limits/cooldowns go back to the queue.
    if (!(err instanceof AiError && (err.kind === "invalid" || err.kind === "blocked"))) throw err;
  }
  if (provider) await db.update(aiJobs).set({ provider }).where(eq(aiJobs.id, job.id));

  const chunkTopic = tidyTopic(set.topic) || heading || "General";
  const topicIdFor = await topicResolver(db, u.courseId);
  const visibility = u.visibility === "contribute" ? ("shared" as const) : ("private" as const);
  const sourceLabel = `${u.title} · ${chunk.label ?? ""}`.replace(/ · $/, "");
  const seen = new Set((await db.select({ stem: questions.stem }).from(questions).where(eq(questions.sourceUploadId, u.id))).map((q) => q.stem.toLowerCase()));

  const qRows: (typeof questions.$inferInsert)[] = [];
  for (const g of set.questions.slice(0, n)) {
    const bank = toBankQuestion(g, chunkTopic, u.isPastPaper);
    if (!bank || seen.has(bank.stem.toLowerCase())) continue;
    let row;
    try {
      row = toRow(bank, "generated");
    } catch {
      continue;
    }
    seen.add(bank.stem.toLowerCase());
    qRows.push({
      courseId: u.courseId,
      topicId: await topicIdFor(bank.topic),
      sourceUploadId: u.id,
      ...row,
      stem: bank.stem,
      explanation: bank.why,
      difficulty: bank.d,
      sourceLabel,
      isPastQuestion: u.isPastPaper,
      visibility,
    });
  }
  const fRows: (typeof flashcards.$inferInsert)[] = [];
  for (const f of set.flashcards) {
    const front = f.front.trim().slice(0, 500);
    const back = f.back.trim().slice(0, 1000);
    if (!front || !back) continue;
    fRows.push({ courseId: u.courseId, topicId: await topicIdFor(f.topic || chunkTopic), front, back, sourceUploadId: u.id, sourceLabel, visibility });
  }

  const tRows: (typeof questions.$inferInsert)[] = [];
  for (const t of set.theory ?? []) {
    const rubric = t.rubric.map((r) => ({ point: r.point.trim().slice(0, 300), marks: r.marks }));
    tRows.push({
      courseId: u.courseId,
      topicId: await topicIdFor(t.topic || chunkTopic),
      sourceUploadId: u.id,
      type: "theory",
      stem: t.question.trim().slice(0, 2000),
      options: [],
      answer: { kind: "theory", modelAnswer: t.modelAnswer.trim().slice(0, 4000) },
      rubric,
      explanation: null,
      difficulty: 2,
      sourceLabel,
      visibility,
    });
  }

  await db.transaction(async (tx) => {
    const claimed = await tx.update(chunks).set({ generatedAt: new Date(), topic: chunkTopic }).where(and(eq(chunks.id, chunk.id), isNull(chunks.generatedAt))).returning({ id: chunks.id });
    if (!claimed.length) return; // another worker finished it
    if (qRows.length) await tx.insert(questions).values(qRows);
    if (fRows.length) await tx.insert(flashcards).values(fRows);
    if (tRows.length) await tx.insert(questions).values(tRows);
    if (qRows.length) await recordUsage(tx as unknown as Db, u.userId, "ai_questions", qRows.length);
    await chunkFinished(tx as unknown as Db, u.id, qRows.length, fRows.length);
  });
};

/** Counts a finished chunk; the last one marks the upload ready (or failed if nothing came out). */
async function chunkFinished(db: Db, uploadId: string, madeQ: number, madeF: number) {
  const [u] = await db
    .update(uploads)
    .set({
      chunksDone: sql`${uploads.chunksDone} + 1`,
      questionsMade: sql`${uploads.questionsMade} + ${madeQ}`,
      flashcardsMade: sql`${uploads.flashcardsMade} + ${madeF}`,
    })
    .where(eq(uploads.id, uploadId))
    .returning();
  if (!u || u.chunksDone < u.chunksTotal || u.status !== "generating") return;
  if (u.questionsMade + u.flashcardsMade === 0) {
    await fail(db, u.id, u.questionBudget === 0 ? "You've used today's AI questions. Upload again after midnight." : "We couldn't make questions from this file. Try clearer pages.");
    return;
  }
  const done = await db
    .update(uploads)
    .set({ status: "ready", statusLine: null, completedAt: new Date(), xpEarned: UPLOAD_XP })
    .where(and(eq(uploads.id, u.id), eq(uploads.status, "generating")))
    .returning({ id: uploads.id });
  if (!done.length) return;
  await db.update(users).set({ xp: sql`${users.xp} + ${UPLOAD_XP}` }).where(eq(users.id, u.userId));
  await ensureUploadBank(db, u.id);
  await enqueue(db, "embed_upload", { uploadId: u.id }, { userId: u.userId, priority: -10 });
  await notifyUploadReady(db, u);
}

export const embedUpload: Handler = async (db, job) => {
  const { uploadId } = job.payload as UploadPayload;
  const rows = await db.select({ id: chunks.id, text: chunks.text }).from(chunks).where(and(eq(chunks.uploadId, uploadId), isNull(chunks.embedding)));
  if (!rows.length) return;
  let vectors: number[][];
  try {
    vectors = (await ai.embed(db, rows.map((r) => r.text), "document")).value;
  } catch (err) {
    if (err instanceof AiError && err.kind === "not_configured") return; // no embedding provider: tutor falls back to text search
    throw err;
  }
  for (let i = 0; i < rows.length; i++) await db.update(chunks).set({ embedding: vectors[i] }).where(eq(chunks.id, rows[i].id));
};

export const HANDLERS: Record<JobType, Handler> = { ingest_upload: ingestUpload, generate_chunk: generateChunk, embed_upload: embedUpload };

/** A job used up its retries: tell the student instead of spinning forever. */
export async function onFinalFailure(job: Job, message: string, db?: Db) {
  const payload = job.payload as Partial<ChunkPayload>;
  if (!db || !payload.uploadId) return;
  if (job.type === "ingest_upload") {
    console.error(`[jobs] upload ${payload.uploadId} failed: ${message}`);
    await fail(db, payload.uploadId, "Something went wrong reading this file. Try again in a few minutes.");
  } else if (job.type === "generate_chunk" && payload.chunkId) {
    // Give up on this chunk only; the rest of the upload still counts.
    const claimed = await db.update(chunks).set({ generatedAt: new Date() }).where(and(eq(chunks.id, payload.chunkId), isNull(chunks.generatedAt))).returning({ id: chunks.id });
    if (claimed.length) await chunkFinished(db, payload.uploadId, 0, 0);
  }
}

export function processQueue(db: Db, opts: { budgetMs?: number; maxJobs?: number } = {}) {
  return runJobs(db, HANDLERS, { ...opts, onFinalFailure: (job, msg) => onFinalFailure(job, msg, db) });
}

// ── Progress (2f) and result (2g) ────────────────────────────────────────────

export type UploadView = {
  id: string;
  status: Upload["status"];
  uploading: boolean;
  title: string;
  type: string;
  fileCount: number;
  sizeBytes: number;
  pageCount: number | null;
  pagesUsed: number | null;
  pagesCapped: boolean;
  chunksTotal: number;
  chunksDone: number;
  questionsMade: number;
  flashcardsMade: number;
  statusLine: string | null;
  error: string | null;
  isPastPaper: boolean;
  reused: boolean;
  /** Questions live on the original upload (same course, already shared). */
  linked: boolean;
  contribute: boolean;
  xpEarned: number;
  courseId: string;
  courseCode: string;
  queue: { ahead: number; etaMin: number; busy: boolean } | null;
  topics: { name: string; count: number }[];
};

/** Which upload's questions to show: the original when this one is a linked re-upload. */
export async function questionSourceId(db: Db, u: Upload): Promise<string> {
  if (!u.reusedFromId) return u.id;
  const [src] = await db.select({ courseId: uploads.courseId, visibility: uploads.visibility }).from(uploads).where(eq(uploads.id, u.reusedFromId));
  return src && linksToSource(u, src) ? u.reusedFromId : u.id;
}

export async function getUploadView(db: Db, userId: string, uploadId: string, now = new Date()): Promise<UploadView | null> {
  const [row] = await db
    .select({ u: uploads, code: courses.code })
    .from(uploads)
    .innerJoin(courses, eq(courses.id, uploads.courseId))
    .where(and(eq(uploads.id, uploadId), eq(uploads.userId, userId)));
  if (!row) return null;
  const { u } = row;
  const sourceId = await questionSourceId(db, u);

  let queue: UploadView["queue"] = null;
  if (u.status === "queued" || u.status === "extracting" || u.status === "generating") {
    const mine = await db
      .select({ id: aiJobs.id })
      .from(aiJobs)
      .where(and(inArray(aiJobs.status, ["queued", "running"]), sql`${aiJobs.payload}->>'uploadId' = ${u.id}`));
    const ahead = await jobsAhead(db, mine.map((j) => j.id));
    const resumeAt = await nextProviderAt(db, u.type === "photos" && u.status !== "generating" ? "vision" : "text", now);
    const waitMs = Math.max(ahead * 20_000, resumeAt ? resumeAt.getTime() - now.getTime() : 0);
    queue = { ahead, etaMin: Math.max(1, Math.ceil(waitMs / 60_000)), busy: ahead >= 6 || !!resumeAt };
  }

  let topicCounts: UploadView["topics"] = [];
  if (u.status === "ready") {
    const rows = await db
      .select({ name: topics.name, n: count() })
      .from(questions)
      .innerJoin(topics, eq(topics.id, questions.topicId))
      .where(and(eq(questions.sourceUploadId, sourceId), eq(questions.status, "active"), ne(questions.type, "theory")))
      .groupBy(topics.name)
      .orderBy(desc(count()));
    topicCounts = rows.map((r) => ({ name: r.name, count: Number(r.n) }));
  }

  return {
    id: u.id,
    status: u.status,
    uploading: u.status === "queued" && u.statusLine === "Uploading",
    title: u.title,
    type: u.type,
    fileCount: Math.max(1, u.fileKeys.length),
    sizeBytes: u.sizeBytes,
    pageCount: u.pageCount,
    pagesUsed: u.pagesUsed,
    pagesCapped: u.pageCount !== null && u.pagesUsed !== null && u.pagesUsed < u.pageCount,
    chunksTotal: u.chunksTotal,
    chunksDone: u.chunksDone,
    questionsMade: u.questionsMade,
    flashcardsMade: u.flashcardsMade,
    statusLine: u.statusLine,
    error: u.error,
    isPastPaper: u.isPastPaper,
    reused: !!u.reusedFromId,
    linked: sourceId !== u.id,
    contribute: u.visibility === "contribute",
    xpEarned: u.xpEarned,
    courseId: u.courseId,
    courseCode: displayCourseCode(row.code),
    queue,
    topics: topicCounts,
  };
}

/** The student's recent uploads (newest first), optionally for one course. */
export async function recentUploads(db: Db, userId: string, limit = 5, courseId?: string) {
  return db
    .select({
      id: uploads.id,
      title: uploads.title,
      type: uploads.type,
      fileCount: sql<number>`cardinality(${uploads.fileKeys})`,
      status: uploads.status,
      questionsMade: uploads.questionsMade,
      visibility: uploads.visibility,
      courseId: uploads.courseId,
      courseCode: courses.code,
      completedAt: uploads.completedAt,
      createdAt: uploads.createdAt,
    })
    .from(uploads)
    .innerJoin(courses, eq(courses.id, uploads.courseId))
    .where(and(eq(uploads.userId, userId), courseId ? eq(uploads.courseId, courseId) : undefined, sql`coalesce(${uploads.statusLine}, '') <> 'Uploading'`))
    .orderBy(desc(uploads.createdAt))
    .limit(limit);
}

// ── Review (brief: "review, edit or delete generated questions") ─────────────

export async function uploadQuestions(db: Db, userId: string, uploadId: string) {
  const [u] = await db.select().from(uploads).where(and(eq(uploads.id, uploadId), eq(uploads.userId, userId)));
  if (!u) return null;
  const sourceId = await questionSourceId(db, u);
  const rows = await db
    .select({ q: questions, topic: topics.name })
    .from(questions)
    .leftJoin(topics, eq(topics.id, questions.topicId))
    .where(and(eq(questions.sourceUploadId, sourceId), eq(questions.status, "active")))
    .orderBy(asc(questions.sourceLabel), asc(questions.createdAt));
  return { upload: u, editable: sourceId === u.id, questions: rows.map((r) => ({ ...r.q, topic: r.topic })) };
}
