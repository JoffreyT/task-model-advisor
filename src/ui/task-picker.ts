import * as vscode from "vscode";
import type { Messages } from "../i18n/types";
import { classifyOther } from "../task/classify-other";
import { TASK_PRESETS } from "../task/presets";
import type { TaskProfileId } from "../types";

type PresetQuickPickItem = vscode.QuickPickItem & { profileId: TaskProfileId };

export async function pickTask(
  messages: Messages
): Promise<{ profileId: TaskProfileId; customText?: string } | undefined> {
  const preset = await vscode.window.showQuickPick<PresetQuickPickItem>(
    TASK_PRESETS.map((p) => ({ label: messages.task.presets[p.id], profileId: p.id })),
    { placeHolder: messages.task.placeholder }
  );
  if (!preset) return undefined;

  if (preset.profileId !== "other") {
    return { profileId: preset.profileId };
  }

  const text = await vscode.window.showInputBox({
    prompt: messages.task.otherPrompt,
    placeHolder: messages.task.otherPlaceholder,
  });
  if (text === undefined) return undefined;

  const trimmed = text.trim();
  if (!trimmed) return undefined;

  return { profileId: classifyOther(trimmed), customText: trimmed };
}
