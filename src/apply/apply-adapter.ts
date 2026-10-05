import * as vscode from "vscode";
import type { AdvisorConfig, Recommendation, TaskProfileId } from "../types";
import {
  candidateModelIds,
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

function formatPrice(rec: Recommendation): string {
  if (rec.blendedPricePer1M != null && Number.isFinite(rec.blendedPricePer1M)) {
    return `~$${rec.blendedPricePer1M.toFixed(2)}/1M`;
  }
  return "prix inconnu";
}

function isCursorHost(): boolean {
  return vscode.env.appName.toLowerCase().includes("cursor");
}

function manualApplyMessage(rec: Recommendation): string {
  return `Task Model Advisor: modèle "${rec.sessionModel.name}" (${formatPrice(rec)}), contexte "${rec.contextWindow}", thinking "${rec.thinkingEffort}". Config copiée — applique-les manuellement dans le sélecteur Agent.`;
}

interface ApplyProbe {
  commandId: string;
  arg: unknown;
  kind: "switch" | "new-agent";
}

function buildCursorApplyProbes(modelIds: string[]): ApplyProbe[] {
  const probes: ApplyProbe[] = [];
  for (const modelId of modelIds) {
    const slugArgs = switchToModelSlugArgs(modelId);
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

/**
 * Best-effort Cursor apply via undocumented commands.
 * Prefer switchToModelSlug (current composer); fall back to newAgentWithModel (Glass).
 * Do NOT gate on getCommands() — many Cursor actions are registered but filtered from the list.
 */
async function tryApplyCursorModel(
  rec: Recommendation
): Promise<{ ok: boolean; commandId?: string; kind?: string; detail: string }> {
  const modelIds = candidateModelIds(rec);
  const probes = buildCursorApplyProbes(modelIds);
  const errors: string[] = [];

  for (const probe of probes) {
    try {
      await vscode.commands.executeCommand(probe.commandId, probe.arg);
      return {
        ok: true,
        commandId: probe.commandId,
        kind: probe.kind,
        detail: `${probe.commandId} (${probe.kind})`,
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      errors.push(`${probe.commandId}: ${message}`);
      console.warn(
        "[Task Model Advisor] apply probe failed",
        probe.commandId,
        probe.arg,
        err
      );
    }
  }

  // Optional diagnostic: which related commands exist in this build?
  try {
    const available = await vscode.commands.getCommands(true);
    const related = available
      .filter((id) =>
        /model|agent|composer\.|cursorai\.|glass\./i.test(id)
      )
      .sort()
      .slice(0, 40);
    console.info(
      "[Task Model Advisor] related commands sample:",
      related.join(", ")
    );
  } catch {
    // ignore
  }

  return {
    ok: false,
    detail:
      errors.length > 0
        ? `probes échouées (${errors.slice(0, 3).join(" | ")}${errors.length > 3 ? "…" : ""})`
        : "aucune sonde exécutable",
  };
}

export async function applyRecommendation(
  rec: Recommendation,
  strategy: AdvisorConfig["applyStrategy"],
  profileId: TaskProfileId,
  rank = 1
): Promise<{ applied: boolean; detail: string }> {
  const payload = toClipboardPayload(rec, profileId, rank);

  try {
    await writeClipboardPayload(payload);

    if (strategy === "clipboard-only") {
      const detail = manualApplyMessage(rec);
      await vscode.window.showInformationMessage(detail);
      return { applied: false, detail };
    }

    if (isCursorHost()) {
      const result = await tryApplyCursorModel(rec);
      if (result.ok) {
        const via =
          result.kind === "new-agent"
            ? "nouvel Agent"
            : "modèle du composer courant";
        const detail = `Task Model Advisor: ${via} → "${rec.sessionModel.name}" (${formatPrice(rec)}) via ${result.commandId}. Context/thinking manuels (${rec.contextWindow} / ${rec.thinkingEffort}). Config aussi copiée.`;
        await vscode.window.showInformationMessage(detail);
        return { applied: true, detail };
      }

      const detail = `${manualApplyMessage(rec)} (${result.detail})`;
      await vscode.window.showWarningMessage(detail);
      return { applied: false, detail };
    }

    const detail = manualApplyMessage(rec);
    await vscode.window.showInformationMessage(detail);
    return { applied: false, detail };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const detail = `Task Model Advisor: échec validation (${message}).`;
    await vscode.window.showErrorMessage(detail);
    return { applied: false, detail };
  }
}

export async function copyRecommendationToClipboard(
  rec: Recommendation,
  profileId: TaskProfileId,
  rank = 1
): Promise<void> {
  try {
    await writeClipboardPayload(toClipboardPayload(rec, profileId, rank));
    await vscode.window.showInformationMessage(
      `Task Model Advisor: config copiée pour "${rec.sessionModel.name}" (${formatPrice(rec)}).`
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await vscode.window.showErrorMessage(
      `Task Model Advisor: impossible de copier (${message}).`
    );
  }
}
