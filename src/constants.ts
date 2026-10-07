import type { ApplyStrategy, ArenaSource, RankingWeights, RankingEngineId } from "./types";

export const ARENA_SOURCE: ArenaSource = "wulong-mirror";

export const ARENA_CATEGORIES: Record<RankingEngineId, string> = {
  coding: "coding",
  reasoning: "hard_prompts",
  writing: "text",
  cheap: "text",
  balanced: "text",
};

export const RANKING_WEIGHTS: RankingWeights = {
  taskFit: 0.45,
  arena: 0.25,
  cost: 0.3,
};

export const MODEL_ALIASES: Record<string, string> = {};

export const FUZZY_THRESHOLD = 0.72;

export const APPLY_STRATEGY: ApplyStrategy = "auto-then-manual";

export const FETCH_TIMEOUT_MS = 8000;

export const REASONING_MODEL_PATTERNS = ["o1", "o3", "deepseek-r1", "extended"];
