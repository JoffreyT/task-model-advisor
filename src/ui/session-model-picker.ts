import * as vscode from "vscode";
import type { SessionModel } from "../types";

const ADD_CUSTOM_LABEL = "$(edit) Add a custom model name…";

type FallbackItem = vscode.QuickPickItem & { isCustom?: boolean };

function toSessionModel(label: string): SessionModel {
  const name = label.trim();
  return {
    id: name.toLowerCase().replace(/\s+/g, "-"),
    name,
    vendor: "cursor-manual",
  };
}

/**
 * Cursor does not expose Agent models via vscode.lm.selectChatModels().
 * When discovery is empty, let the user multi-select from a configured list
 * (models they actually see in the Agent picker).
 */
export async function pickFallbackSessionModels(
  candidates: string[]
): Promise<SessionModel[] | undefined> {
  const unique = [...new Set(candidates.map((c) => c.trim()).filter(Boolean))];

  const items: FallbackItem[] = [
    ...unique.map((name) => ({
      label: name,
      picked: true,
    })),
    {
      label: ADD_CUSTOM_LABEL,
      description: "Type a name that appears in your Agent model list",
      isCustom: true,
      picked: false,
    },
  ];

  const selected = await vscode.window.showQuickPick(items, {
    canPickMany: true,
    placeHolder:
      "Cursor does not expose models via vscode.lm — select models from your Agent picker",
    title: "Task Model Advisor — session models (manual)",
  });

  if (!selected || selected.length === 0) return undefined;

  const models: SessionModel[] = [];
  let wantsCustom = false;

  for (const item of selected) {
    if (item.isCustom || item.label === ADD_CUSTOM_LABEL) {
      wantsCustom = true;
      continue;
    }
    models.push(toSessionModel(item.label));
  }

  if (wantsCustom) {
    const custom = await vscode.window.showInputBox({
      prompt: "Model name exactly as shown in Cursor Agent",
      placeHolder: "e.g. Grok 4.7 High Fast",
    });
    if (custom?.trim()) {
      models.push(toSessionModel(custom));
    }
  }

  if (models.length === 0) return undefined;
  return models;
}
