import * as vscode from "vscode";
import type { Recommendation } from "../types";

export type RecommendationAction = "validate" | "copy" | "refresh";

export type RecommendationChoice = {
  action: RecommendationAction;
  index: number;
};

type RecQuickPickItem = vscode.QuickPickItem & { index: number };

type ActionQuickPickItem = vscode.QuickPickItem & {
  action: RecommendationAction;
};

const ACTIONS: ActionQuickPickItem[] = [
  { label: "Validate", action: "validate" },
  { label: "Copy", action: "copy" },
  { label: "Refresh", action: "refresh" },
];

function formatRecommendationLabel(rec: Recommendation): string {
  const badges =
    rec.badges.length > 0 ? `[${rec.badges.join(", ")}]` : "[]";
  return `$(sparkle) ${rec.sessionModel.name} | ${rec.contextWindow} | think:${rec.thinkingEffort} ${badges} — ${rec.rationale}`;
}

export async function showRecommendations(
  recs: Recommendation[],
  warnings: string[]
): Promise<RecommendationChoice | undefined> {
  if (warnings.length > 0) {
    void vscode.window.showWarningMessage(warnings.join(" "));
  }

  if (recs.length === 0) return undefined;

  const selected = await vscode.window.showQuickPick<RecQuickPickItem>(
    recs.map((rec, index) => ({
      label: formatRecommendationLabel(rec),
      index,
    })),
    { placeHolder: "Choisissez une recommandation" }
  );
  if (!selected) return undefined;

  const action = await vscode.window.showQuickPick<ActionQuickPickItem>(
    ACTIONS,
    { placeHolder: "Action" }
  );
  if (!action) return undefined;

  return { action: action.action, index: selected.index };
}
