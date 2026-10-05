export type TaskProfileId = "spec" | "userStory" | "testScenario" | "pythonScript" | "other";

export interface SessionModel {
  id: string;
  name: string;
  family?: string;
  vendor?: string;
}

export interface BenchmarkModel {
  slug: string;
  name: string;
  creatorSlug?: string;
  intelligence?: number;
  coding?: number;
  blendedPricePer1M?: number;
  contextWindowTokens?: number;
  evaluations: Record<string, number | null>;
}

export interface ArenaEntry {
  model: string;
  rank: number;
  score: number | null;
}

export type MatchQuality = "matched" | "weak" | "enterprise";

export interface Recommendation {
  sessionModel: SessionModel;
  score: number;
  breakdown: { taskFit: number; arena: number; cost: number };
  contextWindow: "standard" | "medium" | "high";
  thinkingEffort: "off" | "low" | "medium" | "high";
  rationale: string;
  badges: Array<"matched" | "weak" | "enterprise">;
  /** Blended USD per 1M tokens from Artificial Analysis, when known. */
  blendedPricePer1M: number | null;
  /** Relative cost among scored session models. */
  costTier: "low" | "medium" | "high" | "unknown";
}

export type ArenaSource = "wulong-mirror";

export type ApplyStrategy = "auto-then-manual" | "clipboard-only";

export interface RankingWeights {
  taskFit: number;
  arena: number;
  cost: number;
}

export interface AdvisorConfig {
  enabled: boolean;
  artificialAnalysis: { apiKey: string };
  arena: {
    source: ArenaSource;
    categories: Record<TaskProfileId, string>;
  };
  ranking: { weights: RankingWeights };
  modelAliases: Record<string, string>;
  matching: { fuzzyThreshold: number };
  applyStrategy: ApplyStrategy;
  fetch: { timeoutMs: number };
  reasoningModelPatterns: string[];
  /** Used when vscode.lm.selectChatModels() is empty (typical on Cursor). */
  fallbackModels: string[];
  /** Optional Cursor user/service API key for `agent --list-models` / GET /v1/models. */
  cursor: { apiKey: string };
}
