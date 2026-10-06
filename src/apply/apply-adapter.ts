import * as vscode from "vscode";
import type { Messages } from "../i18n/types";
import type { AdvisorConfig, Recommendation, TaskProfileId } from "../types";
import {
  buildSwitchParams,
  candidateModelIds,
  composerModelConfigArgs,
  contextToMaxMode,
  switchToModelSlugArgs,
} from "./cursor-apply-ids";

export { candidateModelIds } from "./cursor-apply-ids";

export interface ClipboardPayload {
  model: string;
  modelId: string;
  contextWindow: Recommendation["contextWindow"];
  thinkingEffort: Recommendation["thinkingEffort"];
  task: TaskProfileId;
  rank: number;
  scoreBreakdown: Recommendation["breakdown"];
  blendedPricePer1M: number | null;
  costTier: Recommendation["costTier"];
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
    blendedPricePer1M: rec.blendedPricePer1M,
    costTier: rec.costTier,
  };
}

async function writeClipboardPayload(payload: ClipboardPayload): Promise<void> {
  const text = JSON.stringify(payload, null, 2);
  await vscode.env.clipboard.writeText(text);
}

function isCursorHost(): boolean {
  return vscode.env.appName.toLowerCase().includes("cursor");
}

function manualApplyMessage(rec: Recommendation, messages: Messages): string {
  return messages.notifications.manualApply(
    rec.sessionModel.name,
    messages.notifications.toastPrice(rec.blendedPricePer1M),
    rec.contextWindow,
    rec.thinkingEffort
  );
}

interface ApplyProbe {
  commandId: string;
  arg: unknown;
  kind: "switch" | "new-agent" | "max-mode";
}

function buildCursorModelProbes(modelIds: string[], rec: Recommendation): ApplyProbe[] {
  const params = buildSwitchParams(rec);
  const probes: ApplyProbe[] = [];
  for (const modelId of modelIds) {
    const slugArgs = switchToModelSlugArgs(modelId, params);
    for (const commandId of [
      "cursorai.action.switchToModelSlug",
      "cursorai.action.switchToModelSlugInGlass",
      "glass.cursorai.action.switchToModelSlugInGlass",
    ]) {
      probes.push({ commandId, arg: slugArgs, kind: "switch" });
    }
    for (const commandId of ["newAgentWithModel", "glass.newAgentWithModel"]) {
      probes.push({ commandId, arg: modelId, kind: "new-agent" });
    }
  }
  return probes;
}

function buildCursorMaxModeProbes(modelIds: string[], rec: Recommendation): ApplyProbe[] {
  const probes: ApplyProbe[] = [];
  for (const modelId of modelIds) {
    const config = composerModelConfigArgs(modelId, rec);
    // Glass helper accepts a full modelConfig (incl. maxMode). Desktop may no-op.
    for (const commandId of [
      "glass.cursorai.action.switchToModelSlugInGlass",
      "cursorai.action.switchToModelSlugInGlass",
    ]) {
      probes.push({ commandId, arg: config, kind: "max-mode" });
    }
  }
  return probes;
}

async function runFirstProbe(
  probes: ApplyProbe[]
): Promise<{ ok: boolean; probe?: ApplyProbe; errors: string[] }> {
  const errors: string[] = [];
  for (const probe of probes) {
    try {
      await vscode.commands.executeCommand(probe.commandId, probe.arg);
      return { ok: true, probe, errors };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      errors.push(`${probe.commandId}: ${message}`);
      console.warn("[Task Model Advisor] apply probe failed", probe.commandId, probe.arg, err);
    }
  }
  return { ok: false, errors };
}

/**
 * Best-effort Cursor apply via undocumented commands.
 * 1) switchToModelSlug with effort(/context) params
 * 2) secondary full modelConfig probe for maxMode
 * Do NOT gate on getCommands() — many Cursor actions are filtered from the list.
 */
function probeFailureDetail(errors: string[], messages: Messages): string {
  if (errors.length > 0) {
    const snippet = errors.slice(0, 3).join(" | ") + (errors.length > 3 ? "…" : "");
    return messages.notifications.probesFailed(snippet);
  }
  return messages.notifications.noRunnableProbe;
}

async function tryApplyCursorModel(
  rec: Recommendation,
  messages: Messages
): Promise<{
  ok: boolean;
  commandId?: string;
  kind?: string;
  thinkingApplied: boolean;
  maxModeApplied: boolean;
  maxModeTarget: boolean;
  detail: string;
}> {
  const modelIds = candidateModelIds(rec);
  const maxModeTarget = contextToMaxMode(rec.contextWindow);
  const thinkingApplied = rec.thinkingEffort !== "off";

  const modelResult = await runFirstProbe(buildCursorModelProbes(modelIds, rec));
  if (!modelResult.ok || !modelResult.probe) {
    return {
      ok: false,
      thinkingApplied: false,
      maxModeApplied: false,
      maxModeTarget,
      detail: probeFailureDetail(modelResult.errors, messages),
    };
  }

  let maxModeApplied = false;
  if (modelResult.probe.kind === "switch") {
    const maxResult = await runFirstProbe(buildCursorMaxModeProbes(modelIds, rec));
    maxModeApplied = maxResult.ok;
  }

  return {
    ok: true,
    commandId: modelResult.probe.commandId,
    kind: modelResult.probe.kind,
    thinkingApplied,
    maxModeApplied,
    maxModeTarget,
    detail: modelResult.probe.commandId,
  };
}

function successMessage(
  rec: Recommendation,
  result: Awaited<ReturnType<typeof tryApplyCursorModel>>,
  messages: Messages
): string {
  return messages.notifications.cursorSuccess({
    kind: result.kind === "new-agent" ? "new-agent" : "composer",
    name: rec.sessionModel.name,
    price: messages.notifications.toastPrice(rec.blendedPricePer1M),
    thinking: rec.thinkingEffort,
    thinkingApplied: result.thinkingApplied,
    maxModeApplied: result.maxModeApplied,
    maxModeOn: result.maxModeTarget,
    context: rec.contextWindow,
    commandId: result.commandId ?? "",
  });
}

export async function applyRecommendation(
  rec: Recommendation,
  strategy: AdvisorConfig["applyStrategy"],
  profileId: TaskProfileId,
  messages: Messages,
  rank = 1
): Promise<{ applied: boolean; detail: string }> {
  const payload = toClipboardPayload(rec, profileId, rank);

  try {
    await writeClipboardPayload(payload);

    if (strategy === "clipboard-only") {
      const detail = manualApplyMessage(rec, messages);
      await vscode.window.showInformationMessage(detail);
      return { applied: false, detail };
    }

    if (isCursorHost()) {
      const result = await tryApplyCursorModel(rec, messages);
      if (result.ok) {
        const detail = successMessage(rec, result, messages);
        if (result.maxModeApplied) {
          await vscode.window.showInformationMessage(detail);
        } else {
          await vscode.window.showWarningMessage(detail);
        }
        return { applied: true, detail };
      }

      const detail = `${manualApplyMessage(rec, messages)} (${result.detail})`;
      await vscode.window.showWarningMessage(detail);
      return { applied: false, detail };
    }

    const detail = manualApplyMessage(rec, messages);
    await vscode.window.showInformationMessage(detail);
    return { applied: false, detail };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const detail = messages.notifications.validationFailed(message);
    await vscode.window.showErrorMessage(detail);
    return { applied: false, detail };
  }
}

export async function copyRecommendationToClipboard(
  rec: Recommendation,
  profileId: TaskProfileId,
  messages: Messages,
  rank = 1
): Promise<void> {
  try {
    await writeClipboardPayload(toClipboardPayload(rec, profileId, rank));
    await vscode.window.showInformationMessage(
      messages.notifications.copySuccess(
        rec.sessionModel.name,
        messages.notifications.toastPrice(rec.blendedPricePer1M)
      )
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await vscode.window.showErrorMessage(messages.notifications.copyFailed(message));
  }
}
