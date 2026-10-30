import type { Page } from "./extract";

/**
 * Chunking: consecutive pages are merged into chunks of about 6,000 characters
 * (one AI call each, brief: generate in batches) without splitting a page,
 * except a single huge page, which is cut at paragraph breaks.
 */

export type Chunk = { position: number; text: string; page: number; pageEnd: number; label: string };

export const CHUNK_CHARS = 6000;

export function rangeLabel(first: Page, last: Page): string {
  if (first.n === last.n) return first.label;
  const unit = first.label.replace(/\s*\d+$/, "").replace(/\.$/, "");
  return unit === "p" ? `p.${first.n}–${last.n}` : `${unit}s ${first.n}–${last.n}`;
}

export function chunkPages(pages: Page[], target = CHUNK_CHARS): Chunk[] {
  const usable = pages.filter((p) => p.text.replace(/\s/g, "").length >= 20);
  const groups: Page[][] = [];
  let cur: Page[] = [];
  let size = 0;
  for (const p of usable) {
    if (cur.length && size + p.text.length > target) {
      groups.push(cur);
      cur = [];
      size = 0;
    }
    cur.push(p);
    size += p.text.length;
  }
  if (cur.length) groups.push(cur);

  const out: Chunk[] = [];
  for (const g of groups) {
    const text = g.map((p) => (g.length > 1 ? `[${p.label}]\n${p.text}` : p.text)).join("\n\n");
    if (text.length <= target * 1.5) {
      out.push({ position: out.length, text, page: g[0].n, pageEnd: g[g.length - 1].n, label: rangeLabel(g[0], g[g.length - 1]) });
      continue;
    }
    // One very long page: cut at paragraph breaks.
    let piece = "";
    for (const para of text.split(/\n+/)) {
      if (piece && piece.length + para.length > target) {
        out.push({ position: out.length, text: piece, page: g[0].n, pageEnd: g[0].n, label: g[0].label });
        piece = "";
      }
      piece = piece ? `${piece}\n${para}` : para.slice(0, target * 2);
    }
    if (piece) out.push({ position: out.length, text: piece, page: g[0].n, pageEnd: g[0].n, label: g[0].label });
  }
  return out;
}

/**
 * Shares today's AI-question allowance across chunks in proportion to their text,
 * aiming for one question per ~250 characters and 6–20 per chunk (brief: 10–20 per call).
 */
export function questionTargets(chunks: { text: string }[], budget: number): number[] {
  const want = chunks.map((c) => Math.min(20, Math.max(6, Math.round(c.text.length / 250))));
  const total = want.reduce((s, n) => s + n, 0);
  if (total <= budget) return want;
  if (budget <= 0) return want.map(() => 0);
  const scaled = want.map((n) => Math.floor((n * budget) / total));
  let left = budget - scaled.reduce((s, n) => s + n, 0);
  for (let i = 0; left > 0; i = (i + 1) % scaled.length, left--) scaled[i]++;
  return scaled;
}

/** Flashcards per chunk: about half the questions, at least 4 (flashcards don't count against the AI-question limit). */
export function flashcardTarget(chunkText: string, questions: number): number {
  return Math.min(12, Math.max(4, Math.round(Math.max(questions, chunkText.length / 300) / 2)));
}
