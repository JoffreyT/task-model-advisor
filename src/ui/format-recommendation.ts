import type { Recommendation } from "../types";

/** Compact score line for QuickPick (fit / arena / cost / total). */
export function formatScoreBreakdown(rec: Recommendation): string {
  const { taskFit, arena, cost } = rec.breakdown;
  return `score ${rec.score.toFixed(2)} · fit ${taskFit.toFixed(2)} · arena ${arena.toFixed(2)} · cost ${cost.toFixed(2)}`;
}
