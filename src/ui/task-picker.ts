import * as vscode from "vscode";
import { classifyOther } from "../task/classify-other";
import { TASK_PRESETS } from "../task/presets";
import type { TaskProfileId } from "../types";

type PresetQuickPickItem = vscode.QuickPickItem & { profileId: TaskProfileId };

export async function pickTask(): Promise<
  { profileId: TaskProfileId; customText?: string } | undefined
> {
  const preset = await vscode.window.showQuickPick<PresetQuickPickItem>(
    TASK_PRESETS.map((p) => ({ label: p.label, profileId: p.id })),
    { placeHolder: "Quel type de tâche ?" }
  );
  if (!preset) return undefined;

  if (preset.profileId !== "other") {
    return { profileId: preset.profileId };
  }

  const text = await vscode.window.showInputBox({
    prompt: "Décrivez la tâche",
    placeHolder: "Ex. refactorer le module auth",
  });
  if (text === undefined) return undefined;

  const trimmed = text.trim();
  if (!trimmed) return undefined;

  return { profileId: classifyOther(trimmed), customText: trimmed };
}
