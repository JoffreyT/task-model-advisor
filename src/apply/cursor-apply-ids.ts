import type { Recommendation } from "../types";

export interface CursorModelParam {
  id: string;
  value: string;
}

/** Cursor model ids are usually kebab slugs (`grok-4.7`); fallbacks may be display names. */
export function candidateModelIds(rec: Recommendation): string[] {
  const raw = [rec.sessionModel.id, rec.sessionModel.name].map((s) => s.trim()).filter(Boolean);
  const guessed = raw.map((s) =>
    s
      .toLowerCase()
      .replace(/[^a-z0-9.]+/g, "-")
      .replace(/^-+|-+$/g, "")
  );
  const out: string[] = [];
  const seen = new Set<string>();
  for (const id of [...raw, ...guessed]) {
    if (!id || seen.has(id)) continue;
    seen.add(id);
    out.push(id);
  }
  return out;
}

/**
 * Map advisor thinking → Cursor model parameter `effort`.
 * `off` omits the param (model default / no extended thinking).
 */
export function thinkingToEffortParams(
  thinking: Recommendation["thinkingEffort"]
): CursorModelParam[] {
  if (thinking === "off") return [];
  return [{ id: "effort", value: thinking }];
}

/**
 * Map advisor context tier → Cursor Max Mode.
 * High-context recommendations enable Max Mode; others leave it off.
 */
export function contextToMaxMode(context: Recommendation["contextWindow"]): boolean {
  return context === "high";
}

/** Params embedded in switchToModelSlug's modelIdWithParams JSON. */
export function buildSwitchParams(rec: Recommendation): CursorModelParam[] {
  const params = thinkingToEffortParams(rec.thinkingEffort);
  // Some catalog models expose a `context` enum; harmless if unsupported.
  if (rec.contextWindow === "high") {
    params.push({ id: "context", value: "high" });
  } else if (rec.contextWindow === "medium") {
    params.push({ id: "context", value: "medium" });
  }
  return params;
}

export function switchToModelSlugArgs(modelId: string, params: CursorModelParam[] = []): object {
  // Observed in Cursor desktop: modelIdWithParams is a JSON string
  // `{ modelId, params: [{ id, value }, ...] }` (params may be empty).
  return {
    modelIdWithParams: JSON.stringify({ modelId, params }),
    modelSlug: modelId,
  };
}

/**
 * Full composer modelConfig shape accepted by
 * `glass.cursorai.action.switchToModelSlugInGlass` / setModelConfig("composer", …).
 * Used as a secondary probe to set maxMode (not covered by modelIdWithParams).
 */
export function composerModelConfigArgs(modelId: string, rec: Recommendation): object {
  const params = buildSwitchParams(rec);
  return {
    modelName: modelId,
    maxMode: contextToMaxMode(rec.contextWindow),
    selectedModels: [{ modelId, parameters: params }],
  };
}
