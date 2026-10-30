/** Verdict copy for theory grading (shared by the server and the 2o screen). */

export function verdictFor(score: number, max: number): string {
  const r = max ? score / max : 0;
  if (r >= 0.85) return "Excellent";
  if (r >= 0.65) return "Strong answer";
  if (r >= 0.45) return "Good start";
  if (r > 0) return "Needs more";
  return "Not there yet";
}

/** One line under the verdict, like design 2o's "Right barriers, thin explanations." */
export function verdictLine(covered: number, missed: number): string {
  if (!missed) return "Every point in the marking guide.";
  if (!covered) return "None of the marking points yet. Start with the definitions.";
  if (covered >= missed) return "Most points there. Add what's missing for full marks.";
  return "Some points there, but the key ones are missing.";
}
