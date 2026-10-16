/**
 * The prompts. Each task asks for strict JSON (schema below) and validates the
 * reply with Zod; questions that still don't make sense are dropped one by one
 * rather than throwing away the whole batch.
 */
import { z } from "zod";
import type { BankQuestion } from "@/db/question-bank/types";
import type { AiPart, AiProvider } from "./provider";

export type CourseRef = { code: string; title: string };

const RULES = `You write exam practice for Nigerian university, polytechnic and college of education students.
British English. Plain text only: no Markdown and no LaTeX (write x^2, 3/4, H2O, sqrt(2)).
Use only what the student's material says. Never invent facts, names, dates or figures.`;

const courseLine = (c: CourseRef) => `Course: ${c.code} · ${c.title}.`;

// ── Questions + flashcards from one chunk ────────────────────────────────────

const QUESTION_TYPES = ["single", "multiple", "true_false", "fill_in"] as const;
const DIFFICULTIES = ["easy", "medium", "hard"] as const;

const questionSchema = {
  type: "OBJECT",
  properties: {
    type: { type: "STRING", enum: [...QUESTION_TYPES] },
    topic: { type: "STRING", description: "Short syllabus topic, 2–5 words." },
    stem: { type: "STRING" },
    options: { type: "ARRAY", items: { type: "STRING" }, description: "Option texts without letters. Empty for true_false and fill_in." },
    correct: { type: "ARRAY", items: { type: "INTEGER" }, description: "0-based indexes of the correct options. Empty for true_false and fill_in." },
    answer: { type: "STRING", description: 'true_false: "True" or "False". fill_in: the exact answer, alternatives separated by " | ". Otherwise empty.' },
    explanation: { type: "STRING", description: "One or two sentences that teach why, from the notes." },
    difficulty: { type: "STRING", enum: [...DIFFICULTIES] },
  },
  required: ["type", "topic", "stem", "options", "correct", "answer", "explanation", "difficulty"],
};
const flashcardSchema = {
  type: "OBJECT",
  properties: { front: { type: "STRING" }, back: { type: "STRING" }, topic: { type: "STRING" } },
  required: ["front", "back"],
};
const setSchema = {
  type: "OBJECT",
  properties: {
    topic: { type: "STRING", description: "The main topic of this part of the material, 2–5 words." },
    questions: { type: "ARRAY", items: questionSchema },
    flashcards: { type: "ARRAY", items: flashcardSchema },
  },
  required: ["topic", "questions", "flashcards"],
};

const zQuestion = z.object({
  type: z.enum(QUESTION_TYPES),
  topic: z.string().default(""),
  stem: z.string().min(1),
  options: z.array(z.string()).default([]),
  correct: z.array(z.number().int()).default([]),
  answer: z.string().default(""),
  explanation: z.string().default(""),
  difficulty: z.enum(DIFFICULTIES).catch("medium"),
});
const zFlashcard = z.object({ front: z.string().min(1), back: z.string().min(1), topic: z.string().nullish() });
const zSet = z.object({
  topic: z.string().default(""),
  questions: z.array(zQuestion).max(60).default([]),
  flashcards: z.array(zFlashcard).max(60).default([]),
});

export type GeneratedQuestion = z.infer<typeof zQuestion>;
export type GeneratedFlashcard = z.infer<typeof zFlashcard>;
export type GeneratedSet = z.infer<typeof zSet>;

export type GenerateInput = {
  course: CourseRef;
  text: string;
  /** Where this text is from, e.g. "p.3–5". */
  label: string;
  questionCount: number;
  flashcardCount: number;
  knownTopics: string[];
};

const MAX_CHUNK_CHARS = 14_000;

function topicHint(known: string[]) {
  return known.length ? `Prefer these existing topic names when they fit: ${known.slice(0, 40).join("; ")}.` : "";
}

/** One call per chunk: questions with explanations, plus flashcards (brief: generate in batches). */
export async function generateQuestions(ai: AiProvider, input: GenerateInput): Promise<GeneratedSet> {
  const n = input.questionCount;
  const m = input.flashcardCount;
  const asks =
    n > 0
      ? `write ${n} exam questions and ${m} flashcards.
- Mix the types: mostly "single" (exactly 4 options, one correct), some "multiple" (4–5 options, 2 or 3 correct), "true_false" and "fill_in" (a short exact answer).
- Options must all be plausible. No "all of the above" or "none of the above". Vary where the correct option sits.
- Cover the whole text, not just the first paragraph. Do not repeat a question.
- Each question gets a topic, a difficulty and an explanation. Check every answer against the notes.`
      : `write ${m} flashcards (no questions).`;
  const reply = await ai.generate({
    task: "generate_questions",
    system: RULES,
    parts: [
      {
        text: `${courseLine(input.course)}
From the student's notes below (${input.label}), ${asks}
- Flashcards: a question or key term on the front, a short answer on the back.
- "topic": the main topic of this part of the notes. ${topicHint(input.knownTopics)}

Notes:
"""
${input.text.slice(0, MAX_CHUNK_CHARS)}
"""`,
      },
    ],
    schema: setSchema,
    parse: zSet,
    temperature: 0.6,
    context: input,
  });
  return { ...reply, questions: reply.questions.slice(0, n), flashcards: reply.flashcards.slice(0, Math.max(m, 0)) };
}

export type PastPaperInput = { course: CourseRef; text: string; label: string; max: number; knownTopics: string[] };

/** A past-question paper: transcribe the real questions as they are, then answer and explain them. */
export async function extractPastQuestions(ai: AiProvider, input: PastPaperInput): Promise<GeneratedSet> {
  const reply = await ai.generate({
    task: "past_questions",
    system: RULES,
    parts: [
      {
        text: `${courseLine(input.course)}
The text below is from a past exam paper (${input.label}). Transcribe up to ${input.max} of its objective questions exactly as written:
do not rephrase, merge, solve in the stem or invent questions. Keep the options in the paper's order, without their letters.
Work out the correct answer for each and explain it in one or two sentences. Skip essay/theory questions and instructions.
Give each a short topic. ${topicHint(input.knownTopics)} Also write up to 10 flashcards on the key facts the paper tests.

Paper:
"""
${input.text.slice(0, MAX_CHUNK_CHARS)}
"""`,
      },
    ],
    schema: setSchema,
    parse: zSet,
    temperature: 0,
    context: input,
  });
  return { ...reply, questions: reply.questions.slice(0, input.max) };
}

const zCards = z.object({ flashcards: z.array(zFlashcard).max(60) });

export async function generateFlashcards(ai: AiProvider, input: { course: CourseRef; text: string; label: string; count: number }) {
  const reply = await ai.generate({
    task: "flashcards",
    system: RULES,
    parts: [
      {
        text: `${courseLine(input.course)}
Write ${input.count} flashcards from these notes (${input.label}): a question or key term on the front, a short answer on the back, and a short topic.

Notes:
"""
${input.text.slice(0, MAX_CHUNK_CHARS)}
"""`,
      },
    ],
    schema: { type: "OBJECT", properties: { flashcards: { type: "ARRAY", items: flashcardSchema } }, required: ["flashcards"] },
    parse: zCards,
    temperature: 0.4,
    context: input,
  });
  return reply.flashcards.slice(0, input.count);
}

// ── Photos ───────────────────────────────────────────────────────────────────

const zRead = z.object({
  kind: z.enum(["notes", "past_paper"]).catch("notes"),
  pages: z.array(z.object({ text: z.string().default("") })),
});
export type ReadImageResult = z.infer<typeof zRead>;
export type Photo = { mimeType: string; base64: string };

/** Reads photos of notes or of a past-question paper (one page of text per photo, in order). */
export async function readImage(ai: AiProvider, input: { course: CourseRef; photos: Photo[] }): Promise<ReadImageResult> {
  const parts: AiPart[] = [
    {
      text: `${courseLine(input.course)}
These are ${input.photos.length} photos of a student's handwritten or printed notes, or of a past exam paper, in order.
Transcribe the readable text of each photo faithfully (headings on their own lines; skip doodles and page furniture).
Return one entry in "pages" per photo, in the same order. If a photo is unreadable, give it empty text.
"kind" is "past_paper" if the photos are an exam/test paper with numbered questions, otherwise "notes".`,
    },
    ...input.photos.map((p) => ({ image: p })),
  ];
  const reply = await ai.generate({
    task: "read_image",
    system: RULES,
    parts,
    schema: {
      type: "OBJECT",
      properties: {
        kind: { type: "STRING", enum: ["notes", "past_paper"] },
        pages: { type: "ARRAY", items: { type: "OBJECT", properties: { text: { type: "STRING" } }, required: ["text"] } },
      },
      required: ["kind", "pages"],
    },
    parse: zRead,
    temperature: 0,
    context: { course: input.course, count: input.photos.length },
  });
  return { kind: reply.kind, pages: input.photos.map((_, i) => reply.pages[i] ?? { text: "" }) };
}

// ── Tutor and theory grading (used from milestone 5) ─────────────────────────

const zAnswer = z.object({ answer: z.string().min(1), citedChunkIds: z.array(z.string()).default([]), notInNotes: z.boolean().default(false) });
export type TutorChunk = { id: string; label: string; text: string };

/** Answers only from the given chunks (top 5 by retrieval), citing them. */
export async function answerFromNotes(ai: AiProvider, input: { course: CourseRef; question: string; chunks: TutorChunk[] }) {
  return ai.generate({
    task: "answer_from_notes",
    system: `${RULES}\nYou are a patient tutor. Answer only from the excerpts given. If they don't cover it, say so and set notInNotes.`,
    parts: [
      {
        text: `${courseLine(input.course)}
Excerpts from the student's notes:
${input.chunks.map((c) => `[${c.id}] (${c.label})\n${c.text.slice(0, 2500)}`).join("\n\n")}

Question: ${input.question.slice(0, 1000)}

Answer in under 150 words. List the ids of the excerpts you used in citedChunkIds.`,
      },
    ],
    schema: {
      type: "OBJECT",
      properties: { answer: { type: "STRING" }, citedChunkIds: { type: "ARRAY", items: { type: "STRING" } }, notInNotes: { type: "BOOLEAN" } },
      required: ["answer", "citedChunkIds", "notInNotes"],
    },
    parse: zAnswer,
    temperature: 0.2,
    context: input,
  });
}

const zGrade = z.object({ score: z.number().min(0), covered: z.array(z.string()), missed: z.array(z.string()), tip: z.string() });
export type RubricPoint = { point: string; marks: number };

/** Scores a theory answer against its stored rubric. Guidance, not an official grade. */
export async function gradeTheory(ai: AiProvider, input: { question: string; rubric: RubricPoint[]; answer: string }) {
  const max = input.rubric.reduce((s, r) => s + r.marks, 0);
  const reply = await ai.generate({
    task: "grade_theory",
    system: `${RULES}\nYou mark like a fair Nigerian lecturer: credit points made in the student's own words.`,
    parts: [
      {
        text: `Question: ${input.question}
Marking guide (${max} marks):
${input.rubric.map((r) => `- ${r.point} (${r.marks})`).join("\n")}

Student's answer:
"""
${input.answer.slice(0, 6000)}
"""

Give the score out of ${max}, the guide points covered and missed (quote them from the guide), and one specific tip to improve.`,
      },
    ],
    schema: {
      type: "OBJECT",
      properties: {
        score: { type: "NUMBER" },
        covered: { type: "ARRAY", items: { type: "STRING" } },
        missed: { type: "ARRAY", items: { type: "STRING" } },
        tip: { type: "STRING" },
      },
      required: ["score", "covered", "missed", "tip"],
    },
    parse: zGrade,
    temperature: 0,
    context: input,
  });
  return { ...reply, score: Math.min(reply.score, max), maxScore: max };
}

// ── Turning replies into bank rows ───────────────────────────────────────────

const clean = (s: string) => s.replace(/\s+/g, " ").trim();
const stripLetter = (s: string) => clean(s).replace(/^\(?[A-Fa-f][.)]\s+/, "");
const DIFFICULTY: Record<GeneratedQuestion["difficulty"], 1 | 2 | 3> = { easy: 1, medium: 2, hard: 3 };

/** A generated question in the bank's authoring format, or null if it doesn't hold together. */
export function toBankQuestion(q: GeneratedQuestion, fallbackTopic: string, past = false): BankQuestion | null {
  const stem = clean(q.stem);
  const topic = clean(q.topic) || fallbackTopic;
  const why = clean(q.explanation) || (past ? "Answer worked out by AI from the paper. Check it against your notes." : "");
  const d = DIFFICULTY[q.difficulty];
  if (stem.length < 8 || !why) return null;
  switch (q.type) {
    case "single":
    case "multiple": {
      const options = q.options.map(stripLetter);
      if (options.length < 2 || options.length > 6 || options.some((o) => !o)) return null;
      if (new Set(options.map((o) => o.toLowerCase())).size !== options.length) return null;
      const correct = [...new Set(q.correct)].filter((i) => i >= 0 && i < options.length);
      if (!correct.length || correct.length !== new Set(q.correct).size) return null;
      if (q.type === "single" || correct.length === 1) {
        return { t: "single", topic, d, stem, options, correct: correct[0], why, ...(past ? { past: true } : {}) };
      }
      if (correct.length === options.length) return null;
      return { t: "multiple", topic, d, stem, options, correct: correct.sort((a, b) => a - b), why };
    }
    case "true_false": {
      const a = clean(q.answer).toLowerCase();
      if (a !== "true" && a !== "false") return null;
      return { t: "true_false", topic, d, stem, correct: a === "true", why };
    }
    case "fill_in": {
      const accepted = [...new Set(q.answer.split("|").map(clean).filter(Boolean))];
      if (!accepted.length || accepted.some((a) => a.length > 80)) return null;
      return { t: "fill_in", topic, d, stem, accepted, why };
    }
  }
}

/** Heuristic for typed/printed past papers (photos are classified by the vision call instead). */
export function looksLikePastPaper(text: string): boolean {
  const lines = text.split(/\n/);
  const numbered = lines.filter((l) => /^\s*(Q(uestion)?\s*)?\(?\d{1,3}[.)]\s+\S/i.test(l)).length;
  const options = lines.filter((l) => /^\s*\(?[A-Ea-e][.)]\s+\S/.test(l)).length;
  const inline = (text.match(/\(?\b[A-D][.)]\s+\S[^\n]{0,80}?\s+\(?\b[B-E][.)]\s/g) ?? []).length;
  const cues = (text.match(/answer (all|any)|time allowed|instructions?:|examination|past questions?|candidates|semester exam/gi) ?? []).length;
  return (numbered >= 3 && options + inline * 3 >= 8) || (cues >= 2 && numbered >= 5);
}
