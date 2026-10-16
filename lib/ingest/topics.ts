/**
 * Topic names from different chunks and uploads drift ("Barriers to communication",
 * "Communication barriers"). New names are merged into an existing course topic when
 * they are close enough (Sørensen–Dice on bigrams, ported from SonoCBT questions/model.ts,
 * plus a word-set check for reordered names).
 */

export function normaliseForCompare(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

function bigrams(s: string): Map<string, number> {
  const t = s.replace(/ /g, "");
  const m = new Map<string, number>();
  for (let i = 0; i < t.length - 1; i++) {
    const g = t.slice(i, i + 2);
    m.set(g, (m.get(g) ?? 0) + 1);
  }
  return m;
}

/** Sørensen–Dice similarity of character bigrams, 0–1. */
export function similarity(a: string, b: string): number {
  const x = normaliseForCompare(a);
  const y = normaliseForCompare(b);
  if (!x || !y) return 0;
  if (x === y) return 1;
  const A = bigrams(x);
  const B = bigrams(y);
  let overlap = 0;
  let total = 0;
  for (const [g, n] of A) {
    overlap += Math.min(n, B.get(g) ?? 0);
    total += n;
  }
  for (const n of B.values()) total += n;
  return total ? (2 * overlap) / total : 0;
}

const SKIP = new Set(["the", "of", "and", "in", "to", "a", "an", "on", "for", "its", "their"]);
const stem = (w: string) => w.replace(/(ies|es|s|ing|ion|ions)$/, "");
const wordSet = (s: string) => new Set(normaliseForCompare(s).split(" ").filter((w) => w && !SKIP.has(w)).map(stem));

export const TOPIC_MERGE_THRESHOLD = 0.72;

/** Cleans an AI topic name: short, sentence case, no trailing punctuation. */
export function tidyTopic(name: string): string {
  const t = name.replace(/\s+/g, " ").replace(/^[\d.)\s-]+/, "").replace(/[.:;,]+$/, "").trim().slice(0, 60);
  return t ? t.charAt(0).toUpperCase() + t.slice(1) : "";
}

/** The existing topic this name belongs to, if any. */
export function matchTopic<T extends { name: string }>(name: string, existing: T[]): T | null {
  const words = wordSet(name);
  let best: { t: T; score: number } | null = null;
  for (const t of existing) {
    let score = similarity(name, t.name);
    const other = wordSet(t.name);
    if (words.size && other.size && [...words].every((w) => other.has(w)) && [...other].every((w) => words.has(w))) score = 1;
    if (!best || score > best.score) best = { t, score };
  }
  return best && best.score >= TOPIC_MERGE_THRESHOLD ? best.t : null;
}

/** A heading-like first line ("Barriers to communication"), used as a topic hint. */
export function headingOf(text: string): string | null {
  for (const raw of text.split("\n").slice(0, 6)) {
    const line = raw.trim();
    if (/^\[[^\]]*\]$/.test(line)) continue; // "[p.3]" page markers added by chunking
    if (line.length >= 4 && line.length <= 60 && /[A-Za-z]/.test(line) && !/[.?!:;,]$/.test(line) && line.split(" ").length <= 7) {
      return line.replace(/^(\d+[.)]?|chapter \d+[:.]?|week \d+[:.]?)\s*/i, "") || null;
    }
  }
  return null;
}
