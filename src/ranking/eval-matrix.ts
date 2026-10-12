import { FUZZY_THRESHOLD, REASONING_MODEL_PATTERNS } from "../constants";
import { matchModels } from "../matching/model-matcher";
import type { ComplexityLevel, Recommendation, TaskCategoryId } from "../types";
import { formatScoreBreakdown } from "../ui/format-recommendation";
import { COMPLEXITY_LEVELS, TASK_CATEGORIES } from "../task/categories";
import { EVAL_ALIASES, EVAL_ARENA, EVAL_BENCHMARKS, EVAL_SESSION_MODELS } from "./eval-fixtures";
import { rankRecommendations } from "./task-ranker";

export const EVAL_COMPLEXITIES: ComplexityLevel[] = COMPLEXITY_LEVELS.map((c) => c.id);

export const EVAL_CATEGORIES: TaskCategoryId[] = TASK_CATEGORIES.map((c) => c.id);

export interface EvalScenarioResult {
  categoryId: TaskCategoryId;
  complexity: ComplexityLevel;
  recommendations: Recommendation[];
  matchedCount: number;
  weakCount: number;
}

export interface EvalMatrixOptions {
  fuzzyThreshold?: number;
  aliases?: Record<string, string>;
  reasoningModelPatterns?: string[];
  /** Subset of categories; default all seven. */
  categories?: TaskCategoryId[];
  /** Subset of complexity levels; default all four. */
  complexities?: ComplexityLevel[];
}

export function runEvalMatrix(options: EvalMatrixOptions = {}): EvalScenarioResult[] {
  const threshold = options.fuzzyThreshold ?? FUZZY_THRESHOLD;
  const aliases = options.aliases ?? EVAL_ALIASES;
  const patterns = options.reasoningModelPatterns ?? REASONING_MODEL_PATTERNS;
  const categories = options.categories ?? EVAL_CATEGORIES;
  const complexities = options.complexities ?? EVAL_COMPLEXITIES;

  const matched = matchModels(EVAL_SESSION_MODELS, EVAL_BENCHMARKS, aliases, threshold);
  const matchedCount = matched.filter((m) => m.badges.includes("matched")).length;
  const weakCount = matched.filter((m) => m.badges.includes("weak")).length;

  const results: EvalScenarioResult[] = [];

  for (const categoryId of categories) {
    for (const complexity of complexities) {
      results.push({
        categoryId,
        complexity,
        matchedCount,
        weakCount,
        recommendations: rankRecommendations({
          matched,
          arena: EVAL_ARENA,
          categoryId,
          complexity,
          reasoningModelPatterns: patterns,
        }),
      });
    }
  }

  return results;
}

export function formatEvalReport(results: EvalScenarioResult[]): string {
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
    const title = `${row.categoryId} · ${row.complexity}`;
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
