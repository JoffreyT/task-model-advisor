import type { MatchedModel } from "../matching/model-matcher";
import { normalizeModelKey } from "../matching/normalize";
import type {
  ArenaEntry,
  BenchmarkModel,
  RankingWeights,
  Recommendation,
  SessionModel,
  TaskProfileId,
} from "../types";

const EPSILON = 0.01;
const WEAK_SCORE_OFFSET = 0.001;

const THINKING_LEVELS = ["off", "low", "medium", "high"] as const;

type ThinkingEffort = Recommendation["thinkingEffort"];
type ContextWindow = Recommendation["contextWindow"];

export interface RankRecommendationsInput {
  matched: MatchedModel[];
  arena: ArenaEntry[];
  profileId: TaskProfileId;
  weights: RankingWeights;
  reasoningModelPatterns: string[];
  customText?: string;
}

const CONTEXT_TIERS: ContextWindow[] = ["standard", "medium", "high"];

function isWeakMatch(m: MatchedModel): boolean {
  return m.benchmark === null || m.badges.includes("weak");
}

function evalValue(
  benchmark: BenchmarkModel,
  keys: string[]
): number | null {
  for (const key of keys) {
    const direct = benchmark.evaluations[key];
    if (direct != null) return direct;
    const lower = key.toLowerCase();
    for (const [k, v] of Object.entries(benchmark.evaluations)) {
      if (k.toLowerCase() === lower && v != null) return v;
    }
  }
  return null;
}

function scaleEval(value: number): number {
  return value <= 1 ? value * 100 : value;
}

function rawTaskFit(benchmark: BenchmarkModel, profileId: TaskProfileId): number {
  switch (profileId) {
    case "pythonScript": {
      const coding = benchmark.coding ?? 0;
      const lcbRaw = evalValue(benchmark, ["livecodebench", "LiveCodeBench"]);
      const lcb = lcbRaw != null ? scaleEval(lcbRaw) : coding;
      if (coding > 0 && lcbRaw != null) return coding * 0.7 + lcb * 0.3;
      return coding > 0 ? coding : lcb;
    }
    case "spec": {
      const intel = benchmark.intelligence ?? 0;
      const writing = evalValue(benchmark, ["gdpval", "writing", "gdpval-writing"]);
      if (writing != null) return (intel + scaleEval(writing)) / 2;
      return intel;
    }
    case "userStory":
    case "other":
      return (benchmark.intelligence ?? 0) * 0.8;
    case "testScenario":
      return benchmark.intelligence ?? 0;
    default:
      return benchmark.intelligence ?? 0;
  }
}

function minMax(values: number[]): number[] {
  if (values.length === 0) return [];
  const min = Math.min(...values);
  const max = Math.max(...values);
  if (max === min) return values.map(() => 1);
  return values.map((v) => (v - min) / (max - min));
}

function findArenaEntry(
  session: SessionModel,
  benchmark: BenchmarkModel | null,
  arenaByKey: Map<string, ArenaEntry>
): ArenaEntry | undefined {
  const keys = [
    normalizeModelKey(session.name),
    normalizeModelKey(session.id),
    benchmark ? normalizeModelKey(benchmark.name) : "",
    benchmark ? normalizeModelKey(benchmark.slug) : "",
  ].filter(Boolean);

  for (const key of keys) {
    const entry = arenaByKey.get(key);
    if (entry) return entry;
  }
  return undefined;
}

function buildArenaLookup(arena: ArenaEntry[]): Map<string, ArenaEntry> {
  const map = new Map<string, ArenaEntry>();
  for (const entry of arena) {
    map.set(normalizeModelKey(entry.model), entry);
  }
  return map;
}

function rawArenaScore(
  entry: ArenaEntry | undefined,
  arena: ArenaEntry[],
  useElo: boolean
): number | null {
  if (!entry) return null;
  if (useElo) {
    return entry.score != null ? entry.score : null;
  }
  const n = arena.length;
  if (n === 0) return null;
  return 1 - (entry.rank - 1) / n;
}

function tokensToContextTier(tokens: number): ContextWindow {
  if (tokens < 48_000) return "standard";
  if (tokens < 100_000) return "medium";
  return "high";
}

function contextTierRank(tier: ContextWindow): number {
  return CONTEXT_TIERS.indexOf(tier);
}

function lowerContextTier(a: ContextWindow, b: ContextWindow): ContextWindow {
  return contextTierRank(a) <= contextTierRank(b) ? a : b;
}

function bumpContextTier(tier: ContextWindow): ContextWindow {
  const idx = contextTierRank(tier);
  if (idx < 0 || idx >= CONTEXT_TIERS.length - 1) return tier;
  return CONTEXT_TIERS[idx + 1]!;
}

function resolveContextWindow(
  profileId: TaskProfileId,
  benchmark: BenchmarkModel | null,
  customText?: string
): ContextWindow {
  let ctx = profileDefaults(profileId).contextWindow;
  if (benchmark?.contextWindowTokens != null) {
    ctx = lowerContextTier(ctx, tokensToContextTier(benchmark.contextWindowTokens));
  }
  if (
    customText &&
    /codebase|repo|monorepo|multi-?fichier|large|gros/i.test(customText)
  ) {
    ctx = bumpContextTier(ctx);
  }
  return ctx;
}

function normalizeArenaScores(
  rawArena: Array<number | null>,
  useElo: boolean
): number[] {
  if (useElo) {
    const eloValues = rawArena.filter((v): v is number => v != null);
    const normPool = minMax(eloValues);
    let idx = 0;
    return rawArena.map((v) => {
      if (v == null) return 0;
      return normPool[idx++] ?? 0;
    });
  }
  const present = rawArena.map((v) => v ?? 0);
  return minMax(present);
}

function profileDefaults(profileId: TaskProfileId): {
  contextWindow: ContextWindow;
  thinkingEffort: ThinkingEffort;
} {
  switch (profileId) {
    case "spec":
      return { contextWindow: "high", thinkingEffort: "medium" };
    case "userStory":
      return { contextWindow: "medium", thinkingEffort: "low" };
    case "testScenario":
      return { contextWindow: "medium", thinkingEffort: "medium" };
    case "pythonScript":
      return { contextWindow: "standard", thinkingEffort: "medium" };
    case "other":
    default:
      return { contextWindow: "medium", thinkingEffort: "medium" };
  }
}

function matchesReasoningPattern(
  session: SessionModel,
  patterns: string[]
): boolean {
  const haystack = [session.id, session.name, session.family ?? ""]
    .join(" ")
    .toLowerCase();
  return patterns.some((p) => p.length > 0 && haystack.includes(p.toLowerCase()));
}

function bumpThinking(effort: ThinkingEffort): ThinkingEffort {
  const idx = THINKING_LEVELS.indexOf(effort);
  if (idx < 0 || idx >= THINKING_LEVELS.length - 1) return effort;
  return THINKING_LEVELS[idx + 1];
}

function buildRationale(
  weights: RankingWeights,
  breakdown: Recommendation["breakdown"],
  blendedPricePer1M: number | null
): string {
  const factors: Array<{ label: string; contribution: number }> = [
    { label: "task fit", contribution: weights.taskFit * breakdown.taskFit },
    { label: "Arena rank", contribution: weights.arena * breakdown.arena },
    { label: "cost efficiency", contribution: weights.cost * breakdown.cost },
  ];
  factors.sort((a, b) => b.contribution - a.contribution);
  const top = factors.filter((f) => f.contribution > 0).slice(0, 2);
  if (top.length === 0) return "Limited benchmark data; session availability only.";
  const base = `Strong ${top.map((f) => f.label).join(" and ")}.`;
  if (blendedPricePer1M != null && Number.isFinite(blendedPricePer1M)) {
    return `${base} ~$${blendedPricePer1M.toFixed(2)}/1M tokens.`;
  }
  return base;
}

function costTierFromPrice(
  price: number | null,
  prices: number[]
): Recommendation["costTier"] {
  if (price == null || !Number.isFinite(price) || prices.length === 0) {
    return "unknown";
  }
  if (prices.length === 1) return "medium";
  const sorted = [...prices].sort((a, b) => a - b);
  const lowCut = sorted[Math.floor((sorted.length - 1) / 3)] ?? sorted[0];
  const highCut =
    sorted[Math.ceil(((sorted.length - 1) * 2) / 3)] ?? sorted[sorted.length - 1];
  if (price <= lowCut) return "low";
  if (price >= highCut) return "high";
  return "medium";
}

export function rankRecommendations(input: RankRecommendationsInput): Recommendation[] {
  const { matched, arena, profileId, weights, reasoningModelPatterns, customText } =
    input;
  const arenaByKey = buildArenaLookup(arena);
  const useElo = arena.some((e) => e.score != null);

  const withBenchmark = matched.filter((m) => !isWeakMatch(m) && m.benchmark);
  const rawTaskFits = withBenchmark.map((m) =>
    rawTaskFit(m.benchmark!, profileId)
  );
  const normTaskFits = minMax(rawTaskFits);

  const arenaEligible = withBenchmark.map((m) =>
    findArenaEntry(m.session, m.benchmark, arenaByKey)
  );
  const rawArena = withBenchmark.map((_, i) =>
    rawArenaScore(arenaEligible[i], arena, useElo)
  );
  const normArena = normalizeArenaScores(rawArena, useElo);

  const rawCosts = withBenchmark.map((m) => {
    const price = m.benchmark!.blendedPricePer1M;
    if (price == null || price <= 0) return null;
    return 1 / (price + EPSILON);
  });
  const definedCosts = rawCosts.filter((c): c is number => c != null);
  const normCostPool =
    definedCosts.length > 0 ? minMax(definedCosts) : ([] as number[]);
  let costIdx = 0;

  const pricesAmongMatched = withBenchmark
    .map((m) => m.benchmark!.blendedPricePer1M)
    .filter((p): p is number => p != null && p > 0 && Number.isFinite(p));

  const scoredMatched: Recommendation[] = withBenchmark.map((m, i) => {
    const taskFit = Number.isFinite(normTaskFits[i]) ? (normTaskFits[i] ?? 0) : 0;
    const arenaNorm = Number.isFinite(normArena[i]) ? (normArena[i] ?? 0) : 0;
    let cost: number;
    if (rawCosts[i] == null) {
      cost = 0.5;
    } else {
      cost = normCostPool[costIdx] ?? 0.5;
      costIdx++;
      if (!Number.isFinite(cost)) cost = 0.5;
    }
    const blendedPricePer1M =
      m.benchmark!.blendedPricePer1M != null &&
      Number.isFinite(m.benchmark!.blendedPricePer1M)
        ? m.benchmark!.blendedPricePer1M
        : null;
    const breakdown = { taskFit, arena: arenaNorm, cost };
    const score =
      weights.taskFit * taskFit +
      weights.arena * arenaNorm +
      weights.cost * cost;
    const defaults = profileDefaults(profileId);
    let thinkingEffort = defaults.thinkingEffort;
    if (matchesReasoningPattern(m.session, reasoningModelPatterns)) {
      thinkingEffort = bumpThinking(thinkingEffort);
    }
    return {
      sessionModel: m.session,
      score: Number.isFinite(score) ? score : 0,
      breakdown,
      contextWindow: resolveContextWindow(profileId, m.benchmark!, customText),
      thinkingEffort,
      rationale: buildRationale(weights, breakdown, blendedPricePer1M),
      badges: m.badges.filter(
        (b): b is "matched" | "weak" | "enterprise" =>
          b === "matched" || b === "weak" || b === "enterprise"
      ),
      blendedPricePer1M,
      costTier: costTierFromPrice(blendedPricePer1M, pricesAmongMatched),
    };
  });

  let worstMatchedScore = 0;
  if (scoredMatched.length > 0) {
    worstMatchedScore = Math.min(...scoredMatched.map((r) => r.score));
  }

  const weakModels = matched
    .filter(isWeakMatch)
    .sort((a, b) => a.session.name.localeCompare(b.session.name));

  const scoredWeak: Recommendation[] = weakModels.map((m, i) => {
    const defaults = profileDefaults(profileId);
    let thinkingEffort = defaults.thinkingEffort;
    if (matchesReasoningPattern(m.session, reasoningModelPatterns)) {
      thinkingEffort = bumpThinking(thinkingEffort);
    }
    const breakdown = { taskFit: 0, arena: 0, cost: 0 };
    const score =
      scoredMatched.length > 0
        ? worstMatchedScore - WEAK_SCORE_OFFSET - i * 1e-6
        : 0;
    return {
      sessionModel: m.session,
      score,
      breakdown,
      contextWindow: resolveContextWindow(profileId, m.benchmark, customText),
      thinkingEffort,
      rationale: "Weak match; no reliable benchmark link.",
      badges: m.badges.filter(
        (b): b is "matched" | "weak" | "enterprise" =>
          b === "matched" || b === "weak" || b === "enterprise"
      ),
      blendedPricePer1M: null,
      costTier: "unknown" as const,
    };
  });

  const ranked = [...scoredMatched]
    .sort((a, b) => b.score - a.score)
    .concat(scoredWeak);

  return ranked.slice(0, 3);
}
