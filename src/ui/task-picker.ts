import * as vscode from "vscode";
import type { Messages } from "../i18n/types";
import { classifyOther } from "../task/classify-other";
import { engineForPreset, TASK_PRESETS } from "../task/presets";
import type { RankingEngineId, TaskPresetId } from "../types";

type PresetQuickPickItem = vscode.QuickPickItem & { presetId: TaskPresetId };

export async function pickTask(
  messages: Messages
): Promise<{ presetId: TaskPresetId; engineId: RankingEngineId; customText?: string } | undefined> {
  const preset = await vscode.window.showQuickPick<PresetQuickPickItem>(
    TASK_PRESETS.map((p) => ({ label: messages.task.presets[p.id], presetId: p.id })),
    { placeHolder: messages.task.placeholder }
  );
  if (!preset) return undefined;

  if (preset.presetId !== "other") {
    return { presetId: preset.presetId, engineId: engineForPreset(preset.presetId) };
  }

  const text = await vscode.window.showInputBox({
    prompt: messages.task.otherPrompt,
    placeHolder: messages.task.otherPlaceholder,
  });
  if (text === undefined) return undefined;

  const trimmed = text.trim();
  if (!trimmed) return undefined;

  return { presetId: "other", engineId: classifyOther(trimmed), customText: trimmed };
}
