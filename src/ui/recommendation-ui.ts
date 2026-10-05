import * as vscode from "vscode";
import type { Recommendation } from "../types";

export type RecommendationAction = "validate" | "copy" | "refresh";

export type RecommendationChoice = {
  action: RecommendationAction;
  index: number;
};

type RecQuickPickItem = vscode.QuickPickItem & { index: number };

type ActionQuickPickItem = vscode.QuickPickItem & {
  actionId: RecommendationAction;
};

const ACTIONS: ActionQuickPickItem[] = [
  { label: "$(check) Valider (copier la config)", actionId: "validate" },
  { label: "$(copy) Copier seulement", actionId: "copy" },
  { label: "$(refresh) Actualiser les benchmarks", actionId: "refresh" },
];

function formatCostLabel(rec: Recommendation): string {
  if (rec.blendedPricePer1M != null && Number.isFinite(rec.blendedPricePer1M)) {
    const tier =
      rec.costTier === "low"
        ? "bon marché"
        : rec.costTier === "high"
          ? "cher"
          : rec.costTier === "medium"
            ? "moyen"
            : "";
    const tierSuffix = tier ? ` · ${tier}` : "";
    return `$${rec.blendedPricePer1M.toFixed(2)}/1M${tierSuffix}`;
  }
  return "prix inconnu";
}

function formatRecommendationItem(rec: Recommendation, index: number): RecQuickPickItem {
  const badges =
    rec.badges.length > 0 ? rec.badges.join(", ") : "no-badge";
  return {
    label: `$(sparkle) ${rec.sessionModel.name}`,
    description: `${formatCostLabel(rec)} · ${rec.contextWindow} · think:${rec.thinkingEffort}`,
    detail: `${rec.rationale} [${badges}]`,
    index,
  };
}

export async function showRecommendations(
  recs: Recommendation[],
  warnings: string[]
): Promise<RecommendationChoice | undefined> {
  if (warnings.length > 0) {
    // Show first warning only to avoid flooding; rest still in logs via console.
    void vscode.window.showWarningMessage(warnings[0]!);
    if (warnings.length > 1) {
      console.warn("[Task Model Advisor]", warnings.join(" | "));
    }
  }

  if (recs.length === 0) return undefined;

  const selected = await vscode.window.showQuickPick<RecQuickPickItem>(
    recs.map((rec, index) => formatRecommendationItem(rec, index)),
    {
      placeHolder: "Choisissez une recommandation (coût = $/1M tokens AA)",
      matchOnDescription: true,
      matchOnDetail: true,
    }
  );
  if (!selected) return undefined;

  const action = await vscode.window.showQuickPick<ActionQuickPickItem>(
    ACTIONS,
    { placeHolder: "Action" }
  );
  if (!action) return undefined;

  return { action: action.actionId, index: selected.index };
}
