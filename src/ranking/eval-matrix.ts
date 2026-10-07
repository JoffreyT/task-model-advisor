import { FUZZY_THRESHOLD, RANKING_WEIGHTS, REASONING_MODEL_PATTERNS } from "../constants";
import { matchModels } from "../matching/model-matcher";
import type { AdvisorConfig, RankingEngineId, Recommendation } from "../types";
import { formatScoreBreakdown } from "../ui/format-recommendation";
import { EVAL_ALIASES, EVAL_ARENA, EVAL_BENCHMARKS, EVAL_SESSION_MODELS } from "./eval-fixtures";
import { rankRecommendations } from "./task-ranker";

export const EVAL_ENGINES: RankingEngineId[] = [
  "coding",
  "reasoning",
  "writing",
  "cheap",
  "balanced",
];

export interface EvalEngineResult {
  engineId: RankingEngineId;
  customText?: string;
  recommendations: Recommendation[];
  matchedCount: number;
  weakCount: number;
}

export interface EvalMatrixOptions {
  weights?: AdvisorConfig["ranking"]["weights"];
  fuzzyThreshold?: number;
  aliases?: Record<string, string>;
  reasoningModelPatterns?: string[];
  /** Extra scenarios for engine `balanced` (free-text classifier input is separate). */
  otherCustomTexts?: string[];
}

export function runEvalMatrix(options: EvalMatrixOptions = {}): EvalEngineResult[] {
  const weights = options.weights ?? RANKING_WEIGHTS;
  const threshold = options.fuzzyThreshold ?? FUZZY_THRESHOLD;
  const aliases = options.aliases ?? EVAL_ALIASES;
  const patterns = options.reasoningModelPatterns ?? REASONING_MODEL_PATTERNS;

  const matched = matchModels(EVAL_SESSION_MODELS, EVAL_BENCHMARKS, aliases, threshold);
  const matchedCount = matched.filter((m) => m.badges.includes("matched")).length;
  const weakCount = matched.filter((m) => m.badges.includes("weak")).length;

  const results: EvalEngineResult[] = [];

  for (const engineId of EVAL_ENGINES) {
    results.push({
      engineId,
      matchedCount,
      weakCount,
      recommendations: rankRecommendations({
        matched,
        arena: EVAL_ARENA,
        engineId,
        weights,
        reasoningModelPatterns: patterns,
      }),
    });
  }

  const customTexts = options.otherCustomTexts ?? [
    undefined,
    "gros monorepo multi-fichier à refactorer",
  ];
  for (const customText of customTexts) {
    if (customText === undefined) continue;
    results.push({
      engineId: "balanced",
      customText,
      matchedCount,
      weakCount,
      recommendations: rankRecommendations({
        matched,
        arena: EVAL_ARENA,
        engineId: "balanced",
        weights,
        reasoningModelPatterns: patterns,
        customText,
      }),
    });
  }

  return results;
}

export function formatEvalReport(results: EvalEngineResult[]): string {
  const lines: string[] = [];
  lines.push("Task Model Advisor — ranking eval matrix");
  lines.push("=".repeat(72));

  if (results[0]) {
    lines.push(
      `Matched ${results[0].matchedCount} / weak ${results[0].weakCount} (session ${EVAL_SESSION_MODELS.length}, benches ${EVAL_BENCHMARKS.length})`
    );
    lines.push("");
  }

  for (const row of results) {
    const title =
      row.engineId === "balanced" && row.customText
        ? `balanced — custom: "${row.customText}"`
        : row.engineId;
    lines.push(`## ${title}`);
    if (row.recommendations.length === 0) {
      lines.push("  (aucune recommandation)");
      lines.push("");
      continue;
    }
    row.recommendations.forEach((rec, i) => {
      const price =
        rec.blendedPricePer1M != null ? `$${rec.blendedPricePer1M.toFixed(2)}/1M` : "prix ?";
      lines.push(`  ${i + 1}. ${rec.sessionModel.name}  [${rec.badges.join(",")}]  ${price}`);
      lines.push(
        `     ${formatScoreBreakdown(rec)} · ctx:${rec.contextWindow} · think:${rec.thinkingEffort}`
      );
      lines.push(`     ${rec.rationale}`);
    });
    lines.push("");
  }

  return lines.join("\n");
}
