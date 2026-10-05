import * as vscode from "vscode";
import type { AdvisorConfig, Recommendation, TaskProfileId } from "../types";

export interface ClipboardPayload {
  model: string;
  modelId: string;
  contextWindow: Recommendation["contextWindow"];
  thinkingEffort: Recommendation["thinkingEffort"];
  task: TaskProfileId;
  rank: number;
  scoreBreakdown: Recommendation["breakdown"];
}

export function toClipboardPayload(
  rec: Recommendation,
  profileId: TaskProfileId,
  rank = 1
): ClipboardPayload {
  return {
    model: rec.sessionModel.name,
    modelId: rec.sessionModel.id,
    contextWindow: rec.contextWindow,
    thinkingEffort: rec.thinkingEffort,
    task: profileId,
    rank,
    scoreBreakdown: { ...rec.breakdown },
  };
}

/**
 * Host-specific command IDs to probe for automatic model selection.
 * Populate after manual discovery on Copilot/Cursor builds; empty list is OK (clipboard fallback).
 */
const AUTO_APPLY_COMMAND_PROBE: string[] = [];

async function writeClipboardPayload(payload: ClipboardPayload): Promise<void> {
  await vscode.env.clipboard.writeText(JSON.stringify(payload, null, 2));
}

function manualApplyMessage(rec: Recommendation): string {
  return `Task Model Advisor: set model to "${rec.sessionModel.name}", context "${rec.contextWindow}", thinking "${rec.thinkingEffort}". Configuration copied to clipboard.`;
}

export async function applyRecommendation(
  rec: Recommendation,
  strategy: AdvisorConfig["applyStrategy"],
  profileId: TaskProfileId,
  rank = 1
): Promise<{ applied: boolean; detail: string }> {
  const payload = toClipboardPayload(rec, profileId, rank);

  if (strategy === "clipboard-only") {
    await writeClipboardPayload(payload);
    const detail = manualApplyMessage(rec);
    void vscode.window.showInformationMessage(detail);
    return { applied: false, detail };
  }

  let applied = false;
  for (const commandId of AUTO_APPLY_COMMAND_PROBE) {
    try {
      await vscode.commands.executeCommand(commandId, {
        modelId: rec.sessionModel.id,
        model: rec.sessionModel.name,
        contextWindow: rec.contextWindow,
        thinkingEffort: rec.thinkingEffort,
      });
      applied = true;
      break;
    } catch {
      // Host may not expose this command; continue probing.
    }
  }

  await writeClipboardPayload(payload);
  const detail = applied
    ? `Task Model Advisor: applied "${rec.sessionModel.name}" (context "${rec.contextWindow}", thinking "${rec.thinkingEffort}"). Configuration also copied to clipboard.`
    : manualApplyMessage(rec);
  void vscode.window.showInformationMessage(detail);
  return { applied, detail };
}

export async function copyRecommendationToClipboard(
  rec: Recommendation,
  profileId: TaskProfileId,
  rank = 1
): Promise<void> {
  await writeClipboardPayload(toClipboardPayload(rec, profileId, rank));
  void vscode.window.showInformationMessage(
    `Task Model Advisor: copied configuration for "${rec.sessionModel.name}" to clipboard.`
  );
}
