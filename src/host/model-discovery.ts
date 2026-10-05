import * as vscode from "vscode";
import type { SessionModel } from "../types";
import { discoverCursorSessionModels } from "./cursor-model-discovery";

export async function discoverSessionModels(opts?: {
  cursorApiKey?: string;
  timeoutMs?: number;
}): Promise<{ models: SessionModel[]; warnings: string[] }> {
  const warnings: string[] = [];

  try {
    const lmModels = await vscode.lm.selectChatModels();
    if (lmModels.length > 0) {
      return {
        models: lmModels.map((m) => ({
          id: m.id,
          name: m.name,
          family: m.family,
          vendor: m.vendor,
        })),
        warnings,
      };
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : "vscode.lm failed";
    warnings.push(`vscode.lm.selectChatModels failed: ${message}`);
  }

  const appName = vscode.env.appName.toLowerCase();
  const looksLikeCursor = appName.includes("cursor");

  if (looksLikeCursor || opts?.cursorApiKey?.trim()) {
    const cursor = await discoverCursorSessionModels({
      apiKey: opts?.cursorApiKey,
      timeoutMs: opts?.timeoutMs ?? 8000,
    });
    if (cursor.models.length > 0) {
      warnings.push(
        `Session models loaded from Cursor (${cursor.source}).`
      );
      return { models: cursor.models, warnings };
    }
    if (cursor.detail) {
      warnings.push(cursor.detail);
    }
  }

  return { models: [], warnings };
}
