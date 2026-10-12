import { describe, expect, it } from "vitest";
import { en } from "../i18n/en";
import { fr } from "../i18n/fr";
import type { Recommendation } from "../types";
import {
  formatRecommendationDescription,
  formatRecommendationDetail,
  formatScoreBreakdown,
} from "../ui/format-recommendation";

function rec(
  name: string,
  breakdown: Recommendation["breakdown"],
  overrides: Partial<Omit<Recommendation, "sessionModel" | "breakdown">> = {}
): Recommendation {
  return {
    sessionModel: { id: name, name },
    score: 0,
    breakdown,
    contextWindow: "standard",
    thinkingEffort: "medium",
    rationale: "ignored",
    badges: ["matched"],
    blendedPricePer1M: 1,
    costTier: "medium",
    ...overrides,
  };
}

const composer = rec(
  "Composer 2.5",
  { categoryFit: 1, complexityFit: 0.9, arena: 0.26, cost: 0.46 },
  { blendedPricePer1M: 1.5 }
);
const gpt = rec(
  "GPT-5.6 Sol Medium",
  { categoryFit: 0.91, complexityFit: 0.85, arena: 0.79, cost: 0.17 },
  { blendedPricePer1M: 6.5 }
);
const glm = rec(
  "GLM 5.3 Flash",
  { categoryFit: 0.13, complexityFit: 0.2, arena: 0, cost: 0.83 },
  { blendedPricePer1M: 0.24 }
);
const visible = [composer, gpt, glm];

describe("formatScoreBreakdown", () => {
  it("renders compact category/complexity/arena/cost/score line", () => {
    const row: Recommendation = {
      sessionModel: { id: "m", name: "M" },
      score: 0.72,
      breakdown: { categoryFit: 0.81, complexityFit: 0.7, arena: 0.9, cost: 0.55 },
      contextWindow: "medium",
      thinkingEffort: "low",
      rationale: "test",
      badges: ["matched"],
      blendedPricePer1M: 1,
      costTier: "medium",
    };
    expect(formatScoreBreakdown(row)).toBe(
      "score 0.72 · cat 0.81 · cx 0.70 · arena 0.90 · cost 0.55"
    );
  });
});

describe("formatRecommendationDescription", () => {
  it("renders context, thinking, and price for eval rows", () => {
    expect(formatRecommendationDescription(composer, en)).toBe(
      "standard context · medium thinking · $1.50/1M"
    );
    expect(formatRecommendationDescription(glm, fr)).toBe(
      "contexte standard · réflexion moyenne · $0.24/1M"
    );
  });

  it("omits enterprise from the description line", () => {
    const weakEnterprise = rec(
      "Corp Model",
      { categoryFit: 0.5, complexityFit: 0.5, arena: 0.5, cost: 0.5 },
      { badges: ["weak", "enterprise"] }
    );
    const line = formatRecommendationDescription(weakEnterprise, en);
    expect(line.toLowerCase()).not.toContain("enterprise");
  });

  it("uses unknown price when blended price is null", () => {
    const noPrice = rec(
      "No Price",
      { categoryFit: 1, complexityFit: 1, arena: 0, cost: 0.5 },
      { blendedPricePer1M: null }
    );
    expect(formatRecommendationDescription(noPrice, en)).toMatch(/unknown price$/);
  });
});

describe("formatRecommendationDetail", () => {
  it("renders English details for the three eval rows", () => {
    expect(formatRecommendationDetail(composer, visible, en)).toBe(
      "Best fit for this task, at a reasonable price."
    );
    expect(formatRecommendationDetail(gpt, visible, en)).toBe(
      "Strong fit, and well ranked in comparisons. Pricier."
    );
    expect(formatRecommendationDetail(glm, visible, en)).toBe(
      "The cheapest. Weaker fit for this task."
    );
  });

  it("renders French details for the three eval rows", () => {
    expect(formatRecommendationDetail(composer, visible, fr)).toBe(
      "Meilleur choix pour cette tâche, à un prix raisonnable."
    );
    expect(formatRecommendationDetail(gpt, visible, fr)).toBe(
      "Bon alignement, et bien classé dans les comparaisons. Plus cher."
    );
    expect(formatRecommendationDetail(glm, visible, fr)).toBe(
      "Le moins cher. Alignement plus faible pour cette tâche."
    );
  });

  it("returns weak sentence for weak badge regardless of breakdown", () => {
    const weakEnterprise = rec(
      "Corp Model",
      { categoryFit: 0.9, complexityFit: 0.9, arena: 0.9, cost: 0.9 },
      { badges: ["weak", "enterprise"] }
    );
    expect(formatRecommendationDetail(weakEnterprise, [weakEnterprise], en)).toBe(
      "No reliable benchmark."
    );
  });

  it("uses strong fit when tied on category fit without best fit", () => {
    const atOne = rec(
      "A",
      { categoryFit: 0.8, complexityFit: 0.5, arena: 0, cost: 0.5 },
      { blendedPricePer1M: 1 }
    );
    const atTwo = rec(
      "B",
      { categoryFit: 0.8, complexityFit: 0.5, arena: 0, cost: 0.5 },
      { blendedPricePer1M: 2 }
    );
    const pair = [atOne, atTwo];
    expect(formatRecommendationDetail(atOne, pair, en)).toContain("Strong fit");
    expect(formatRecommendationDetail(atOne, pair, en)).not.toContain("Best fit");
    expect(formatRecommendationDetail(atTwo, pair, en)).toContain("Strong fit");
    expect(formatRecommendationDetail(atTwo, pair, en)).not.toContain("Best fit");
  });

  it("treats sole visible row as best fit at reasonable price", () => {
    const solo = rec(
      "Solo",
      { categoryFit: 1, complexityFit: 1, arena: 0, cost: 0.5 },
      { blendedPricePer1M: 3 }
    );
    expect(formatRecommendationDetail(solo, [solo], en)).toBe(
      "Best fit for this task, at a reasonable price."
    );
  });
});
