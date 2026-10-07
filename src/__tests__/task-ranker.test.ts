import { describe, it, expect } from "vitest";
import {
  absoluteCostScore,
  rankRecommendations,
  resolveEngineWeights,
} from "../ranking/task-ranker";
import { matchModels } from "../matching/model-matcher";

describe("resolveEngineWeights", () => {
  const base = { taskFit: 0.45, arena: 0.25, cost: 0.3 };
  it("tilts writing toward taskFit", () => {
    expect(resolveEngineWeights("writing", base)).toEqual({
      taskFit: 0.5,
      arena: 0.25,
      cost: 0.25,
    });
  });
  it("tilts coding toward cost", () => {
    expect(resolveEngineWeights("coding", base)).toEqual({
      taskFit: 0.45,
      arena: 0.2,
      cost: 0.35,
    });
  });
  it("tilts cheap strongly toward cost", () => {
    expect(resolveEngineWeights("cheap", base)).toEqual({
      taskFit: 0.35,
      arena: 0.2,
      cost: 0.45,
    });
  });
  it("leaves reasoning and balanced at base", () => {
    expect(resolveEngineWeights("reasoning", base)).toEqual(base);
    expect(resolveEngineWeights("balanced", base)).toEqual(base);
  });
});

describe("rankRecommendations", () => {
  it("prefers high coding index for coding engine among matched models", () => {
    const matched = [
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
        badges: ["matched" as const],
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
        badges: ["matched" as const],
      },
    ];
    const top = rankRecommendations({
      matched,
      arena: [{ model: "Cheap Coder", rank: 1, score: 1200 }],
      engineId: "coding",
      weights: { taskFit: 0.45, arena: 0.25, cost: 0.3 },
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
    const top = rankRecommendations({
      matched,
      arena: [],
      engineId: "writing",
      weights: { taskFit: 0.45, arena: 0.25, cost: 0.3 },
      reasoningModelPatterns: [],
    });
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
    const top = rankRecommendations({
      matched,
      arena: [],
      engineId: "cheap",
      weights: { taskFit: 1, arena: 0, cost: 0 },
      reasoningModelPatterns: ["o3"],
    });
    expect(top[0].thinkingEffort).not.toBe("low");
  });

  it("prefers higher intelligence for writing engine", () => {
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
    const top = rankRecommendations({
      matched,
      arena: [],
      engineId: "writing",
      weights: { taskFit: 1, arena: 0, cost: 0 },
      reasoningModelPatterns: [],
    });
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
    const top = rankRecommendations({
      matched,
      arena: [
        { model: "Model With Elo", rank: 2, score: 1000 },
        { model: "Model No Elo", rank: 1, score: null },
      ],
      engineId: "reasoning",
      weights: { taskFit: 0, arena: 1, cost: 0 },
      reasoningModelPatterns: [],
    });
    const withElo = top.find((r) => r.sessionModel.id === "with-elo");
    const noElo = top.find((r) => r.sessionModel.id === "no-elo");
    expect(withElo?.breakdown.arena).toBe(1);
    expect(noElo?.breakdown.arena).toBe(0);
    expect(top[0].sessionModel.id).toBe("with-elo");
  });

  it("uses arena Elo when scores present", () => {
    const matched = [
      {
        session: { id: "low", name: "Model A" },
        benchmark: {
          slug: "model-a",
          name: "Model A",
          intelligence: 50,
          blendedPricePer1M: 1,
          evaluations: {},
        },
        score: 1,
        badges: ["matched" as const],
      },
      {
        session: { id: "high", name: "Model B" },
        benchmark: {
          slug: "model-b",
          name: "Model B",
          intelligence: 50,
          blendedPricePer1M: 1,
          evaluations: {},
        },
        score: 1,
        badges: ["matched" as const],
      },
    ];
    const top = rankRecommendations({
      matched,
      arena: [
        { model: "Model A", rank: 2, score: 1000 },
        { model: "Model B", rank: 1, score: 1300 },
      ],
      engineId: "reasoning",
      weights: { taskFit: 0, arena: 1, cost: 0 },
      reasoningModelPatterns: [],
    });
    expect(top[0].sessionModel.id).toBe("high");
  });

  it("prefers cheaper models when cost weight dominates", () => {
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
    const top = rankRecommendations({
      matched,
      arena: [],
      engineId: "cheap",
      weights: { taskFit: 0, arena: 0, cost: 1 },
      reasoningModelPatterns: [],
    });
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
    const top = rankRecommendations({
      matched,
      arena: [],
      engineId: "balanced",
      weights: { taskFit: 1, arena: 0, cost: 0 },
      reasoningModelPatterns: [],
    });
    expect(top).toHaveLength(3);
    expect(top[0].rationale.length).toBeGreaterThan(0);
    expect(top[0].breakdown).toMatchObject({
      taskFit: expect.any(Number),
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
    const top = rankRecommendations({
      matched,
      arena: [],
      engineId: "writing",
      weights: { taskFit: 1, arena: 0, cost: 0 },
      reasoningModelPatterns: [],
    });
    expect(top[0].contextWindow).toBe("standard");
  });

  it("bumps context one tier for large-codebase custom text", () => {
    const matched = [
      {
        session: { id: "plain", name: "Plain" },
        benchmark: {
          slug: "plain",
          name: "Plain",
          intelligence: 70,
          blendedPricePer1M: 2,
          contextWindowTokens: 200_000,
          evaluations: {},
        },
        score: 1,
        badges: ["matched" as const],
      },
    ];
    const top = rankRecommendations({
      matched,
      arena: [],
      engineId: "coding",
      weights: { taskFit: 1, arena: 0, cost: 0 },
      reasoningModelPatterns: [],
      customText: "refactor a large monorepo codebase",
    });
    expect(top[0].contextWindow).toBe("medium");
  });

  it("sets engine default context and thinking without reasoning bump", () => {
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
    const writingTop = rankRecommendations({
      matched,
      arena: [],
      engineId: "writing",
      weights: { taskFit: 1, arena: 0, cost: 0 },
      reasoningModelPatterns: [],
    });
    expect(writingTop[0].contextWindow).toBe("high");
    expect(writingTop[0].thinkingEffort).toBe("medium");

    const codingTop = rankRecommendations({
      matched,
      arena: [],
      engineId: "coding",
      weights: { taskFit: 1, arena: 0, cost: 0 },
      reasoningModelPatterns: [],
    });
    expect(codingTop[0].contextWindow).toBe("standard");
  });

  it("cheap engine defaults to standard context and low thinking", () => {
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
    const top = rankRecommendations({
      matched,
      arena: [],
      engineId: "cheap",
      weights: { taskFit: 1, arena: 0, cost: 0 },
      reasoningModelPatterns: [],
    });
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
    const top = rankRecommendations({
      matched,
      arena: [],
      engineId: "writing",
      weights: { taskFit: 1, arena: 0, cost: 0 },
      reasoningModelPatterns: [],
    });
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
    const top = rankRecommendations({
      matched,
      arena: [{ model: "gpt-4o", rank: 1, score: 1100 }],
      engineId: "writing",
      weights: { taskFit: 0, arena: 1, cost: 0 },
      reasoningModelPatterns: [],
    });
    expect(top[0].breakdown.arena).toBeGreaterThan(0);
  });

  it("does not let an ultra-cheap weaker model beat a clearly stronger one", () => {
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
    const top = rankRecommendations({
      matched,
      arena: [
        { model: "Flash Cheap", rank: 2, score: 1100 },
        { model: "Opus Strong", rank: 1, score: 1250 },
      ],
      engineId: "writing",
      weights: { taskFit: 0.45, arena: 0.25, cost: 0.3 },
      reasoningModelPatterns: [],
    });
    expect(top[0].sessionModel.id).toBe("opus");
    // Absolute log cost: gap is moderate, not a forced 1.0 vs 0.0
    expect(top[0].breakdown.cost).toBeLessThan(0.5);
    expect(top[1].breakdown.cost).toBeGreaterThan(0.5);
    expect(top[1].breakdown.cost - top[0].breakdown.cost).toBeLessThan(0.85);
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
    // Still far from the old min-max 1.0 vs 0.0 on 1/price
    expect(flash - opus).toBeLessThan(0.9);
    expect(flash - opus).toBeGreaterThan(0.4);
  });
});

describe("matcher + ranker integration", () => {
  const benches = [
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

  it("ranks alias-matched enterprise mini for cost-sensitive userStory", () => {
    const matched = matchModels(
      [{ id: "copilot-gpt-4o-mini-enterprise", name: "GPT-4o mini entreprise" }],
      benches,
      { "copilot-gpt-4o-mini-enterprise": "gpt-4o-mini" },
      0.72
    );
    const top = rankRecommendations({
      matched,
      arena: [],
      engineId: "balanced",
      weights: { taskFit: 0.3, arena: 0, cost: 0.7 },
      reasoningModelPatterns: [],
    });
    expect(top[0].sessionModel.id).toBe("copilot-gpt-4o-mini-enterprise");
    expect(top[0].badges).toContain("matched");
  });

  it("ranks deepseek first for coding engine after fuzzy match", () => {
    const session = [{ id: "x", name: "DeepSeek Coder" }];
    const matched = matchModels(session, benches, {}, 0.72);
    const top = rankRecommendations({
      matched,
      arena: [{ model: "DeepSeek Coder", rank: 1, score: 1250 }],
      engineId: "coding",
      weights: { taskFit: 0.6, arena: 0.2, cost: 0.2 },
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
      engineId: "writing",
      weights: { taskFit: 0.45, arena: 0.25, cost: 0.3 },
      reasoningModelPatterns: [],
    });
    expect(top).toHaveLength(3);
    expect(top[0].badges).toContain("matched");
    expect(top.some((r) => r.badges.includes("weak"))).toBe(true);
  });
});
