import * as vscode from "vscode";
import type { Messages } from "../i18n/types";
import type { Recommendation } from "../types";
import {
  formatRecommendationDescription,
  formatRecommendationDetail,
} from "./format-recommendation";

export type RecommendationAction = "validate" | "copy" | "refresh";

export type RecommendationChoice = {
  action: RecommendationAction;
  index: number;
};

type RecQuickPickItem = vscode.QuickPickItem & { index: number };

type ActionQuickPickItem = vscode.QuickPickItem & {
  actionId: RecommendationAction;
};

function formatRecommendationItem(
  rec: Recommendation,
  index: number,
  recs: Recommendation[],
  messages: Messages
): RecQuickPickItem {
  return {
    label: `$(sparkle) ${rec.sessionModel.name}`,
    description: formatRecommendationDescription(rec, messages),
    detail: formatRecommendationDetail(rec, recs, messages),
    index,
  };
}

function buildActions(messages: Messages): ActionQuickPickItem[] {
  return [
    { label: `$(check) ${messages.actions.apply}`, actionId: "validate" },
    { label: `$(copy) ${messages.actions.copy}`, actionId: "copy" },
    { label: `$(refresh) ${messages.actions.refresh}`, actionId: "refresh" },
  ];
}

export async function showRecommendations(
  recs: Recommendation[],
  warnings: string[],
  taskLabel: string,
  messages: Messages
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
    recs.map((rec, index) => formatRecommendationItem(rec, index, recs, messages)),
    {
      title: taskLabel,
      placeHolder: messages.recommendations.placeholder,
      matchOnDescription: true,
      matchOnDetail: true,
    }
  );
  if (!selected) return undefined;

  const action = await vscode.window.showQuickPick<ActionQuickPickItem>(buildActions(messages), {
    placeHolder: messages.actions.placeholder,
  });
  if (!action) return undefined;

  return { action: action.actionId, index: selected.index };
}
