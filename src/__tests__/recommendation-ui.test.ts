import { describe, expect, it } from "vitest";
import { formatScoreBreakdown } from "../ui/format-recommendation";
import type { Recommendation } from "../types";

describe("formatScoreBreakdown", () => {
  it("renders compact fit/arena/cost/score line", () => {
    const rec: Recommendation = {
      sessionModel: { id: "m", name: "M" },
      score: 0.72,
      breakdown: { taskFit: 0.81, arena: 0.9, cost: 0.55 },
      contextWindow: "medium",
      thinkingEffort: "low",
      rationale: "test",
      badges: ["matched"],
      blendedPricePer1M: 1,
      costTier: "medium",
    };
    expect(formatScoreBreakdown(rec)).toBe("score 0.72 · fit 0.81 · arena 0.90 · cost 0.55");
  });
});
