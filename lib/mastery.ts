/** Mastery scale (design brief): weak → shaky → good → mastered. Always shown with a label, never colour alone. */
export type MasteryLabel = "weak" | "shaky" | "good" | "mastered";

/** Thresholds from the design hand-off (<0.34 weak, <0.6 shaky, <1 good, 1 mastered). Tune with real data. */
export function masteryLabel(ratio: number): MasteryLabel {
  if (ratio < 0.34) return "weak";
  if (ratio < 0.6) return "shaky";
  if (ratio < 1) return "good";
  return "mastered";
}

export const MASTERY_COLOR: Record<MasteryLabel, string> = {
  weak: "var(--wrong)",
  shaky: "var(--flag)",
  good: "var(--accent)",
  mastered: "var(--correct)",
};

/** Brief: mastery per topic from recent answers, weighted to the latest 20 per topic. */
export const MASTERY_WINDOW = 20;

/**
 * Mastery from a topic's answers, newest first. Only the latest 20 count, and
 * newer answers weigh more (linearly: newest 20, oldest 1), so getting better
 * shows up quickly without one lucky answer flipping the label.
 */
export function masteryScore(answersNewestFirst: boolean[]): number {
  const recent = answersNewestFirst.slice(0, MASTERY_WINDOW);
  if (!recent.length) return 0;
  let weighted = 0;
  let total = 0;
  recent.forEach((correct, i) => {
    const w = MASTERY_WINDOW - i;
    total += w;
    if (correct) weighted += w;
  });
  return Math.round((weighted / total) * 1000) / 1000;
}
