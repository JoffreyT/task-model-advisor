import {
  APPLY_STRATEGY,
  ARENA_CATEGORIES,
  ARENA_SOURCE,
  FETCH_TIMEOUT_MS,
  FUZZY_THRESHOLD,
  MODEL_ALIASES,
  RANKING_WEIGHTS,
  REASONING_MODEL_PATTERNS,
  RECOMMENDATION_COUNT_DEFAULT,
  RECOMMENDATION_COUNT_MAX,
  RECOMMENDATION_COUNT_MIN,
} from "./constants";
import type { AdvisorConfig } from "./types";

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function clampRecommendationCount(value: unknown): number {
  if (typeof value !== "number" || !Number.isInteger(value)) {
    return RECOMMENDATION_COUNT_DEFAULT;
  }
  if (value < RECOMMENDATION_COUNT_MIN || value > RECOMMENDATION_COUNT_MAX) {
    return RECOMMENDATION_COUNT_DEFAULT;
  }
  return value;
}

function readApiKey(raw: unknown, fallback: string): string {
  if (!isPlainObject(raw)) {
    return fallback;
  }
  return typeof raw.apiKey === "string" ? raw.apiKey : fallback;
}

export function resolveConfig(raw: Record<string, unknown>): AdvisorConfig {
  return {
    artificialAnalysis: { apiKey: readApiKey(raw.artificialAnalysis, "") },
    arena: { source: ARENA_SOURCE, categories: { ...ARENA_CATEGORIES } },
    ranking: { weights: { ...RANKING_WEIGHTS } },
    modelAliases: { ...MODEL_ALIASES },
    matching: { fuzzyThreshold: FUZZY_THRESHOLD },
    applyStrategy: APPLY_STRATEGY,
    fetch: { timeoutMs: FETCH_TIMEOUT_MS },
    reasoningModelPatterns: [...REASONING_MODEL_PATTERNS],
    cursor: { apiKey: readApiKey(raw.cursor, "") },
    language: raw.language === "fr" ? "fr" : "en",
    recommendationCount: clampRecommendationCount(raw.recommendationCount),
  };
}
