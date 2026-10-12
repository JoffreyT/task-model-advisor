import { describe, expect, it } from "vitest";
import { matchModels, type MatchedModel } from "../matching/model-matcher";
import {
  absoluteCostScore,
  rankRecommendations,
  selectRecommendations,
} from "../ranking/task-ranker";
import type { BenchmarkModel, Recommendation } from "../types";

function rank(
  matched: MatchedModel[],
  overrides: Partial<Parameters<typeof rankRecommendations>[0]> = {}
) {
  return rankRecommendations({
    matched,
    arena: [],
    categoryId: "development",
    complexity: "intermediate",
    reasoningModelPatterns: [],
    ...overrides,
  });
}

describe("rankRecommendations", () => {
  it("prefers high coding index for development among matched models", () => {
    const matched: MatchedModel[] = [
      {
        session: { id: "a", name: "Cheap Coder" },
        benchmark: {
          slug: "cheap-coder",
          name: "Cheap Coder",
          coding: 90,
          intelligence: 40,
          blendedPricePer1M: 1,
          evaluations: { livecodebench: 0.8 },
        },
        score: 1,
        badges: ["matched"],
      },
      {
        session: { id: "b", name: "Smart Writer" },
        benchmark: {
          slug: "smart-writer",
          name: "Smart Writer",
          coding: 20,
          intelligence: 95,
          blendedPricePer1M: 10,
          evaluations: {},
        },
        score: 1,
        badges: ["matched"],
      },
    ];
    const top = rank(matched, {
      arena: [{ model: "Cheap Coder", rank: 1, score: 1200 }],
      reasoningModelPatterns: ["o1", "o3"],
    });
    expect(top[0].sessionModel.id).toBe("a");
    expect(top.length).toBeLessThanOrEqual(3);
  });

  it("fills with weak matches when fewer than 3 matched", () => {
    const matched = [
      {
        session: { id: "only", name: "Only" },
        benchmark: {
          slug: "only",
          name: "Only",
          intelligence: 50,
          blendedPricePer1M: 2,
          evaluations: {},
        },
        score: 1,
        badges: ["matched" as const],
      },
      {
        session: { id: "weak1", name: "Weak One" },
        benchmark: null,
        score: 0,
        badges: ["weak" as const],
      },
      {
        session: { id: "weak2", name: "Weak Two" },
        benchmark: null,
        score: 0,
        badges: ["weak" as const],
      },
    ];
    const top = rank(matched, { categoryId: "analysisDoc" });
    expect(top).toHaveLength(3);
    expect(top.some((r) => r.badges.includes("weak"))).toBe(true);
  });

  it("bumps thinking for reasoning model patterns", () => {
    const matched = [
      {
        session: { id: "o3-mini", name: "o3-mini" },
        benchmark: {
          slug: "o3-mini",
          name: "o3-mini",
          intelligence: 80,
          blendedPricePer1M: 5,
          evaluations: {},
        },
        score: 1,
        badges: ["matched" as const],
      },
    ];
    const top = rank(matched, {
      categoryId: "quickCheap",
      complexity: "basic",
      reasoningModelPatterns: ["o3"],
    });
    expect(top[0].thinkingEffort).not.toBe("low");
  });

  it("prefers higher intelligence for analysisDoc", () => {
    const matched = [
      {
        session: { id: "smart", name: "Smart" },
        benchmark: {
          slug: "smart",
          name: "Smart",
          intelligence: 90,
          blendedPricePer1M: 5,
          evaluations: {},
        },
        score: 1,
        badges: ["matched" as const],
      },
      {
        session: { id: "cheap", name: "Cheap" },
        benchmark: {
          slug: "cheap",
          name: "Cheap",
          intelligence: 40,
          blendedPricePer1M: 1,
          evaluations: {},
        },
        score: 1,
        badges: ["matched" as const],
      },
    ];
    const top = rank(matched, { categoryId: "analysisDoc", complexity: "advanced" });
    expect(top[0].sessionModel.id).toBe("smart");
  });

  it("uses Elo-only normalization when any arena score exists (null scores → 0)", () => {
    const matched = [
      {
        session: { id: "with-elo", name: "Model With Elo" },
        benchmark: {
          slug: "model-with-elo",
          name: "Model With Elo",
          intelligence: 50,
          blendedPricePer1M: 1,
          evaluations: {},
        },
        score: 1,
        badges: ["matched" as const],
      },
      {
        session: { id: "no-elo", name: "Model No Elo" },
        benchmark: {
          slug: "model-no-elo",
          name: "Model No Elo",
          intelligence: 50,
          blendedPricePer1M: 1,
          evaluations: {},
        },
        score: 1,
        badges: ["matched" as const],
      },
    ];
    const top = rank(matched, {
      categoryId: "testingReview",
      arena: [
        { model: "Model With Elo", rank: 2, score: 1000 },
        { model: "Model No Elo", rank: 1, score: null },
      ],
    });
    const withElo = top.find((r) => r.sessionModel.id === "with-elo");
    const noElo = top.find((r) => r.sessionModel.id === "no-elo");
    expect(withElo?.breakdown.arena).toBe(1);
    expect(noElo?.breakdown.arena).toBe(0);
    expect(top[0].sessionModel.id).toBe("with-elo");
  });

  it("prefers cheaper models for quickCheap at basic complexity", () => {
    const matched = [
      {
        session: { id: "expensive", name: "Expensive" },
        benchmark: {
          slug: "expensive",
          name: "Expensive",
          intelligence: 80,
          blendedPricePer1M: 20,
          evaluations: {},
        },
        score: 1,
        badges: ["matched" as const],
      },
      {
        session: { id: "cheap", name: "Cheap" },
        benchmark: {
          slug: "cheap",
          name: "Cheap",
          intelligence: 80,
          blendedPricePer1M: 0.5,
          evaluations: {},
        },
        score: 1,
        badges: ["matched" as const],
      },
    ];
    const top = rank(matched, { categoryId: "quickCheap", complexity: "basic" });
    expect(top[0].sessionModel.id).toBe("cheap");
  });

  it("returns at most three and includes rationale", () => {
    const matched = Array.from({ length: 5 }, (_, i) => ({
      session: { id: `m${i}`, name: `Model ${i}` },
      benchmark: {
        slug: `m${i}`,
        name: `Model ${i}`,
        intelligence: 50 + i * 10,
        blendedPricePer1M: 1,
        evaluations: {},
      },
      score: 1,
      badges: ["matched" as const],
    }));
    const top = rank(matched, { categoryId: "testingReview" });
    expect(top).toHaveLength(3);
    expect(top[0].rationale.length).toBeGreaterThan(0);
    expect(top[0].breakdown).toMatchObject({
      categoryFit: expect.any(Number),
      complexityFit: expect.any(Number),
      arena: expect.any(Number),
      cost: expect.any(Number),
    });
  });

  it("caps context window tier from benchmark token limit", () => {
    const matched = [
      {
        session: { id: "small-ctx", name: "Small Ctx" },
        benchmark: {
          slug: "small-ctx",
          name: "Small Ctx",
          intelligence: 70,
          blendedPricePer1M: 2,
          contextWindowTokens: 32_000,
          evaluations: {},
        },
        score: 1,
        badges: ["matched" as const],
      },
    ];
    const top = rank(matched, { categoryId: "analysisDoc" });
    expect(top[0].contextWindow).toBe("standard");
  });

  it("sets category default context and thinking", () => {
    const matched = [
      {
        session: { id: "plain", name: "Plain" },
        benchmark: {
          slug: "plain",
          name: "Plain",
          intelligence: 70,
          blendedPricePer1M: 2,
          evaluations: {},
        },
        score: 1,
        badges: ["matched" as const],
      },
    ];
    const analysisTop = rank(matched, { categoryId: "analysisDoc", complexity: "intermediate" });
    expect(analysisTop[0].contextWindow).toBe("high");
    expect(analysisTop[0].thinkingEffort).toBe("medium");

    const devTop = rank(matched, { categoryId: "development", complexity: "intermediate" });
    expect(devTop[0].contextWindow).toBe("standard");
  });

  it("quickCheap defaults to standard context and low thinking on basic", () => {
    const matched = [
      {
        session: { id: "plain", name: "Plain" },
        benchmark: {
          slug: "plain",
          name: "Plain",
          intelligence: 70,
          blendedPricePer1M: 2,
          evaluations: {},
        },
        score: 1,
        badges: ["matched" as const],
      },
    ];
    const top = rank(matched, { categoryId: "quickCheap", complexity: "basic" });
    expect(top[0].contextWindow).toBe("standard");
    expect(top[0].thinkingEffort).toBe("low");
  });

  it("weak entries rank after matched and sort by name", () => {
    const matched = [
      {
        session: { id: "z-weak", name: "Z Weak" },
        benchmark: null,
        score: 0,
        badges: ["weak" as const],
      },
      {
        session: { id: "a-weak", name: "A Weak" },
        benchmark: null,
        score: 0,
        badges: ["weak" as const],
      },
      {
        session: { id: "best", name: "Best" },
        benchmark: {
          slug: "best",
          name: "Best",
          intelligence: 99,
          blendedPricePer1M: 1,
          evaluations: {},
        },
        score: 1,
        badges: ["matched" as const],
      },
    ];
    const top = rank(matched, { categoryId: "analysisDoc" });
    expect(top[0].sessionModel.id).toBe("best");
    expect(top[1].sessionModel.id).toBe("a-weak");
    expect(top[2].sessionModel.id).toBe("z-weak");
  });

  it("matches arena via normalized model keys", () => {
    const matched = [
      {
        session: { id: "gpt-4o-ent", name: "GPT-4o (Entreprise)" },
        benchmark: {
          slug: "gpt-4o",
          name: "GPT-4o",
          intelligence: 60,
          blendedPricePer1M: 1,
          evaluations: {},
        },
        score: 1,
        badges: ["matched" as const, "enterprise" as const],
      },
    ];
    const top = rank(matched, {
      categoryId: "analysisDoc",
      arena: [{ model: "gpt-4o", rank: 1, score: 1100 }],
    });
    expect(top[0].breakdown.arena).toBeGreaterThan(0);
  });

  it("does not let an ultra-cheap weaker model beat a clearly stronger one on analysisDoc", () => {
    const matched = [
      {
        session: { id: "flash", name: "Flash Cheap" },
        benchmark: {
          slug: "flash-cheap",
          name: "Flash Cheap",
          intelligence: 70,
          blendedPricePer1M: 0.24,
          evaluations: {},
        },
        score: 1,
        badges: ["matched" as const],
      },
      {
        session: { id: "opus", name: "Opus Strong" },
        benchmark: {
          slug: "opus-strong",
          name: "Opus Strong",
          intelligence: 95,
          blendedPricePer1M: 8,
          evaluations: {},
        },
        score: 1,
        badges: ["matched" as const],
      },
    ];
    const top = rank(matched, {
      categoryId: "analysisDoc",
      complexity: "advanced",
      arena: [
        { model: "Flash Cheap", rank: 2, score: 1100 },
        { model: "Opus Strong", rank: 1, score: 1250 },
      ],
    });
    expect(top[0].sessionModel.id).toBe("opus");
    expect(top[0].breakdown.cost).toBeLessThan(0.5);
    expect(top[1].breakdown.cost).toBeGreaterThan(0.5);
  });

  it("extends the same top 3 when limit is above 3", () => {
    const matched = [50, 40, 30, 20, 10].map((intelligence) => ({
      session: { id: `m${intelligence}`, name: `m${intelligence}` },
      benchmark: {
        slug: `m${intelligence}`,
        name: `m${intelligence}`,
        intelligence,
        blendedPricePer1M: 5,
        evaluations: {},
      },
      score: 1,
      badges: ["matched" as const],
    }));
    const input = {
      matched,
      arena: [],
      categoryId: "testingReview" as const,
      complexity: "intermediate" as const,
      reasoningModelPatterns: [],
    };
    const head = rankRecommendations(input).map((row) => row.sessionModel.id);
    const extended = rankRecommendations({ ...input, limit: 5 });
    expect(head).toEqual(["m50", "m40", "m30"]);
    expect(extended.map((row) => row.sessionModel.id).slice(0, 3)).toEqual(head);
    expect(extended.map((row) => row.sessionModel.id)).toEqual(["m50", "m40", "m30", "m20", "m10"]);
  });

  it("prefers frontier models for autonomousAgent at expert complexity", () => {
    const matched = [
      {
        session: { id: "flash", name: "Flash" },
        benchmark: {
          slug: "flash",
          name: "Flash",
          intelligence: 60,
          coding: 55,
          blendedPricePer1M: 0.3,
          evaluations: { artificial_analysis_agentic_index: 20 },
        },
        score: 1,
        badges: ["matched" as const],
      },
      {
        session: { id: "agent", name: "Agent Pro" },
        benchmark: {
          slug: "agent",
          name: "Agent Pro",
          intelligence: 92,
          coding: 88,
          blendedPricePer1M: 8,
          evaluations: { artificial_analysis_agentic_index: 85 },
        },
        score: 1,
        badges: ["matched" as const],
      },
    ];
    const top = rank(matched, { categoryId: "autonomousAgent", complexity: "expert" });
    expect(top[0].sessionModel.id).toBe("agent");
  });
});

describe("absoluteCostScore", () => {
  it("scores cheaper models higher with a meaningful but non-binary gap", () => {
    const flash = absoluteCostScore(0.24);
    const mid = absoluteCostScore(1.5);
    const opus = absoluteCostScore(8);
    expect(flash).toBeGreaterThan(mid);
    expect(mid).toBeGreaterThan(opus);
    expect(flash).toBeGreaterThan(0.7);
    expect(opus).toBeLessThan(0.25);
    expect(flash - opus).toBeLessThan(0.9);
    expect(flash - opus).toBeGreaterThan(0.4);
  });
});

describe("matcher + ranker integration", () => {
  const benches: BenchmarkModel[] = [
    {
      slug: "gpt-4o",
      name: "GPT-4o",
      intelligence: 85,
      coding: 70,
      blendedPricePer1M: 5,
      evaluations: {},
    },
    {
      slug: "gpt-4o-mini",
      name: "GPT-4o mini",
      intelligence: 70,
      coding: 65,
      blendedPricePer1M: 0.3,
      evaluations: {},
    },
    {
      slug: "claude-3-5-sonnet",
      name: "Claude 3.5 Sonnet",
      intelligence: 88,
      coding: 75,
      blendedPricePer1M: 6,
      evaluations: {},
    },
    {
      slug: "deepseek-coder",
      name: "DeepSeek Coder",
      intelligence: 75,
      coding: 92,
      blendedPricePer1M: 0.4,
      evaluations: { livecodebench: 0.85 },
    },
  ];

  it("ranks alias-matched enterprise mini for quickCheap basic", () => {
    const matched = matchModels(
      [{ id: "copilot-gpt-4o-mini-enterprise", name: "GPT-4o mini entreprise" }],
      benches,
      { "copilot-gpt-4o-mini-enterprise": "gpt-4o-mini" },
      0.72
    );
    const top = rankRecommendations({
      matched,
      arena: [],
      categoryId: "quickCheap",
      complexity: "basic",
      reasoningModelPatterns: [],
    });
    expect(top[0].sessionModel.id).toBe("copilot-gpt-4o-mini-enterprise");
    expect(top[0].badges).toContain("matched");
  });

  it("ranks deepseek first for development after fuzzy match", () => {
    const session = [{ id: "x", name: "DeepSeek Coder" }];
    const matched = matchModels(session, benches, {}, 0.72);
    const top = rankRecommendations({
      matched,
      arena: [{ model: "DeepSeek Coder", rank: 1, score: 1250 }],
      categoryId: "development",
      complexity: "intermediate",
      reasoningModelPatterns: [],
    });
    expect(matched[0].benchmark?.slug).toBe("deepseek-coder");
    expect(top[0].sessionModel.name).toBe("DeepSeek Coder");
  });

  it("fills top 3 with weak when only one fuzzy match", () => {
    const session = [
      { id: "a", name: "GPT-4o" },
      { id: "b", name: "Unknown Corp LLM" },
      { id: "c", name: "Another Unknown" },
    ];
    const matched = matchModels(session, benches, {}, 0.72);
    const top = rankRecommendations({
      matched,
      arena: [],
      categoryId: "analysisDoc",
      complexity: "intermediate",
      reasoningModelPatterns: [],
    });
    expect(top).toHaveLength(3);
    expect(top[0].badges).toContain("matched");
    expect(top.some((r) => r.badges.includes("weak"))).toBe(true);
  });
});

function recommendation(id: string, score: number, price: number, cost: number): Recommendation {
  return {
    sessionModel: { id, name: id },
    score,
    breakdown: { categoryFit: score, complexityFit: score, arena: 0, cost },
    contextWindow: "standard",
    thinkingEffort: "low",
    rationale: "",
    badges: ["matched"],
    blendedPricePer1M: price,
    costTier: "medium",
  };
}

describe("selectRecommendations", () => {
  const ranked = [
    recommendation("a", 5, 10, 0.08),
    recommendation("b", 4, 10, 0.08),
    recommendation("c", 3, 10, 0.08),
    recommendation("d", 2, 1, 0.54),
    recommendation("e", 1, 10, 0.08),
  ];

  it("keeps the diversified top 3 when limit is omitted or invalid", () => {
    const top3 = ["a", "b", "d"];
    expect(selectRecommendations(ranked).map((row) => row.sessionModel.id)).toEqual(top3);
    expect(selectRecommendations(ranked, 3).map((row) => row.sessionModel.id)).toEqual(top3);
    expect(selectRecommendations(ranked, 2).map((row) => row.sessionModel.id)).toEqual(top3);
    expect(selectRecommendations(ranked, 11).map((row) => row.sessionModel.id)).toEqual(top3);
    expect(selectRecommendations(ranked, 3.5).map((row) => row.sessionModel.id)).toEqual(top3);
  });

  it("appends later models by rank without moving the top 3", () => {
    expect(selectRecommendations(ranked, 4).map((row) => row.sessionModel.id)).toEqual([
      "a",
      "b",
      "d",
      "c",
    ]);
    expect(selectRecommendations(ranked, 5).map((row) => row.sessionModel.id)).toEqual([
      "a",
      "b",
      "d",
      "c",
      "e",
    ]);
  });

  it("returns every model when the list is shorter than the limit", () => {
    const short = ranked.slice(0, 2);
    expect(selectRecommendations(short, 5).map((row) => row.sessionModel.id)).toEqual(["a", "b"]);
  });
});
