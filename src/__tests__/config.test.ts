import { describe, expect, it } from "vitest";
import {
  APPLY_STRATEGY,
  ARENA_CATEGORIES,
  ARENA_SOURCE,
  FETCH_TIMEOUT_MS,
  FUZZY_THRESHOLD,
  RANKING_WEIGHTS,
  REASONING_MODEL_PATTERNS,
} from "../constants";
import { resolveConfig } from "../config";

describe("resolveConfig", () => {
  it("uses extension constants when raw is empty", () => {
    const c = resolveConfig({});
    expect(c.arena.source).toBe(ARENA_SOURCE);
    expect(c.arena.categories).toEqual(ARENA_CATEGORIES);
    expect(c.ranking.weights).toEqual(RANKING_WEIGHTS);
    expect(c.modelAliases).toEqual({});
    expect(c.matching.fuzzyThreshold).toBe(FUZZY_THRESHOLD);
    expect(c.applyStrategy).toBe(APPLY_STRATEGY);
    expect(c.fetch.timeoutMs).toBe(FETCH_TIMEOUT_MS);
    expect(c.reasoningModelPatterns).toEqual(REASONING_MODEL_PATTERNS);
    expect(c.artificialAnalysis.apiKey).toBe("");
    expect(c.cursor.apiKey).toBe("");
  });

  it("ignores overrides of internal constants", () => {
    const c = resolveConfig({
      ranking: { weights: { taskFit: 0.7, arena: 0.2, cost: 0.1 } },
      fetch: { timeoutMs: 1 },
      matching: { fuzzyThreshold: 0.1 },
      applyStrategy: "clipboard-only",
    });
    expect(c.ranking.weights).toEqual(RANKING_WEIGHTS);
    expect(c.fetch.timeoutMs).toBe(FETCH_TIMEOUT_MS);
    expect(c.matching.fuzzyThreshold).toBe(FUZZY_THRESHOLD);
    expect(c.applyStrategy).toBe(APPLY_STRATEGY);
  });

  it("overrides api keys", () => {
    const c = resolveConfig({
      artificialAnalysis: { apiKey: "aa" },
      cursor: { apiKey: "cursor" },
    });
    expect(c.artificialAnalysis.apiKey).toBe("aa");
    expect(c.cursor.apiKey).toBe("cursor");
  });
});
