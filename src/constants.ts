import type { ApplyStrategy, ArenaSource, RankingWeights, TaskCategoryId } from "./types";

export const ARENA_SOURCE: ArenaSource = "wulong-mirror";

export const ARENA_CATEGORIES: Record<TaskCategoryId, string> = {
  quickCheap: "text",
  analysisDoc: "text",
  development: "coding",
  testingReview: "hard_prompts",
  debugging: "coding",
  architectureDesign: "hard_prompts",
  autonomousAgent: "coding",
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

export const RECOMMENDATION_COUNT_MIN = 3;
export const RECOMMENDATION_COUNT_MAX = 5;
export const RECOMMENDATION_COUNT_DEFAULT = 3;
