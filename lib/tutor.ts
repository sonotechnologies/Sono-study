import { and, cosineDistance, desc, eq, isNotNull, ne, or } from "drizzle-orm";
import type { Db } from "@/db";
import { chunks, courses, mockAttempts, tutorMessages, uploads, type TutorCitation } from "@/db/schema";
import { ai, AiError } from "@/lib/ai";
import { displayCourseCode } from "@/lib/format";
import type { PlanName } from "@/lib/plans";
import { getUsage, recordUsage } from "@/lib/usage";

/**
 * Ask-your-notes tutor (brief §7). Answers come only from the student's own
 * uploads plus classmates' contributed material for the course, with citations
 * down to the page or slide. Retrieval: the 8 nearest chunks by embedding (text
 * overlap when embeddings aren't available), split into page passages, re-ranked
 * by overlap with the question; the top 5 go to the AI. An answer that cites
 * nothing it was given is treated as "not in your notes".
 */

export const TOP_PASSAGES = 5;
const CANDIDATE_CHUNKS = 8;

export type Passage = { id: string; chunkId: string; uploadId: string; own: boolean; label: string; page: number | null; text: string };

const STOP = new Set(
  "about after again also because been before being between both could does each from have here into just like more most much only other over same some such than that their them then there these they this those through very what when where which while will with would your yours explain tell give please notes note".split(" "),
);
const stem = (w: string) => w.replace(/(ies|es|s|ing|ed)$/, "");
export function terms(text: string): Set<string> {
  return new Set((text.toLowerCase().match(/[a-z][a-z-]{2,}/g) ?? []).filter((w) => !STOP.has(w)).map(stem));
}
export function overlapScore(query: Set<string>, text: string): number {
  const t = terms(text);
  let n = 0;
  for (const w of query) if (t.has(w)) n++;
  return n;
}

/** A chunk spanning several pages carries "[p.3]" markers: split it back into pages. */
export function splitPages(text: string, fallbackLabel: string, fallbackPage: number | null): { label: string; page: number | null; text: string }[] {
  const parts = text.split(/^\[([^\]\n]+)\]\n/m);
  if (parts.length < 3) return [{ label: fallbackLabel, page: fallbackPage, text }];
  const out: { label: string; page: number | null; text: string }[] = [];
  for (let i = 1; i < parts.length; i += 2) {
    const label = parts[i];
    const n = Number(label.match(/\d+/)?.[0]);
    out.push({ label, page: Number.isFinite(n) ? n : null, text: (parts[i + 1] ?? "").trim() });
  }
  return out.filter((p) => p.text);
}

/** Material the tutor may read for this student and course. */
function readable(userId: string, courseId: string) {
  return and(eq(uploads.courseId, courseId), eq(uploads.status, "ready"), or(eq(uploads.userId, userId), eq(uploads.visibility, "contribute")));
}

export async function retrieve(db: Db, userId: string, courseId: string, query: string, k = TOP_PASSAGES): Promise<Passage[]> {
  const q = terms(query);
  const base = db
    .select({ id: chunks.id, text: chunks.text, label: chunks.label, page: chunks.page, uploadId: uploads.id, title: uploads.title, owner: uploads.userId })
    .from(chunks)
    .innerJoin(uploads, eq(uploads.id, chunks.uploadId));

  let candidates: Awaited<typeof base>;
  let byVector = false;
  try {
    const { value } = await ai.embed(db, [query], "query");
    candidates = await base
      .where(and(readable(userId, courseId), isNotNull(chunks.embedding)))
      .orderBy(cosineDistance(chunks.embedding, value[0]))
      .limit(CANDIDATE_CHUNKS);
    byVector = candidates.length > 0;
  } catch (err) {
    if (!(err instanceof AiError)) throw err;
    candidates = [];
  }
  if (!byVector) {
    // No embeddings (or no embedding provider right now): rank by word overlap instead.
    const all = await base.where(readable(userId, courseId)).limit(400);
    candidates = all
      .map((c) => ({ c, s: overlapScore(q, c.text) }))
      .filter((x) => x.s > 0)
      .sort((a, b) => b.s - a.s)
      .slice(0, CANDIDATE_CHUNKS)
      .map((x) => x.c);
  }

  const seen = new Set<string>();
  const passages: (Passage & { score: number })[] = [];
  candidates.forEach((c, rank) => {
    for (const p of splitPages(c.text, c.label ?? "notes", c.page)) {
      const key = p.text.slice(0, 200);
      if (seen.has(key)) continue; // the same file uploaded twice
      seen.add(key);
      passages.push({
        id: `${c.id}:${p.page ?? 0}`,
        chunkId: c.id,
        uploadId: c.uploadId,
        own: c.owner === userId,
        label: `${c.title} · ${p.label}`,
        page: p.page,
        text: p.text,
        score: overlapScore(q, p.text) * 2 + (CANDIDATE_CHUNKS - rank) * 0.1 + (c.owner === userId ? 0.05 : 0),
      });
    }
  });
  return passages
    .sort((a, b) => b.score - a.score)
    .slice(0, k)
    .map((p): Passage => ({ id: p.id, chunkId: p.chunkId, uploadId: p.uploadId, own: p.own, label: p.label, page: p.page, text: p.text }));
}

export class TutorError extends Error {
  constructor(
    message: string,
    readonly code: "limit" | "busy" | "invalid",
  ) {
    super(message);
  }
}

export const QUICK_ACTIONS = {
  quiz: { label: "Quiz me on this", instruction: "Ask me one short exam-style question on this, from my notes, and wait for my answer." },
  simpler: { label: "Explain simpler", instruction: "Explain your last answer more simply, in plain words, from my notes." },
  example: { label: "Give an example", instruction: "Give one concrete example of this, using my notes." },
} as const;
export type QuickAction = keyof typeof QUICK_ACTIONS;

const EXAM_NOW = /\b(i'?m|i am|we'?re|currently|right now)\b.{0,30}\b(in|writing|taking|sitting|doing)\b.{0,25}\b(exam|test|cbt|quiz)\b|\bexam (is )?(going on|ongoing|in progress)\b|\b(answer|solve)\b.{0,20}\bbefore (time|the time) (is )?up\b/i;

/** The brief's "no cheating tools": declined while a timed mock is running, or when asked for help mid-exam. */
export function isExamInProgressRequest(text: string): boolean {
  return EXAM_NOW.test(text);
}

const notInNotes = (code: string) => `Your ${code} notes don't cover that, so I won't guess. Upload the notes for that topic, or ask about something in them.`;

export type TutorReply = { id: string; content: string; citations: TutorCitation[]; notInNotes: boolean; declined: boolean };

export async function askTutor(
  db: Db,
  viewer: { id: string; effectivePlan: PlanName },
  courseId: string,
  input: { text?: string; action?: QuickAction },
  now = new Date(),
): Promise<TutorReply> {
  const [course] = await db.select({ code: courses.code, title: courses.title }).from(courses).where(eq(courses.id, courseId));
  if (!course) throw new TutorError("Course not found.", "invalid");
  const code = displayCourseCode(course.code);
  const history = await db
    .select()
    .from(tutorMessages)
    .where(and(eq(tutorMessages.userId, viewer.id), eq(tutorMessages.courseId, courseId)))
    .orderBy(desc(tutorMessages.createdAt))
    .limit(2);
  const lastAnswer = history.find((m) => m.role === "assistant");
  const lastQuestion = history.find((m) => m.role === "user");
  const action = input.action && QUICK_ACTIONS[input.action] ? input.action : null;
  const text = (action ? QUICK_ACTIONS[action].label : (input.text ?? "")).trim().slice(0, 1000);
  if (!text) throw new TutorError("Type a question.", "invalid");
  if (action && !lastAnswer) throw new TutorError("Ask a question first.", "invalid");

  const save = async (reply: Omit<TutorReply, "id">, cited: string[]) => {
    await db.insert(tutorMessages).values({ userId: viewer.id, courseId, role: "user", content: text, createdAt: now });
    const [row] = await db
      .insert(tutorMessages)
      .values({ userId: viewer.id, courseId, role: "assistant", content: reply.content, citedChunkIds: cited, citations: reply.citations, createdAt: new Date(now.getTime() + 1) })
      .returning({ id: tutorMessages.id });
    return { id: row.id, ...reply };
  };

  // No help with an exam in progress: a timed mock running now, or a request framed that way.
  const [running] = await db
    .select({ id: mockAttempts.id })
    .from(mockAttempts)
    .where(and(eq(mockAttempts.userId, viewer.id), eq(mockAttempts.status, "in_progress"), ne(mockAttempts.mode, "practice")))
    .limit(1);
  if (running || isExamInProgressRequest(text)) {
    return save(
      {
        content: running
          ? "You have a timed mock running. Finish or submit it first, then I'll go through anything you got stuck on."
          : "I can't help with an exam or test you're sitting right now. After it's done, ask me anything from your notes.",
        citations: [],
        notInNotes: false,
        declined: true,
      },
      [],
    );
  }

  const usage = await getUsage(db, viewer.id, "tutor_message", viewer.effectivePlan, now);
  if (usage.remaining <= 0) throw new TutorError(`You've used today's ${usage.limit} tutor messages.`, "limit");

  const query = action && lastQuestion ? lastQuestion.content : text;
  const passages = await retrieve(db, viewer.id, courseId, query);
  if (!passages.length) return save({ content: notInNotes(code), citations: [], notInNotes: true, declined: false }, []);

  let reply;
  try {
    reply = (
      await ai.answerFromNotes(db, {
        course: { code, title: course.title },
        question: text,
        chunks: passages.map((p) => ({ id: p.id, label: p.label, text: p.text })),
        previous: lastQuestion && lastAnswer ? { question: lastQuestion.content, answer: lastAnswer.content } : null,
        instruction: action ? QUICK_ACTIONS[action].instruction : null,
      })
    ).value;
  } catch (err) {
    if (err instanceof AiError && (err.kind === "cooldown" || err.kind === "limit" || err.kind === "busy")) {
      throw new TutorError("The tutor is very busy right now. Try again in a minute.", "busy");
    }
    if (err instanceof AiError && (err.kind === "invalid" || err.kind === "failed")) {
      throw new TutorError("The tutor couldn't answer that just now. Try asking another way.", "busy");
    }
    throw err;
  }
  await recordUsage(db, viewer.id, "tutor_message", 1, now);

  const byId = new Map(passages.map((p) => [p.id, p]));
  const cited = [...new Set(reply.citedChunkIds)].filter((id) => byId.has(id));
  // An answer that isn't backed by the notes it was given is not an answer from the notes.
  if (reply.notInNotes || cited.length === 0) return save({ content: notInNotes(code), citations: [], notInNotes: true, declined: false }, []);
  const citations: TutorCitation[] = cited.map((id) => {
    const p = byId.get(id)!;
    return { id, label: p.own ? p.label : p.label.replace(/^.*? · /, "Classmate's notes · "), uploadId: p.uploadId, page: p.page, own: p.own };
  });
  return save({ content: reply.answer.trim(), citations, notInNotes: false, declined: false }, cited);
}

export async function tutorHistory(db: Db, userId: string, courseId: string, limit = 40) {
  const rows = await db
    .select({ id: tutorMessages.id, role: tutorMessages.role, content: tutorMessages.content, citations: tutorMessages.citations, createdAt: tutorMessages.createdAt })
    .from(tutorMessages)
    .where(and(eq(tutorMessages.userId, userId), eq(tutorMessages.courseId, courseId)))
    .orderBy(desc(tutorMessages.createdAt))
    .limit(limit);
  return rows.reverse();
}

/** "Knows your 3 uploads + 2 shared banks" (design 2m). */
export async function tutorSources(db: Db, userId: string, courseId: string): Promise<{ own: number; shared: number }> {
  const rows = await db
    .selectDistinct({ id: uploads.id, owner: uploads.userId, hash: uploads.fileHash })
    .from(uploads)
    .innerJoin(chunks, eq(chunks.uploadId, uploads.id))
    .where(readable(userId, courseId));
  const ownHashes = new Set(rows.filter((r) => r.owner === userId).map((r) => r.hash));
  return { own: ownHashes.size, shared: new Set(rows.filter((r) => r.owner !== userId && !ownHashes.has(r.hash)).map((r) => r.hash)).size };
}

