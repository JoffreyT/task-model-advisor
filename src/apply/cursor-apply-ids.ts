import type { Recommendation } from "../types";

/** Cursor model ids are usually kebab slugs (`grok-4.7`); fallbacks may be display names. */
export function candidateModelIds(rec: Recommendation): string[] {
  const raw = [rec.sessionModel.id, rec.sessionModel.name]
    .map((s) => s.trim())
    .filter(Boolean);
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

export function switchToModelSlugArgs(modelId: string): object {
  // Observed in Cursor desktop: modelIdWithParams is a JSON string
  // `{ modelId, params: [{ id, value }, ...] }` (params may be empty).
  return {
    modelIdWithParams: JSON.stringify({ modelId, params: [] }),
    modelSlug: modelId,
  };
}
