# Dedupe Session Models Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Collapse session models that share a display name so the recommendation list shows each name once.

**Architecture:** A VS Code-free function, `dedupeSessionModels`, chooses one `SessionModel` per display name. `discoverSessionModels` runs it on every list it returns, including `vscode.lm.selectChatModels()` and the Cursor CLI or API fallback. Matching and ranking are unchanged.

**Tech Stack:** TypeScript, Vitest, VS Code Extension API (`engines.vscode` ^1.128.0).

## Global Constraints

- Dedupe key is the display name, trimmed, then lowercased. A blank name uses the trimmed, lowercased id. An entry whose name and id are both blank is dropped.
- Prefer an id that is non-empty and contains no whitespace (a Cursor slug). When several ids qualify, keep the earliest. When none qualify, keep the earliest entry.
- The survivor keeps its own `id`, `name`, `family`, and `vendor`. Do not merge fields. It stays in the position of the first entry of its group.
- Only surrounding whitespace is stripped from the key. Internal spaces stay, so `Claude  Sonnet` and `Claude Sonnet` remain two models. Case does not, so `Claude Sonnet 4.5` and `claude sonnet 4.5` become one.
- Names that differ stay separate, including Fast, High, and Thinking variants.
- Do not change ranking, matching thresholds, apply probes, or the existing id-dedupe inside `parseAgentModelsOutput`.
- No fuzzy matching of different labels.
- Commits: optional — repository owner commits manually; skip git commit steps unless explicitly asked.
- Spec source of truth: `docs/superpowers/specs/2026-10-11-dedupe-session-models-design.md`.

## File structure

- Create: `src/host/dedupe-session-models.ts` — pure `dedupeSessionModels`. No `vscode` import.
- Create: `src/__tests__/dedupe-session-models.test.ts` — key, slug preference, order, blank entries.
- Modify: `src/host/model-discovery.ts` — call `dedupeSessionModels` on both returned lists.
- Create: `src/__tests__/model-discovery.test.ts` — `vscode.lm` duplicates collapse before the list is returned.

---

### Task 1: Display-name dedupe

**Files:**

- Create: `src/host/dedupe-session-models.ts`
- Test: `src/__tests__/dedupe-session-models.test.ts`

**Interfaces:**

- Consumes: `SessionModel` from `src/types.ts` (`id: string`, `name: string`, optional `family`, optional `vendor`).
- Produces: `dedupeSessionModels(models: SessionModel[]): SessionModel[]`

- [ ] **Step 1: Write the failing test**

Create `src/__tests__/dedupe-session-models.test.ts`:

```typescript
import { describe, expect, it } from "vitest";
import { dedupeSessionModels } from "../host/dedupe-session-models";
import type { SessionModel } from "../types";

function model(partial: SessionModel): SessionModel {
  return partial;
}

describe("dedupeSessionModels", () => {
  it("keeps the slug id when the same display name has a spaced id", () => {
    const models = dedupeSessionModels([
      model({
        id: "Claude Sonnet 4.5",
        name: "Claude Sonnet 4.5",
        family: "display",
        vendor: "a",
      }),
      model({ id: "other", name: "Other", vendor: "b" }),
      model({
        id: "claude-4.5-sonnet",
        name: "Claude Sonnet 4.5",
        family: "slug",
        vendor: "cursor",
      }),
    ]);

    expect(models).toEqual([
      {
        id: "claude-4.5-sonnet",
        name: "Claude Sonnet 4.5",
        family: "slug",
        vendor: "cursor",
      },
      { id: "other", name: "Other", vendor: "b" },
    ]);
  });

  it("keeps the earliest slug when several ids have no whitespace", () => {
    const models = dedupeSessionModels([
      model({ id: "claude-4.5-sonnet", name: "Claude Sonnet 4.5", vendor: "first" }),
      model({ id: "anthropic/claude-4.5-sonnet", name: "Claude Sonnet 4.5", vendor: "second" }),
    ]);

    expect(models).toEqual([
      { id: "claude-4.5-sonnet", name: "Claude Sonnet 4.5", vendor: "first" },
    ]);
  });

  it("keeps the earliest entry when every id contains whitespace", () => {
    const models = dedupeSessionModels([
      model({ id: "Display One", name: "Claude Sonnet 4.5", vendor: "first" }),
      model({ id: "Display Two", name: "claude sonnet 4.5", vendor: "second" }),
    ]);

    expect(models).toEqual([{ id: "Display One", name: "Claude Sonnet 4.5", vendor: "first" }]);
  });

  it("leaves variants with different display names separate", () => {
    const models = dedupeSessionModels([
      model({ id: "grok-4.7", name: "Grok 4.7" }),
      model({ id: "grok-4.7-high-fast", name: "Grok 4.7 High Fast" }),
    ]);

    expect(models.map((m) => m.name)).toEqual(["Grok 4.7", "Grok 4.7 High Fast"]);
  });

  it("treats internal double spaces as a different name", () => {
    const models = dedupeSessionModels([
      model({ id: "a", name: "Claude  Sonnet" }),
      model({ id: "b", name: "Claude Sonnet" }),
    ]);

    expect(models.map((m) => m.id)).toEqual(["a", "b"]);
  });

  it("keys a blank name by id and drops an entry with no name and no id", () => {
    const models = dedupeSessionModels([
      model({ id: "alpha-id", name: "   " }),
      model({ id: "beta-id", name: "" }),
      model({ id: "   ", name: "  " }),
    ]);

    expect(models).toEqual([
      { id: "alpha-id", name: "   " },
      { id: "beta-id", name: "" },
    ]);
  });

  it("preserves the relative order of distinct names", () => {
    const models = dedupeSessionModels([
      model({ id: "b", name: "Beta" }),
      model({ id: "a", name: "Alpha" }),
      model({ id: "c", name: "Gamma" }),
    ]);

    expect(models.map((m) => m.name)).toEqual(["Beta", "Alpha", "Gamma"]);
  });

  it("returns an empty list unchanged", () => {
    expect(dedupeSessionModels([])).toEqual([]);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/__tests__/dedupe-session-models.test.ts`

Expected: FAIL because `../host/dedupe-session-models` cannot be resolved.

- [ ] **Step 3: Write the minimal implementation**

Create `src/host/dedupe-session-models.ts`:

```typescript
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
```

`Map` keeps insertion order, and `set` on an existing key replaces the value without moving it. A blank id is not a slug. The stored object is the winning `SessionModel`, so `family` and `vendor` are not copied from the discarded duplicate.

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/__tests__/dedupe-session-models.test.ts`

Expected: PASS

---

### Task 2: Dedupe every discovered list

**Files:**

- Modify: `src/host/model-discovery.ts`
- Test: `src/__tests__/model-discovery.test.ts`

**Interfaces:**

- Consumes: `dedupeSessionModels(models: SessionModel[]): SessionModel[]` from Task 1.
- Produces: `discoverSessionModels` returns already-deduped `models` for both the `vscode.lm` path and the Cursor CLI or API path.

- [ ] **Step 1: Write the failing test**

Create `src/__tests__/model-discovery.test.ts`:

```typescript
import { describe, expect, it, vi } from "vitest";

vi.mock("vscode", () => ({
  lm: { selectChatModels: vi.fn() },
  env: { appName: "Cursor" },
}));

import * as vscode from "vscode";
import { discoverSessionModels } from "../host/model-discovery";

describe("discoverSessionModels", () => {
  it("dedupes vscode.lm models that share a display name", async () => {
    vi.mocked(vscode.lm.selectChatModels).mockResolvedValue([
      { id: "Claude Sonnet 4.5", name: "Claude Sonnet 4.5", vendor: "a", family: "display" },
      { id: "claude-4.5-sonnet", name: "Claude Sonnet 4.5", vendor: "cursor", family: "slug" },
    ] as Awaited<ReturnType<typeof vscode.lm.selectChatModels>>);

    const result = await discoverSessionModels();

    expect(result.models).toEqual([
      {
        id: "claude-4.5-sonnet",
        name: "Claude Sonnet 4.5",
        vendor: "cursor",
        family: "slug",
      },
    ]);
    expect(result.warnings).toEqual([]);
  });
});
```

The mock must return a non-empty list. An empty list falls through to the Cursor CLI and would spawn `agent`.

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/__tests__/model-discovery.test.ts`

Expected: FAIL because both models are returned (`result.models` has length 2).

- [ ] **Step 3: Call the deduper on both return paths**

In `src/host/model-discovery.ts`, add the import:

```typescript
import { dedupeSessionModels } from "./dedupe-session-models";
```

Replace the `vscode.lm` return:

```typescript
return {
  models: dedupeSessionModels(
    lmModels.map((m) => ({
      id: m.id,
      name: m.name,
      family: m.family,
      vendor: m.vendor,
    }))
  ),
  warnings,
};
```

Replace the Cursor CLI or API return:

```typescript
return { models: dedupeSessionModels(cursor.models), warnings };
```

Leave the empty return as `{ models: [], warnings }`. `parseAgentModelsOutput` stays unchanged.

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/__tests__/model-discovery.test.ts`

Expected: PASS

- [ ] **Step 5: Run the full test suite, the typecheck, and lint**

Run: `npx vitest run`

Expected: PASS

Run: `npx tsc -p . --noEmit`

Expected: exit 0

Run: `npx eslint src --max-warnings 0`

Expected: exit 0
