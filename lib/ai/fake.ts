import { headingOf } from "@/lib/ingest/topics";
import { EMBED_DIMENSIONS, normalise, type AiProvider, type AiRequest } from "./provider";
import type { GenerateInput, GeneratedQuestion, GeneratedSet, PastPaperInput, RubricPoint, TutorChunk } from "./tasks";

/**
 * Offline provider for development and tests (no keys, no network). It writes
 * simple but valid questions straight from the text: gap-fills, true/false and
 * four-option questions whose distractors are other key terms in the notes.
 * Never used in production unless AI_PROVIDERS names it.
 */

const STOP = new Set(
  "about above after again against because before being below between could during every first other their there these those through under until where which while whose would should shall might often always never using within without people things however therefore although another important students student lecturers lecturer examiners examiner definition defined describe describes remember common often called refers means".split(
    " ",
  ),
);

const SAMPLE_PHOTO_TEXT = [
  "Barriers to communication\nNoise is any interference that distorts a message between the sender and the receiver.\nPhysical barriers include distance, poor lighting and faulty equipment.\nSemantic barriers arise when the sender and receiver attach different meanings to the same words.\nPsychological barriers such as anxiety and prejudice stop the receiver from listening openly.",
  "Listening skills\nHearing is a physical process, while listening is the active interpretation of sound.\nAn active listener gives feedback, asks questions and avoids interrupting the speaker.\nSelective listening means attending only to the parts of a message the listener agrees with.\nNote-taking during lectures improves recall when the student summarises in their own words.",
  "Note-taking\nThe Cornell method divides the page into cues, notes and a summary section.\nOutlining arranges ideas from general headings down to supporting details.\nAbbreviations save time, but a student must use them consistently to read the notes later.\nReviewing notes within twenty-four hours strengthens memory of the lecture.",
];

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

function sentencesOf(text: string): string[] {
  return text
    .replace(/\n(?=[a-z(,])/g, " ") // PDF lines wrapped mid-sentence
    .split(/(?<=[.!?])\s+|\n+/)
    .map((s) => s.replace(/\s+/g, " ").trim())
    .filter((s) => s.length >= 30 && s.length <= 260 && s.split(" ").length >= 6 && /[.!?]$/.test(s));
}

function keyTerm(sentence: string): string | null {
  const words = sentence.match(/[A-Za-z][A-Za-z-]{4,}/g) ?? [];
  const candidates = words.filter((w, i) => !STOP.has(w.toLowerCase()) && (i > 0 || w.length > 7));
  if (!candidates.length) return null;
  return candidates.reduce((best, w) => (w.length > best.length ? w : best));
}

const blank = (s: string, term: string) => s.replace(new RegExp(`\\b${term}\\b`), "_____");

function makeQuestions(input: GenerateInput): GeneratedSet {
  const topic = headingOf(input.text) ?? "General";
  const facts = sentencesOf(input.text)
    .map((s) => ({ s, term: keyTerm(s) }))
    .filter((f): f is { s: string; term: string } => !!f.term);
  const pool = [...new Set(facts.map((f) => f.term))];
  const questions: GeneratedQuestion[] = [];
  const kinds = ["single", "true_false", "single", "fill_in", "single"] as const;
  for (let i = 0; questions.length < input.questionCount && facts.length && i < facts.length * kinds.length; i++) {
    const f = facts[i % facts.length];
    const kind = kinds[(i + Math.floor(i / facts.length)) % kinds.length];
    const others = pool.filter((t) => t.toLowerCase() !== f.term.toLowerCase());
    const why = `Your notes (${input.label}) say: "${f.s}"`;
    const difficulty = (["easy", "medium", "hard"] as const)[i % 3];
    if (kind === "single") {
      if (others.length < 3) continue;
      const start = hash(f.s + i) % others.length;
      const distractors = [0, 1, 2].map((k) => others[(start + k * 7) % others.length]).filter((d, k, a) => a.indexOf(d) === k);
      if (distractors.length < 3) continue;
      const at = hash(f.term + i) % 4;
      const options = [...distractors];
      options.splice(at, 0, f.term);
      questions.push({ type: "single", topic, stem: `Complete the statement: "${blank(f.s, f.term)}"`, options, correct: [at], answer: "", explanation: why, difficulty });
    } else if (kind === "true_false") {
      const truth = hash(f.s) % 2 === 0 || !others.length;
      const swapped = truth ? f.s : f.s.replace(new RegExp(`\\b${f.term}\\b`), others[hash(f.term) % others.length]);
      questions.push({ type: "true_false", topic, stem: `True or false: ${swapped}`, options: [], correct: [], answer: truth ? "True" : "False", explanation: why, difficulty });
    } else {
      questions.push({ type: "fill_in", topic, stem: `Fill in the gap: ${blank(f.s, f.term)}`, options: [], correct: [], answer: f.term, explanation: why, difficulty });
    }
  }
  const flashcards = facts.slice(0, input.flashcardCount).map((f) => ({ front: blank(f.s, f.term), back: f.term, topic }));
  return { topic, questions, flashcards };
}

function parsePaper(input: PastPaperInput): GeneratedSet {
  const topic = headingOf(input.text) ?? "Past questions";
  const blocks = input.text.split(/\n(?=\s*\(?\d{1,3}[.)]\s)/);
  const questions: GeneratedQuestion[] = [];
  for (const block of blocks) {
    const m = block.match(/^\s*\(?\d{1,3}[.)]\s+([\s\S]+)/);
    if (!m) continue;
    const parts = m[1].split(/\s*\(?\b[A-E][.)]\s+/);
    const stem = parts[0].replace(/\s+/g, " ").trim();
    const options = parts.slice(1).map((o) => o.replace(/\s+/g, " ").trim()).filter(Boolean);
    if (stem.length < 8 || options.length < 2) continue;
    const longest = options.reduce((bi, o, i) => (o.length > options[bi].length ? i : bi), 0);
    questions.push({ type: "single", topic, stem, options, correct: [longest], answer: "", explanation: "Offline test provider: answer not checked.", difficulty: "medium" });
    if (questions.length >= input.max) break;
  }
  return { topic, questions, flashcards: [] };
}

function words(s: string) {
  return new Set((s.toLowerCase().match(/[a-z]{4,}/g) ?? []).filter((w) => !STOP.has(w)));
}

function overlap(a: Set<string>, b: Set<string>) {
  let n = 0;
  for (const w of a) if (b.has(w)) n++;
  return n;
}

export function fakeEmbedding(text: string): number[] {
  const v = new Array<number>(EMBED_DIMENSIONS).fill(0);
  const ws = text.toLowerCase().match(/[a-z0-9]{3,}/g) ?? [];
  ws.forEach((w, i) => {
    v[hash(w) % EMBED_DIMENSIONS] += 1;
    if (i > 0) v[hash(ws[i - 1] + " " + w) % EMBED_DIMENSIONS] += 0.5;
  });
  if (!ws.length) v[0] = 1;
  return normalise(v);
}

export function fakeProvider(name = "fake"): AiProvider {
  return {
    name,
    vision: true,
    async generate<T>(req: AiRequest<T>): Promise<T> {
      // FAKE_AI_DELAY_MS slows it down like a real provider (to see the progress screen in dev).
      const delay = Number(process.env.FAKE_AI_DELAY_MS) || 0;
      if (delay) await new Promise((r) => setTimeout(r, delay));
      let reply: unknown;
      switch (req.task) {
        case "generate_questions":
          reply = makeQuestions(req.context as GenerateInput);
          break;
        case "past_questions":
          reply = parsePaper(req.context as PastPaperInput);
          break;
        case "flashcards": {
          const ctx = req.context as { text: string; label: string; count: number };
          reply = { flashcards: makeQuestions({ course: { code: "", title: "" }, text: ctx.text, label: ctx.label, questionCount: 0, flashcardCount: ctx.count, knownTopics: [] }).flashcards };
          break;
        }
        case "read_image": {
          const ctx = req.context as { count: number };
          reply = { kind: "notes", pages: Array.from({ length: ctx.count }, (_, i) => ({ text: SAMPLE_PHOTO_TEXT[i % SAMPLE_PHOTO_TEXT.length] })) };
          break;
        }
        case "answer_from_notes": {
          const ctx = req.context as { question: string; chunks: TutorChunk[] };
          const q = words(ctx.question);
          const ranked = ctx.chunks.map((c) => ({ c, n: overlap(q, words(c.text)) })).sort((a, b) => b.n - a.n);
          const best = ranked[0];
          if (!best || best.n === 0) {
            reply = { answer: "Your notes don't cover that yet. Upload the notes for this topic and ask again.", citedChunkIds: [], notInNotes: true };
          } else {
            const sentence = sentencesOf(best.c.text).sort((a, b) => overlap(q, words(b)) - overlap(q, words(a)))[0] ?? best.c.text.slice(0, 200);
            reply = { answer: `From your notes (${best.c.label}): ${sentence}`, citedChunkIds: [best.c.id], notInNotes: false };
          }
          break;
        }
        case "grade_theory": {
          const ctx = req.context as { rubric: RubricPoint[]; answer: string };
          const a = words(ctx.answer);
          const covered = ctx.rubric.filter((r) => {
            const p = words(r.point);
            return p.size > 0 && overlap(p, a) / p.size >= 0.5;
          });
          const missed = ctx.rubric.filter((r) => !covered.includes(r));
          reply = {
            score: covered.reduce((s, r) => s + r.marks, 0),
            covered: covered.map((r) => r.point),
            missed: missed.map((r) => r.point),
            tip: missed.length ? `Add a point on: ${missed[0].point}` : "Well covered. Tighten your wording for full marks.",
          };
          break;
        }
      }
      const parsed = req.parse.safeParse(reply);
      if (!parsed.success) throw new Error(`fake provider produced an invalid ${req.task} reply`);
      return parsed.data;
    },
    async embed(texts: string[]) {
      return texts.map(fakeEmbedding);
    },
  };
}
