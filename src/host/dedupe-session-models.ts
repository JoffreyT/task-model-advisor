import type { SessionModel } from "../types";

function dedupeKey(model: SessionModel): string | null {
  const name = model.name.trim().toLowerCase();
  if (name) return name;
  const id = model.id.trim().toLowerCase();
  if (id) return id;
  return null;
}

function isSlugId(id: string): boolean {
  return id.trim().length > 0 && !/\s/.test(id);
}

export function dedupeSessionModels(models: SessionModel[]): SessionModel[] {
  const chosen = new Map<string, SessionModel>();

  for (const model of models) {
    const key = dedupeKey(model);
    if (!key) continue;

    const current = chosen.get(key);
    if (!current) {
      chosen.set(key, model);
      continue;
    }

    if (!isSlugId(current.id) && isSlugId(model.id)) {
      chosen.set(key, model);
    }
  }

  return [...chosen.values()];
}
