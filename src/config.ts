import type { AdvisorConfig, TaskProfileId } from "./types";

const DEFAULT_ARENA_CATEGORIES: Record<TaskProfileId, string> = {
  spec: "text",
  userStory: "text",
  testScenario: "hard_prompts",
  pythonScript: "coding",
  other: "text",
};

export const DEFAULT_CONFIG: AdvisorConfig = {
  enabled: true,
  artificialAnalysis: { apiKey: "" },
  arena: {
    source: "wulong-mirror",
    categories: { ...DEFAULT_ARENA_CATEGORIES },
  },
  ranking: {
    weights: { taskFit: 0.5, arena: 0.3, cost: 0.2 },
  },
  modelAliases: {},
  matching: { fuzzyThreshold: 0.72 },
  applyStrategy: "auto-then-manual",
  fetch: { timeoutMs: 8000 },
  reasoningModelPatterns: ["o1", "o3", "deepseek-r1", "extended"],
};

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function mergeRecord(
  base: Record<string, string>,
  override: unknown
): Record<string, string> {
  if (!isPlainObject(override)) {
    return { ...base };
  }
  const merged = { ...base };
  for (const [key, value] of Object.entries(override)) {
    if (typeof value === "string") {
      merged[key] = value;
    }
  }
  return merged;
}

function mergeAdvisorConfig(
  base: AdvisorConfig,
  raw: Record<string, unknown>
): AdvisorConfig {
  const enabled =
    typeof raw.enabled === "boolean" ? raw.enabled : base.enabled;

  const artificialAnalysis = isPlainObject(raw.artificialAnalysis)
    ? {
        apiKey:
          typeof raw.artificialAnalysis.apiKey === "string"
            ? raw.artificialAnalysis.apiKey
            : base.artificialAnalysis.apiKey,
      }
    : base.artificialAnalysis;

  const arenaRaw = isPlainObject(raw.arena) ? raw.arena : {};
  const arenaSource =
    arenaRaw.source === "wulong-mirror" ? arenaRaw.source : base.arena.source;
  const arenaCategories = mergeRecord(
    base.arena.categories,
    arenaRaw.categories
  ) as AdvisorConfig["arena"]["categories"];

  const rankingRaw = isPlainObject(raw.ranking) ? raw.ranking : {};
  const weightsRaw = isPlainObject(rankingRaw.weights)
    ? rankingRaw.weights
    : {};
  const rankingWeights = {
    taskFit:
      typeof weightsRaw.taskFit === "number"
        ? weightsRaw.taskFit
        : base.ranking.weights.taskFit,
    arena:
      typeof weightsRaw.arena === "number"
        ? weightsRaw.arena
        : base.ranking.weights.arena,
    cost:
      typeof weightsRaw.cost === "number"
        ? weightsRaw.cost
        : base.ranking.weights.cost,
  };

  const modelAliases = mergeRecord(base.modelAliases, raw.modelAliases);

  const matchingRaw = isPlainObject(raw.matching) ? raw.matching : {};
  const fuzzyThreshold =
    typeof matchingRaw.fuzzyThreshold === "number"
      ? matchingRaw.fuzzyThreshold
      : base.matching.fuzzyThreshold;

  const applyStrategy =
    raw.applyStrategy === "auto-then-manual" ||
    raw.applyStrategy === "clipboard-only"
      ? raw.applyStrategy
      : base.applyStrategy;

  const fetchRaw = isPlainObject(raw.fetch) ? raw.fetch : {};
  const timeoutMs =
    typeof fetchRaw.timeoutMs === "number"
      ? fetchRaw.timeoutMs
      : base.fetch.timeoutMs;

  const reasoningModelPatterns = Array.isArray(raw.reasoningModelPatterns)
    ? raw.reasoningModelPatterns.filter(
        (item): item is string => typeof item === "string"
      )
    : base.reasoningModelPatterns;

  return {
    enabled,
    artificialAnalysis,
    arena: { source: arenaSource, categories: arenaCategories },
    ranking: { weights: rankingWeights },
    modelAliases,
    matching: { fuzzyThreshold },
    applyStrategy,
    fetch: { timeoutMs },
    reasoningModelPatterns: [...reasoningModelPatterns],
  };
}

function cloneDefaultConfig(): AdvisorConfig {
  return {
    ...DEFAULT_CONFIG,
    artificialAnalysis: { ...DEFAULT_CONFIG.artificialAnalysis },
    arena: {
      source: DEFAULT_CONFIG.arena.source,
      categories: { ...DEFAULT_CONFIG.arena.categories },
    },
    ranking: { weights: { ...DEFAULT_CONFIG.ranking.weights } },
    modelAliases: { ...DEFAULT_CONFIG.modelAliases },
    matching: { ...DEFAULT_CONFIG.matching },
    fetch: { ...DEFAULT_CONFIG.fetch },
    reasoningModelPatterns: [...DEFAULT_CONFIG.reasoningModelPatterns],
  };
}

export function resolveConfig(raw: Record<string, unknown>): AdvisorConfig {
  return mergeAdvisorConfig(cloneDefaultConfig(), raw);
}
