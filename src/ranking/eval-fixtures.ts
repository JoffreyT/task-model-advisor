import type { ArenaEntry, BenchmarkModel, SessionModel } from "../types";

/**
 * Synthetic catalog shaped like Cursor session models + AA + Arena.
 * Tuned so relative strengths are obvious when judging ranking pertinence:
 * - deepseek / flash: cheap, strong coding
 * - opus / grok high: expensive, strong intelligence
 * - composer: mid coding, mid price
 */
export const EVAL_SESSION_MODELS: SessionModel[] = [
  { id: "glm-5.3-flash", name: "GLM 5.3 Flash", vendor: "cursor" },
  { id: "gemini-3.8-flash-high", name: "Gemini 3.8 Flash High", vendor: "cursor" },
  { id: "composer-2.5", name: "Composer 2.5", vendor: "cursor" },
  { id: "grok-4.6", name: "Grok 4.6 Medium", vendor: "cursor" },
  { id: "grok-4.7", name: "Grok 4.7 High Fast", vendor: "cursor" },
  { id: "claude-opus-5", name: "Claude Opus 5 High", vendor: "cursor" },
  { id: "claude-opus-5.5", name: "Claude Opus 5.5 Medium", vendor: "cursor" },
  { id: "gpt-5.6-sol", name: "GPT-5.6 Sol Medium", vendor: "cursor" },
  { id: "claude-fable-5.1", name: "Claude Fable 5.1 High", vendor: "cursor" },
  { id: "unknown-corp-llm", name: "Unknown Corp LLM", vendor: "cursor" },
];

export const EVAL_BENCHMARKS: BenchmarkModel[] = [
  {
    slug: "glm-5-3-flash",
    name: "GLM 5.3 Flash",
    creatorSlug: "zhipu",
    intelligence: 62,
    coding: 71,
    blendedPricePer1M: 0.24,
    contextWindowTokens: 128_000,
    evaluations: {
      livecodebench: 0.62,
      gdpval: 48,
    },
  },
  {
    slug: "gemini-3-8-flash",
    name: "Gemini 3.8 Flash",
    creatorSlug: "google",
    intelligence: 66,
    coding: 68,
    blendedPricePer1M: 0.35,
    contextWindowTokens: 1_000_000,
    evaluations: {
      livecodebench: 0.58,
      gdpval: 52,
    },
  },
  {
    slug: "composer-2-5",
    name: "Composer 2.5",
    creatorSlug: "cursor",
    intelligence: 72,
    coding: 92,
    blendedPricePer1M: 1.5,
    contextWindowTokens: 200_000,
    evaluations: {
      livecodebench: 0.88,
      gdpval: 55,
    },
  },
  {
    slug: "grok-4-6",
    name: "Grok 4.6",
    creatorSlug: "xai",
    intelligence: 78,
    coding: 74,
    blendedPricePer1M: 2.2,
    contextWindowTokens: 256_000,
    evaluations: {
      livecodebench: 0.68,
      gdpval: 64,
    },
  },
  {
    slug: "grok-4-7",
    name: "Grok 4.7",
    creatorSlug: "xai",
    intelligence: 82,
    coding: 88,
    blendedPricePer1M: 3.0,
    contextWindowTokens: 256_000,
    evaluations: {
      livecodebench: 0.82,
      gdpval: 68,
    },
  },
  {
    slug: "claude-opus-5",
    name: "Claude Opus 5",
    creatorSlug: "anthropic",
    intelligence: 92,
    coding: 84,
    blendedPricePer1M: 8.0,
    contextWindowTokens: 200_000,
    evaluations: {
      livecodebench: 0.78,
      gdpval: 86,
      writing: 90,
    },
  },
  {
    slug: "claude-opus-5-5",
    name: "Claude Opus 5.5",
    creatorSlug: "anthropic",
    intelligence: 94,
    coding: 86,
    blendedPricePer1M: 8.0,
    contextWindowTokens: 200_000,
    evaluations: {
      livecodebench: 0.8,
      gdpval: 88,
      writing: 92,
    },
  },
  {
    slug: "gpt-5-6-sol",
    name: "GPT-5.6 Sol",
    creatorSlug: "openai",
    intelligence: 89,
    coding: 90,
    blendedPricePer1M: 6.5,
    contextWindowTokens: 256_000,
    evaluations: {
      livecodebench: 0.85,
      gdpval: 80,
    },
  },
  {
    slug: "claude-fable-5-1",
    name: "Claude Fable 5.1",
    creatorSlug: "anthropic",
    intelligence: 91,
    coding: 85,
    blendedPricePer1M: 7.0,
    contextWindowTokens: 200_000,
    evaluations: {
      livecodebench: 0.8,
      gdpval: 84,
      writing: 91,
    },
  },
];

/** Arena Elo-ish scores aligned with catalog display names / fuzzy keys. */
export const EVAL_ARENA: ArenaEntry[] = [
  { model: "Claude Opus 5.5", rank: 1, score: 1380 },
  { model: "Claude Opus 5", rank: 2, score: 1365 },
  { model: "GPT-5.6 Sol", rank: 3, score: 1340 },
  { model: "Claude Fable 5.1", rank: 4, score: 1330 },
  { model: "Grok 4.7", rank: 5, score: 1310 },
  { model: "Grok 4.6", rank: 6, score: 1280 },
  { model: "Composer 2.5", rank: 7, score: 1240 },
  { model: "Gemini 3.8 Flash", rank: 8, score: 1210 },
  { model: "GLM 5.3 Flash", rank: 9, score: 1190 },
];

export const EVAL_ALIASES: Record<string, string> = {
  "claude-opus-5.5": "claude-opus-5-5",
  "claude-opus-5": "claude-opus-5",
  "glm-5.3-flash": "glm-5-3-flash",
  "gemini-3.8-flash-high": "gemini-3-8-flash",
  "composer-2.5": "composer-2-5",
  "grok-4.6": "grok-4-6",
  "grok-4.7": "grok-4-7",
  "gpt-5.6-sol": "gpt-5-6-sol",
  "claude-fable-5.1": "claude-fable-5-1",
};
