import type { BenchmarkModel, ComplexityLevel, TaskCategoryId } from "../types";
import { absoluteCostScore } from "./cost-score";

export const CATEGORY_SCORE_WEIGHT = 0.7;
export const COMPLEXITY_SCORE_WEIGHT = 0.3;
/** Share of Arena inside the category pillar (before session min-max). */
export const CATEGORY_ARENA_BLEND = 0.2;

const SWE_KEYS = [
  "swe_bench",
  "swe-bench",
  "swe_bench_verified",
  "swe-bench verified",
  "SWE-bench",
  "SWE-Bench",
];

export function evalValue(benchmark: BenchmarkModel, keys: string[]): number | null {
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

export function scaleEval(value: number): number {
  return value <= 1 ? value * 100 : value;
}

function intel(benchmark: BenchmarkModel): number {
  return benchmark.intelligence ?? 0;
}

function coding(benchmark: BenchmarkModel): number {
  return benchmark.coding ?? 0;
}

function agentic(benchmark: BenchmarkModel): number {
  const raw = evalValue(benchmark, [
    "artificial_analysis_agentic_index",
    "agentic",
    "agentic_index",
  ]);
  return raw != null ? scaleEval(raw) : 0;
}

function sweLike(benchmark: BenchmarkModel): number {
  const raw = evalValue(benchmark, SWE_KEYS);
  return raw != null ? scaleEval(raw) : 0;
}

function writingEval(benchmark: BenchmarkModel): number {
  const raw = evalValue(benchmark, ["gdpval", "writing", "gdpval-writing"]);
  return raw != null ? scaleEval(raw) : intel(benchmark);
}

function liveCode(benchmark: BenchmarkModel): number {
  const raw = evalValue(benchmark, ["livecodebench", "LiveCodeBench"]);
  if (raw != null) return scaleEval(raw);
  return coding(benchmark);
}

/** Broad capability mix for the complexity pillar. */
export function rawCapabilityBlend(benchmark: BenchmarkModel): number {
  const i = intel(benchmark);
  const c = coding(benchmark);
  const a = agentic(benchmark);
  const s = sweLike(benchmark);
  const parts = [i, c];
  if (a > 0) parts.push(a);
  if (s > 0) parts.push(s);
  return parts.reduce((sum, v) => sum + v, 0) / parts.length;
}

export function rawCategoryFit(benchmark: BenchmarkModel, categoryId: TaskCategoryId): number {
  switch (categoryId) {
    case "quickCheap":
      return intel(benchmark);
    case "analysisDoc": {
      const w = writingEval(benchmark);
      return (intel(benchmark) + w) / 2;
    }
    case "development": {
      const c = coding(benchmark);
      const lcb = liveCode(benchmark);
      if (c > 0 && lcb > 0) return c * 0.7 + lcb * 0.3;
      return c > 0 ? c : lcb;
    }
    case "testingReview":
      return (coding(benchmark) + intel(benchmark)) / 2;
    case "debugging": {
      const c = coding(benchmark);
      const i = intel(benchmark);
      const s = sweLike(benchmark);
      if (s > 0) return c * 0.4 + i * 0.35 + s * 0.25;
      return c * 0.55 + i * 0.45;
    }
    case "architectureDesign":
      return intel(benchmark) * 0.55 + coding(benchmark) * 0.45;
    case "autonomousAgent": {
      const a = agentic(benchmark);
      const c = coding(benchmark);
      const s = sweLike(benchmark);
      if (a > 0 && s > 0) return a * 0.45 + c * 0.35 + s * 0.2;
      if (a > 0) return a * 0.6 + c * 0.4;
      return c * 0.7 + intel(benchmark) * 0.3;
    }
    default:
      return intel(benchmark);
  }
}

const COMPLEXITY_COST_WEIGHT: Record<ComplexityLevel, number> = {
  basic: 0.75,
  intermediate: 0.4,
  advanced: 0.15,
  expert: 0.05,
};

export function complexityCostWeight(complexity: ComplexityLevel): number {
  return COMPLEXITY_COST_WEIGHT[complexity];
}

export function rawComplexityFit(benchmark: BenchmarkModel, complexity: ComplexityLevel): number {
  const costW = complexityCostWeight(complexity);
  const capW = 1 - costW;
  const price = benchmark.blendedPricePer1M;
  const cost =
    price != null && price > 0 && Number.isFinite(price) ? absoluteCostScore(price) : 0.5;
  const capability = rawCapabilityBlend(benchmark);
  const capNorm = capability / 100;
  return costW * cost + capW * capNorm;
}

export function blendCategoryPillar(capabilityFit: number, arenaNorm: number): number {
  const capNorm = capabilityFit / 100;
  const w = CATEGORY_ARENA_BLEND;
  return (1 - w) * capNorm + w * arenaNorm;
}

type ContextWindow = "standard" | "medium" | "high";
type ThinkingEffort = "off" | "low" | "medium" | "high";

const COMPLEXITY_RANK: Record<ComplexityLevel, number> = {
  basic: 0,
  intermediate: 1,
  advanced: 2,
  expert: 3,
};

function bumpContext(tier: ContextWindow): ContextWindow {
  if (tier === "standard") return "medium";
  if (tier === "medium") return "high";
  return "high";
}

function bumpThinking(effort: ThinkingEffort): ThinkingEffort {
  if (effort === "off") return "low";
  if (effort === "low") return "medium";
  if (effort === "medium") return "high";
  return "high";
}

export function resolveCategoryDefaults(
  categoryId: TaskCategoryId,
  complexity: ComplexityLevel
): { contextWindow: ContextWindow; thinkingEffort: ThinkingEffort } {
  let contextWindow: ContextWindow = "medium";
  let thinkingEffort: ThinkingEffort = "medium";

  switch (categoryId) {
    case "quickCheap":
      contextWindow = "standard";
      thinkingEffort = "low";
      break;
    case "analysisDoc":
      contextWindow = "high";
      thinkingEffort = "medium";
      break;
    case "development":
      contextWindow = "standard";
      thinkingEffort = "medium";
      break;
    case "testingReview":
      contextWindow = "medium";
      thinkingEffort = "medium";
      break;
    case "debugging":
      contextWindow = "medium";
      thinkingEffort = "medium";
      break;
    case "architectureDesign":
      contextWindow = "high";
      thinkingEffort = "high";
      break;
    case "autonomousAgent":
      contextWindow = "high";
      thinkingEffort = "high";
      break;
    default:
      break;
  }

  const cx = COMPLEXITY_RANK[complexity];
  if (cx >= 2) {
    contextWindow = bumpContext(contextWindow);
    thinkingEffort = bumpThinking(thinkingEffort);
  } else if (cx === 0 && categoryId !== "architectureDesign" && categoryId !== "autonomousAgent") {
    if (thinkingEffort === "high") thinkingEffort = "medium";
    if (thinkingEffort === "medium" && categoryId === "quickCheap") thinkingEffort = "low";
  }

  return { contextWindow, thinkingEffort };
}
