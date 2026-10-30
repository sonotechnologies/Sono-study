/** Pure result computations for the results screen: topic breakdown, copy, XP. */
import { masteryLabel, type MasteryLabel } from "@/lib/mastery";

export type TopicResult = { topicId: string | null; name: string; correct: number; total: number; label: MasteryLabel };

/** Per-topic score for one attempt, weakest first (then most questions, then name). */
export function topicBreakdown(items: { topicId: string | null; topicName: string | null; isCorrect: boolean }[]): TopicResult[] {
  const byTopic = new Map<string, TopicResult>();
  for (const it of items) {
    const key = it.topicId ?? "none";
    const row = byTopic.get(key) ?? { topicId: it.topicId, name: it.topicName ?? "Other", correct: 0, total: 0, label: "weak" as MasteryLabel };
    row.total += 1;
    if (it.isCorrect) row.correct += 1;
    byTopic.set(key, row);
  }
  return [...byTopic.values()]
    .map((r) => ({ ...r, label: masteryLabel(r.correct / r.total) }))
    .sort((a, b) => a.correct / a.total - b.correct / b.total || b.total - a.total || a.name.localeCompare(b.name));
}

/** Topics to fix first: weak or shaky, weakest first, at most three. */
export function topicsToFix(topics: TopicResult[]): TopicResult[] {
  return topics.filter((t) => t.label === "weak" || t.label === "shaky").slice(0, 3);
}

/** Copy rules from the hand-off: encouraging, short, never shames. */
export function resultLine(r: { score: number; max: number; prevBest: number | null; weakTopics: number }): string {
  if (r.max > 0 && r.score >= r.max) return "Full marks. Your future self says thanks.";
  if (r.prevBest !== null && r.score > r.prevBest) {
    return `New best, up ${formatScore(r.score - r.prevBest)} on your last try. That's the work paying off.`;
  }
  if (r.weakTopics > 0) {
    return `Now we know where to focus — ${r.weakTopics} topic${r.weakTopics === 1 ? "" : "s"} to fix first.`;
  }
  return "Solid run. Review the misses and go again.";
}

/** XP (placeholder formula from the prototype): 20 for finishing + 4 per correct answer. Practice earns 2 per correct. */
export function xpFor(mode: "mock" | "practice" | "challenge", correct: number): number {
  if (mode === "practice") return 2 * Math.floor(correct);
  return 20 + 4 * Math.floor(correct);
}

/** 14 → "14", 13.5 → "13.5" (partial marks on multiple-answer questions). */
export function formatScore(n: number): string {
  return Number.isInteger(n) ? String(n) : String(Math.round(n * 10) / 10);
}
