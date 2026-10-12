import { clampRecommendationCount } from "../config";
import type { MatchedModel } from "../matching/model-matcher";
import { normalizeModelKey } from "../matching/normalize";
import type {
  ArenaEntry,
  BenchmarkModel,
  ComplexityLevel,
  Recommendation,
  SessionModel,
  TaskCategoryId,
} from "../types";
import {
  CATEGORY_SCORE_WEIGHT,
  COMPLEXITY_SCORE_WEIGHT,
  blendCategoryPillar,
  rawCategoryFit,
  rawComplexityFit,
  resolveCategoryDefaults,
} from "./category-fit";
import { absoluteCostScore } from "./cost-score";

const WEAK_SCORE_OFFSET = 0.001;

const THINKING_LEVELS = ["off", "low", "medium", "high"] as const;

type ThinkingEffort = Recommendation["thinkingEffort"];
type ContextWindow = Recommendation["contextWindow"];

export interface RankRecommendationsInput {
  matched: MatchedModel[];
  arena: ArenaEntry[];
  categoryId: TaskCategoryId;
  complexity: ComplexityLevel;
  reasoningModelPatterns: string[];
  limit?: number;
}

const CONTEXT_TIERS: ContextWindow[] = ["standard", "medium", "high"];

function isWeakMatch(m: MatchedModel): boolean {
  return m.benchmark === null || m.badges.includes("weak");
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

function normalizeArenaScores(rawArena: Array<number | null>, useElo: boolean): number[] {
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

function matchesReasoningPattern(session: SessionModel, patterns: string[]): boolean {
  const haystack = [session.id, session.name, session.family ?? ""].join(" ").toLowerCase();
  return patterns.some((p) => p.length > 0 && haystack.includes(p.toLowerCase()));
}

function bumpThinking(effort: ThinkingEffort): ThinkingEffort {
  const idx = THINKING_LEVELS.indexOf(effort);
  if (idx < 0 || idx >= THINKING_LEVELS.length - 1) return effort;
  return THINKING_LEVELS[idx + 1];
}

function resolveContextWindow(
  categoryId: TaskCategoryId,
  complexity: ComplexityLevel,
  benchmark: BenchmarkModel | null
): ContextWindow {
  let ctx = resolveCategoryDefaults(categoryId, complexity).contextWindow;
  if (benchmark?.contextWindowTokens != null) {
    ctx = lowerContextTier(ctx, tokensToContextTier(benchmark.contextWindowTokens));
  }
  return ctx;
}

function buildRationale(
  breakdown: Recommendation["breakdown"],
  blendedPricePer1M: number | null
): string {
  const factors: Array<{ label: string; contribution: number }> = [
    {
      label: "category fit",
      contribution: CATEGORY_SCORE_WEIGHT * breakdown.categoryFit,
    },
    {
      label: "complexity fit",
      contribution: COMPLEXITY_SCORE_WEIGHT * breakdown.complexityFit,
    },
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

function costTierFromPrice(price: number | null, prices: number[]): Recommendation["costTier"] {
  if (price == null || !Number.isFinite(price) || prices.length === 0) {
    return "unknown";
  }
  if (prices.length === 1) return "medium";
  const sorted = [...prices].sort((a, b) => a - b);
  const lowCut = sorted[Math.floor((sorted.length - 1) / 3)] ?? sorted[0];
  const highCut = sorted[Math.ceil(((sorted.length - 1) * 2) / 3)] ?? sorted[sorted.length - 1];
  if (price <= lowCut) return "low";
  if (price >= highCut) return "high";
  return "medium";
}

export { absoluteCostScore } from "./cost-score";

export function rankRecommendations(input: RankRecommendationsInput): Recommendation[] {
  const { matched, arena, categoryId, complexity, reasoningModelPatterns, limit } = input;

  const arenaByKey = buildArenaLookup(arena);
  const useElo = arena.some((e) => e.score != null);

  const withBenchmark = matched.filter((m) => !isWeakMatch(m) && m.benchmark);

  const arenaEligible = withBenchmark.map((m) =>
    findArenaEntry(m.session, m.benchmark, arenaByKey)
  );
  const rawArena = withBenchmark.map((_, i) => rawArenaScore(arenaEligible[i], arena, useElo));
  const normArena = normalizeArenaScores(rawArena, useElo);

  const rawCategoryPillar = withBenchmark.map((m, i) => {
    const cap = rawCategoryFit(m.benchmark!, categoryId);
    const arenaNorm = Number.isFinite(normArena[i]) ? (normArena[i] ?? 0) : 0;
    return blendCategoryPillar(cap, arenaNorm);
  });
  const normCategory = minMax(rawCategoryPillar);

  const rawComplexity = withBenchmark.map((m) => rawComplexityFit(m.benchmark!, complexity));
  const normComplexity = minMax(rawComplexity);

  const pricesAmongMatched = withBenchmark
    .map((m) => m.benchmark!.blendedPricePer1M)
    .filter((p): p is number => p != null && p > 0 && Number.isFinite(p));

  const scoredMatched: Recommendation[] = withBenchmark.map((m, i) => {
    const categoryFit = Number.isFinite(normCategory[i]) ? (normCategory[i] ?? 0) : 0;
    const complexityFit = Number.isFinite(normComplexity[i]) ? (normComplexity[i] ?? 0) : 0;
    const arenaNorm = Number.isFinite(normArena[i]) ? (normArena[i] ?? 0) : 0;
    const price = m.benchmark!.blendedPricePer1M;
    const cost =
      price != null && price > 0 && Number.isFinite(price) ? absoluteCostScore(price) : 0.5;
    const blendedPricePer1M =
      m.benchmark!.blendedPricePer1M != null && Number.isFinite(m.benchmark!.blendedPricePer1M)
        ? m.benchmark!.blendedPricePer1M
        : null;
    const breakdown = { categoryFit, complexityFit, arena: arenaNorm, cost };
    const score = CATEGORY_SCORE_WEIGHT * categoryFit + COMPLEXITY_SCORE_WEIGHT * complexityFit;
    const defaults = resolveCategoryDefaults(categoryId, complexity);
    let thinkingEffort = defaults.thinkingEffort;
    if (matchesReasoningPattern(m.session, reasoningModelPatterns)) {
      thinkingEffort = bumpThinking(thinkingEffort);
    }
    return {
      sessionModel: m.session,
      score: Number.isFinite(score) ? score : 0,
      breakdown,
      contextWindow: resolveContextWindow(categoryId, complexity, m.benchmark!),
      thinkingEffort,
      rationale: buildRationale(breakdown, blendedPricePer1M),
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
    const defaults = resolveCategoryDefaults(categoryId, complexity);
    let thinkingEffort = defaults.thinkingEffort;
    if (matchesReasoningPattern(m.session, reasoningModelPatterns)) {
      thinkingEffort = bumpThinking(thinkingEffort);
    }
    const breakdown = { categoryFit: 0, complexityFit: 0, arena: 0, cost: 0 };
    const score = scoredMatched.length > 0 ? worstMatchedScore - WEAK_SCORE_OFFSET - i * 1e-6 : 0;
    return {
      sessionModel: m.session,
      score,
      breakdown,
      contextWindow: resolveContextWindow(categoryId, complexity, m.benchmark),
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

  const ranked = [...scoredMatched].sort((a, b) => b.score - a.score).concat(scoredWeak);

  return selectRecommendations(ranked, limit);
}

export function diversifyTop3(ranked: Recommendation[]): Recommendation[] {
  if (ranked.length <= 3) return ranked.slice(0, 3);
  const primary = ranked[0]!;
  const rest = ranked.slice(1);
  const primaryPrice = primary.blendedPricePer1M;

  const valuePick = rest.find((r) => {
    if (!r.badges.includes("matched")) return false;
    if (r.breakdown.cost < 0.35) return false;
    if (primaryPrice == null || r.blendedPricePer1M == null) {
      return r.breakdown.cost >= primary.breakdown.cost + 0.15;
    }
    return r.blendedPricePer1M <= primaryPrice * 0.55;
  });

  const chosen = new Set<string>([primary.sessionModel.id]);
  if (valuePick) chosen.add(valuePick.sessionModel.id);
  for (const r of rest) {
    if (chosen.size >= 3) break;
    chosen.add(r.sessionModel.id);
  }

  return ranked.filter((r) => chosen.has(r.sessionModel.id)).slice(0, 3);
}

export function selectRecommendations(ranked: Recommendation[], limit?: number): Recommendation[] {
  const count = clampRecommendationCount(limit);
  const top = diversifyTop3(ranked);
  if (count <= top.length) return top;
  const chosen = new Set(top.map((row) => row.sessionModel.id));
  const extra = ranked.filter((row) => !chosen.has(row.sessionModel.id));
  return [...top, ...extra].slice(0, count);
}
