import { FUZZY_THRESHOLD, RANKING_WEIGHTS, REASONING_MODEL_PATTERNS } from "../constants";
import { matchModels } from "../matching/model-matcher";
import type { AdvisorConfig, Recommendation, TaskProfileId } from "../types";
import { formatScoreBreakdown } from "../ui/format-recommendation";
import { EVAL_ALIASES, EVAL_ARENA, EVAL_BENCHMARKS, EVAL_SESSION_MODELS } from "./eval-fixtures";
import { rankRecommendations } from "./task-ranker";

export const EVAL_TASK_PROFILES: TaskProfileId[] = [
  "spec",
  "userStory",
  "testScenario",
  "pythonScript",
  "other",
];

export interface EvalProfileResult {
  profileId: TaskProfileId;
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
  /** Extra scenarios for profile `other` (free-text classifier input is separate). */
  otherCustomTexts?: string[];
}

export function runEvalMatrix(options: EvalMatrixOptions = {}): EvalProfileResult[] {
  const weights = options.weights ?? RANKING_WEIGHTS;
  const threshold = options.fuzzyThreshold ?? FUZZY_THRESHOLD;
  const aliases = options.aliases ?? EVAL_ALIASES;
  const patterns = options.reasoningModelPatterns ?? REASONING_MODEL_PATTERNS;

  const matched = matchModels(EVAL_SESSION_MODELS, EVAL_BENCHMARKS, aliases, threshold);
  const matchedCount = matched.filter((m) => m.badges.includes("matched")).length;
  const weakCount = matched.filter((m) => m.badges.includes("weak")).length;

  const results: EvalProfileResult[] = [];

  for (const profileId of EVAL_TASK_PROFILES) {
    if (profileId === "other") {
      const texts = options.otherCustomTexts ?? [
        undefined,
        "gros monorepo multi-fichier à refactorer",
      ];
      for (const customText of texts) {
        results.push({
          profileId,
          customText,
          matchedCount,
          weakCount,
          recommendations: rankRecommendations({
            matched,
            arena: EVAL_ARENA,
            profileId,
            weights,
            reasoningModelPatterns: patterns,
            customText,
          }),
        });
      }
      continue;
    }

    results.push({
      profileId,
      matchedCount,
      weakCount,
      recommendations: rankRecommendations({
        matched,
        arena: EVAL_ARENA,
        profileId,
        weights,
        reasoningModelPatterns: patterns,
      }),
    });
  }

  return results;
}

export function formatEvalReport(results: EvalProfileResult[]): string {
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
      row.profileId === "other" && row.customText
        ? `other — custom: "${row.customText}"`
        : row.profileId;
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
