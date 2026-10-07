# Public Task Presets Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the five personal task profiles with 8 public QuickPick labels + Autre, ranked through 5 engines (`coding`, `reasoning`, `writing`, `cheap`, `balanced`).

**Architecture:** Split identity: `TaskPresetId` is what the user picks (i18n, clipboard `task`); `RankingEngineId` is what scoring, Arena category, and context/thinking defaults use. A static `PRESET_ENGINE` map plus `classifyOther` for Autre resolve preset → engine once in the picker. The ranker never sees preset ids.

**Tech Stack:** TypeScript, VS Code Extension API, Vitest.

## Global Constraints

- Spec source of truth: `docs/superpowers/specs/2026-10-07-public-task-presets-design.md`.
- QuickPick has exactly 9 rows (8 presets + Autre last). No two-level picker. No LLM classifier.
- Ranker APIs take `RankingEngineId` only. Clipboard writes both `task` (preset id) and `engine` (engine id).
- Delete `TaskProfileId`. Do not leave a compatibility alias.
- Removed preset ids: `pythonScript`, `testScenario`. `spec` and `userStory` stay as preset ids mapped to `writing`.
- `tests` uses engine `reasoning`. `writeCode` and `refactor` share `coding`. `debug` and `codeReview` share `reasoning`.
- Commits: optional — repository owner commits manually; skip git commit steps unless explicitly asked.
- Shell commands in this repo use the `rtk` prefix (e.g. `rtk npm test`).
- Tasks 1–5 are a type-breaking rename. Do not expect a green full `rtk npm test` until Task 6. Gate each task with the vitest file(s) named in that task. After Task 1, stub `classifyOther` to `return "balanced"` so `src/task/classify-other.ts` typechecks; Task 3 replaces the stub. Leave picker/ranker/recommend red until their tasks.

## File structure

- Modify: `src/types.ts` — `TaskPresetId`, `RankingEngineId`; `AdvisorConfig.arena.categories` keyed by engine.
- Modify: `src/constants.ts` — `ARENA_CATEGORIES` keyed by `RankingEngineId`.
- Modify: `src/task/presets.ts` — 9 presets + `PRESET_ENGINE` + `engineForPreset`.
- Modify: `src/task/classify-other.ts` — returns `RankingEngineId`.
- Modify: `src/ranking/task-ranker.ts` — `engineId` instead of `profileId`.
- Modify: `src/ui/task-picker.ts` — returns `{ presetId, engineId, customText? }`.
- Modify: `src/commands/recommend.ts` — fetch/rank by engine; UI/clipboard by preset.
- Modify: `src/apply/apply-adapter.ts` — clipboard `task` + `engine`.
- Modify: `src/i18n/{types,en,fr}.ts` — nine preset labels.
- Modify: `src/ranking/eval-matrix.ts` — iterate engines, not old profiles.
- Modify: tests listed per task; `CONTRIBUTING.md` ranking tables.

---

### Task 1: Types, engine Arena map, preset → engine table

**Files:**

- Modify: `src/types.ts`
- Modify: `src/constants.ts`
- Modify: `src/task/presets.ts`
- Test: `src/__tests__/classify-other.test.ts` (preset list + map; classifier tests stay failing until Task 3)

**Interfaces:**

- Consumes: nothing new.
- Produces:
  - `TaskPresetId = "writeCode" | "debug" | "refactor" | "codeReview" | "spec" | "userStory" | "tests" | "cheap" | "other"`
  - `RankingEngineId = "coding" | "reasoning" | "writing" | "cheap" | "balanced"`
  - `PRESET_ENGINE: Record<Exclude<TaskPresetId, "other">, RankingEngineId>`
  - `engineForPreset(id: Exclude<TaskPresetId, "other">): RankingEngineId`
  - `ARENA_CATEGORIES: Record<RankingEngineId, string>`
  - `AdvisorConfig.arena.categories: Record<RankingEngineId, string>`

- [ ] **Step 1: Rewrite the failing preset-list test**

Replace the `TASK_PRESETS` describe in `src/__tests__/classify-other.test.ts` with:

```ts
import { describe, it, expect } from "vitest";
import { classifyOther } from "../task/classify-other";
import { engineForPreset, PRESET_ENGINE, TASK_PRESETS } from "../task/presets";
import type { RankingEngineId, TaskPresetId } from "../types";

describe("TASK_PRESETS", () => {
  it("has nine entries ending with other", () => {
    expect(TASK_PRESETS.map((p) => p.id)).toEqual([
      "writeCode",
      "debug",
      "refactor",
      "codeReview",
      "spec",
      "userStory",
      "tests",
      "cheap",
      "other",
    ]);
  });

  it("maps every non-other preset to an engine", () => {
    const expected: Record<Exclude<TaskPresetId, "other">, RankingEngineId> = {
      writeCode: "coding",
      debug: "reasoning",
      refactor: "coding",
      codeReview: "reasoning",
      spec: "writing",
      userStory: "writing",
      tests: "reasoning",
      cheap: "cheap",
    };
    expect(PRESET_ENGINE).toEqual(expected);
    for (const id of Object.keys(expected) as Array<Exclude<TaskPresetId, "other">>) {
      expect(engineForPreset(id)).toBe(expected[id]);
    }
  });
});
```

Leave the existing `classifyOther` tests in this file for Task 3 (they will fail after types change; update their expected engines in Task 3, not here).

- [ ] **Step 2: Run the preset tests to verify they fail**

Run: `rtk npx vitest run src/__tests__/classify-other.test.ts`

Expected: FAIL — old five ids / missing `PRESET_ENGINE`.

- [ ] **Step 3: Replace `TaskProfileId` and Arena categories**

In `src/types.ts`, replace the first line with:

```ts
export type TaskPresetId =
  | "writeCode"
  | "debug"
  | "refactor"
  | "codeReview"
  | "spec"
  | "userStory"
  | "tests"
  | "cheap"
  | "other";

export type RankingEngineId = "coding" | "reasoning" | "writing" | "cheap" | "balanced";
```

In `AdvisorConfig`, change `categories: Record<TaskProfileId, string>` to `categories: Record<RankingEngineId, string>`.

Remove every remaining `TaskProfileId` import/use as you touch files. After this task, TypeScript will error in ranker/picker/i18n until later tasks; that is expected if you implement types first. Prefer landing types + presets + constants together so `config.ts` still typechecks:

`src/constants.ts`:

```ts
import type { ApplyStrategy, ArenaSource, RankingWeights, RankingEngineId } from "./types";

export const ARENA_SOURCE: ArenaSource = "wulong-mirror";

export const ARENA_CATEGORIES: Record<RankingEngineId, string> = {
  coding: "coding",
  reasoning: "hard_prompts",
  writing: "text",
  cheap: "text",
  balanced: "text",
};
```

Keep the rest of `constants.ts` unchanged.

`src/task/presets.ts`:

```ts
import type { RankingEngineId, TaskPresetId } from "../types";

export const TASK_PRESETS: Array<{ id: TaskPresetId }> = [
  { id: "writeCode" },
  { id: "debug" },
  { id: "refactor" },
  { id: "codeReview" },
  { id: "spec" },
  { id: "userStory" },
  { id: "tests" },
  { id: "cheap" },
  { id: "other" },
];

export const PRESET_ENGINE: Record<Exclude<TaskPresetId, "other">, RankingEngineId> = {
  writeCode: "coding",
  debug: "reasoning",
  refactor: "coding",
  codeReview: "reasoning",
  spec: "writing",
  userStory: "writing",
  tests: "reasoning",
  cheap: "cheap",
};

export function engineForPreset(id: Exclude<TaskPresetId, "other">): RankingEngineId {
  return PRESET_ENGINE[id];
}
```

- [ ] **Step 4: Run the preset tests**

Run: `rtk npx vitest run src/__tests__/classify-other.test.ts`

Expected: preset describe PASS; `classifyOther` tests still FAIL (old expected ids) until Task 3.

---

### Task 2: i18n labels

**Files:**

- Modify: `src/i18n/types.ts`
- Modify: `src/i18n/en.ts`
- Modify: `src/i18n/fr.ts`
- Test: `src/__tests__/i18n.test.ts`

**Interfaces:**

- Consumes: `TaskPresetId`
- Produces: `messages.task.presets: Record<TaskPresetId, string>` with the approved copy

- [ ] **Step 1: Write the failing copy assertions**

In `src/__tests__/i18n.test.ts`, replace the spec-label assertions with:

```ts
expect(en.task.presets.writeCode).toBe("Write / edit code");
expect(en.task.presets.debug).toBe("Debug / explain a bug");
expect(en.task.presets.refactor).toBe("Refactor / restructure");
expect(en.task.presets.codeReview).toBe("Review code / find issues");
expect(en.task.presets.spec).toBe("Write a spec / technical doc");
expect(en.task.presets.userStory).toBe("Write a user story");
expect(en.task.presets.tests).toBe("Write tests / scenarios");
expect(en.task.presets.cheap).toBe("Quick task / cheaper model");
expect(en.task.presets.other).toBe("Other…");

expect(fr.task.presets.writeCode).toBe("Écrire / modifier du code");
expect(fr.task.presets.debug).toBe("Déboguer / expliquer un bug");
expect(fr.task.presets.refactor).toBe("Refactorer / restructurer");
expect(fr.task.presets.codeReview).toBe("Revue de code / trouver des problèmes");
expect(fr.task.presets.spec).toBe("Écrire une spec / doc technique");
expect(fr.task.presets.userStory).toBe("Écrire une user story");
expect(fr.task.presets.tests).toBe("Écrire des tests / scénarios");
expect(fr.task.presets.cheap).toBe("Tâche rapide / modèle pas cher");
expect(fr.task.presets.other).toBe("Autre…");
```

- [ ] **Step 2: Run i18n tests to verify they fail**

Run: `rtk npx vitest run src/__tests__/i18n.test.ts`

Expected: FAIL on old strings / missing keys.

- [ ] **Step 3: Update catalogs**

`src/i18n/types.ts`: `import type { TaskPresetId } from "../types"` and `presets: Record<TaskPresetId, string>`.

`src/i18n/en.ts` presets:

```ts
presets: {
  writeCode: "Write / edit code",
  debug: "Debug / explain a bug",
  refactor: "Refactor / restructure",
  codeReview: "Review code / find issues",
  spec: "Write a spec / technical doc",
  userStory: "Write a user story",
  tests: "Write tests / scenarios",
  cheap: "Quick task / cheaper model",
  other: "Other…",
},
```

`src/i18n/fr.ts` presets:

```ts
presets: {
  writeCode: "Écrire / modifier du code",
  debug: "Déboguer / expliquer un bug",
  refactor: "Refactorer / restructurer",
  codeReview: "Revue de code / trouver des problèmes",
  spec: "Écrire une spec / doc technique",
  userStory: "Écrire une user story",
  tests: "Écrire des tests / scénarios",
  cheap: "Tâche rapide / modèle pas cher",
  other: "Autre…",
},
```

- [ ] **Step 4: Run i18n tests**

Run: `rtk npx vitest run src/__tests__/i18n.test.ts`

Expected: PASS.

---

### Task 3: Autre classifier → engine

**Files:**

- Modify: `src/task/classify-other.ts`
- Test: `src/__tests__/classify-other.test.ts`

**Interfaces:**

- Consumes: `RankingEngineId`
- Produces: `classifyOther(text: string): RankingEngineId` — never throws; empty or unknown → `"balanced"`

Rule order (first match wins): `cheap`, then `reasoning`, then `writing`, then `coding`. More specific engines before coding/writing catch-alls.

- [ ] **Step 1: Replace classifier tests**

```ts
describe("classifyOther", () => {
  it("maps python automation to coding", () => {
    expect(classifyOther("écrire un script python pour scraper")).toBe("coding");
  });
  it("maps implement/code keywords to coding", () => {
    expect(classifyOther("implement the auth API")).toBe("coding");
  });
  it("maps user story keywords to writing", () => {
    expect(classifyOther("rédiger une user story Jira")).toBe("writing");
  });
  it("maps spec keywords to writing", () => {
    expect(classifyOther("write a functional specification")).toBe("writing");
  });
  it("maps test scenario keywords to reasoning", () => {
    expect(classifyOther("scénario de test gherkin")).toBe("reasoning");
  });
  it("maps debug keywords to reasoning", () => {
    expect(classifyOther("debug this bug and explain why")).toBe("reasoning");
  });
  it("maps review keywords to reasoning", () => {
    expect(classifyOther("revue de code du PR")).toBe("reasoning");
  });
  it("maps cheap/quick keywords to cheap", () => {
    expect(classifyOther("tâche rapide pas cher")).toBe("cheap");
    expect(classifyOther("quick draft")).toBe("cheap");
  });
  it("prefers cheap when both cheap and coding match", () => {
    expect(classifyOther("quick python script")).toBe("cheap");
  });
  it("defaults to balanced when unclear", () => {
    expect(classifyOther("bonjour")).toBe("balanced");
  });
  it("defaults empty input to balanced", () => {
    expect(classifyOther("   ")).toBe("balanced");
  });
});
```

- [ ] **Step 2: Run classifier tests to verify they fail**

Run: `rtk npx vitest run src/__tests__/classify-other.test.ts`

Expected: FAIL — still returning old preset ids.

- [ ] **Step 3: Implement classifier**

```ts
import type { RankingEngineId } from "../types";

const RULES: Array<{ id: RankingEngineId; patterns: RegExp[] }> = [
  {
    id: "cheap",
    patterns: [/quick/i, /rapide/i, /cheap/i, /pas cher/i, /\bsimple\b/i, /draft/i, /brouillon/i],
  },
  {
    id: "reasoning",
    patterns: [
      /debug/i,
      /\bbug\b/i,
      /explain/i,
      /pourquoi/i,
      /\bwhy\b/i,
      /review/i,
      /revue/i,
      /\btests?\b/i,
      /gherkin/i,
      /sc[eé]nario/i,
    ],
  },
  {
    id: "writing",
    patterns: [
      /sp[eé]c/i,
      /specification/i,
      /documentation/i,
      /\bdocs?\b/i,
      /user story/i,
      /histoire utilisateur/i,
      /cahier des charges/i,
      /\bADR\b/i,
    ],
  },
  {
    id: "coding",
    patterns: [
      /\bcode\b/i,
      /implement/i,
      /implément/i,
      /python/i,
      /script/i,
      /refactor/i,
      /\bAPI\b/i,
      /function/i,
      /fonction/i,
    ],
  },
];

export function classifyOther(text: string): RankingEngineId {
  const t = text.trim();
  if (!t) return "balanced";
  for (const rule of RULES) {
    if (rule.patterns.some((p) => p.test(t))) return rule.id;
  }
  return "balanced";
}
```

- [ ] **Step 4: Run classifier tests**

Run: `rtk npx vitest run src/__tests__/classify-other.test.ts`

Expected: PASS.

---

### Task 4: Ranker keyed by engine

**Files:**

- Modify: `src/ranking/task-ranker.ts`
- Test: `src/__tests__/task-ranker.test.ts`

**Interfaces:**

- Consumes: `RankingEngineId`
- Produces:
  - `RankRecommendationsInput.engineId: RankingEngineId` (remove `profileId`)
  - `resolveEngineWeights(engineId, base): RankingWeights`
  - `rawTaskFit` / `engineDefaults` switched on engine

Engine table (verbatim from spec):

| Engine | taskFit | Arena (already in constants) | Weight tilt vs `0.45 / 0.25 / 0.30` | Default ctx | Default think |
| `coding` | coding × 0.7 + LCB × 0.3 (same fallbacks as old pythonScript) | coding | cost +0.05, arena −0.05 (arena ≥ 0.15) | standard | medium |
| `reasoning` | intelligence | hard_prompts | base | medium | medium |
| `writing` | mean(intel, GDPval/writing) else intel | text | taskFit +0.05, cost −0.05 (cost ≥ 0.15) | high | medium |
| `cheap` | intelligence | text | cost +0.15, taskFit −0.10, arena −0.05 (taskFit ≥ 0.25, arena ≥ 0.15) | standard | low |
| `balanced` | intelligence | text | base | medium | medium |

Keep: context cap by tokens; bump on codebase/repo/monorepo/multi-fichier/large/gros; thinking bump via `REASONING_MODEL_PATTERNS`; weak matches; `diversifyTop3`.

- [ ] **Step 1: Update ranker tests to `engineId`**

Mechanical replacements in `src/__tests__/task-ranker.test.ts`:

- Every `profileId:` → `engineId:`
- `"pythonScript"` → `"coding"`
- `"spec"` → `"writing"`
- `"userStory"` → `"cheap"` **only** in the test `sets profile default context and thinking without reasoning bump` is wrong — userStory used to default thinking `low`. That default now lives on engine `cheap`. Split defaults as follows:
  - Test that still checks high context + medium thinking: `engineId: "writing"`
  - Test that checks standard context: `engineId: "coding"`
  - Add (or convert the old userStory thinking bump test): `engineId: "cheap"` with `reasoningModelPatterns: ["o3"]` still expects thinking **not** `low` (bump from low → medium)
- `"testScenario"` (arena-only tests) → `"reasoning"`
- `"other"` (at-most-three / rationale) → `"balanced"`
- Rename test titles: `pythonScript` → `coding engine`; `spec profile` → `writing engine`; `cost-sensitive userStory` → `cheap engine` where the test is about cost tilt (`ranks alias-matched enterprise mini…` used `userStory` with custom weights — keep custom weights, use `engineId: "cheap"` or `"balanced"`; weights are passed in so engine tilt is extra. Use `"balanced"` there so the test stays about matcher+cost weights, not engine tilt.)

Add this new test:

```ts
it("cheap engine defaults to standard context and low thinking", () => {
  const matched = [
    {
      session: { id: "plain", name: "Plain" },
      benchmark: {
        slug: "plain",
        name: "Plain",
        intelligence: 70,
        blendedPricePer1M: 2,
        evaluations: {},
      },
      score: 1,
      badges: ["matched" as const],
    },
  ];
  const top = rankRecommendations({
    matched,
    arena: [],
    engineId: "cheap",
    weights: { taskFit: 1, arena: 0, cost: 0 },
    reasoningModelPatterns: [],
  });
  expect(top[0].contextWindow).toBe("standard");
  expect(top[0].thinkingEffort).toBe("low");
});
```

Add a `resolveEngineWeights` test:

```ts
import {
  absoluteCostScore,
  rankRecommendations,
  resolveEngineWeights,
} from "../ranking/task-ranker";

describe("resolveEngineWeights", () => {
  const base = { taskFit: 0.45, arena: 0.25, cost: 0.3 };
  it("tilts writing toward taskFit", () => {
    expect(resolveEngineWeights("writing", base)).toEqual({
      taskFit: 0.5,
      arena: 0.25,
      cost: 0.25,
    });
  });
  it("tilts coding toward cost", () => {
    expect(resolveEngineWeights("coding", base)).toEqual({
      taskFit: 0.45,
      arena: 0.2,
      cost: 0.35,
    });
  });
  it("tilts cheap strongly toward cost", () => {
    expect(resolveEngineWeights("cheap", base)).toEqual({
      taskFit: 0.35,
      arena: 0.2,
      cost: 0.45,
    });
  });
  it("leaves reasoning and balanced at base", () => {
    expect(resolveEngineWeights("reasoning", base)).toEqual(base);
    expect(resolveEngineWeights("balanced", base)).toEqual(base);
  });
});
```

- [ ] **Step 2: Run ranker tests to verify they fail**

Run: `rtk npx vitest run src/__tests__/task-ranker.test.ts`

Expected: FAIL — `profileId` still required / unknown engine ids.

- [ ] **Step 3: Switch the ranker**

In `src/ranking/task-ranker.ts`:

- Import `RankingEngineId` instead of `TaskProfileId`.
- `RankRecommendationsInput.engineId: RankingEngineId` (delete `profileId`).
- `rawTaskFit(benchmark, engineId)`:
  - `"coding"`: copy the old `pythonScript` branch unchanged.
  - `"writing"`: copy the old `spec` branch unchanged.
  - `"reasoning" | "cheap" | "balanced"`: `benchmark.intelligence ?? 0`.
- `engineDefaults(engineId)` (rename from `profileDefaults`):

```ts
function engineDefaults(engineId: RankingEngineId): {
  contextWindow: ContextWindow;
  thinkingEffort: ThinkingEffort;
} {
  switch (engineId) {
    case "writing":
      return { contextWindow: "high", thinkingEffort: "medium" };
    case "coding":
      return { contextWindow: "standard", thinkingEffort: "medium" };
    case "cheap":
      return { contextWindow: "standard", thinkingEffort: "low" };
    case "reasoning":
    case "balanced":
    default:
      return { contextWindow: "medium", thinkingEffort: "medium" };
  }
}
```

- `resolveContextWindow` / `rankRecommendations` take `engineId` and call `engineDefaults(engineId)`.
- Replace `resolveProfileWeights` with:

```ts
export function resolveEngineWeights(
  engineId: RankingEngineId,
  base: RankingWeights
): RankingWeights {
  switch (engineId) {
    case "writing":
      return {
        taskFit: base.taskFit + 0.05,
        arena: base.arena,
        cost: Math.max(0.15, base.cost - 0.05),
      };
    case "coding":
      return {
        taskFit: base.taskFit,
        arena: Math.max(0.15, base.arena - 0.05),
        cost: base.cost + 0.05,
      };
    case "cheap":
      return {
        taskFit: Math.max(0.25, base.taskFit - 0.1),
        arena: Math.max(0.15, base.arena - 0.05),
        cost: base.cost + 0.15,
      };
    case "reasoning":
    case "balanced":
    default:
      return { ...base };
  }
}
```

- Inside `rankRecommendations`, `const weights = resolveEngineWeights(engineId, baseWeights)` and pass `engineId` into `rawTaskFit` / context helpers.

- [ ] **Step 4: Run ranker tests**

Run: `rtk npx vitest run src/__tests__/task-ranker.test.ts`

Expected: PASS.

---

### Task 5: Picker, command, clipboard

**Files:**

- Modify: `src/ui/task-picker.ts`
- Modify: `src/commands/recommend.ts`
- Modify: `src/apply/apply-adapter.ts`
- Test: add clipboard assertions in `src/__tests__/apply-adapter.test.ts` (export `toClipboardPayload` is already public)

**Interfaces:**

- Consumes: `engineForPreset`, `classifyOther`, `RankingEngineId`, `TaskPresetId`
- Produces:
  - `pickTask(): Promise<{ presetId: TaskPresetId; engineId: RankingEngineId; customText?: string } | undefined>`
  - `fetchBenchmarksAndSession(config, engineId)` uses `config.arena.categories[engineId]`
  - `rankRecommendations({ engineId, ... })`
  - `toClipboardPayload(rec, presetId, engineId, rank)` with `{ task: presetId, engine: engineId, ... }`
  - `applyRecommendation(rec, strategy, presetId, engineId, messages, rank)`
  - `copyRecommendationToClipboard(rec, presetId, engineId, messages, rank)`

- [ ] **Step 1: Write clipboard payload test**

Append to `src/__tests__/apply-adapter.test.ts`:

```ts
import { toClipboardPayload } from "../apply/apply-adapter";

describe("toClipboardPayload", () => {
  it("writes preset id as task and ranking engine as engine", () => {
    const payload = toClipboardPayload(fakeRec(), "writeCode", "coding", 2);
    expect(payload.task).toBe("writeCode");
    expect(payload.engine).toBe("coding");
    expect(payload.rank).toBe(2);
    expect(payload.modelId).toBe("grok-4.6");
  });
});
```

- [ ] **Step 2: Run the new test to verify it fails**

Run: `rtk npx vitest run src/__tests__/apply-adapter.test.ts`

Expected: FAIL — missing `engine` argument / field.

- [ ] **Step 3: Wire picker, adapter, command**

`src/ui/task-picker.ts`:

```ts
import * as vscode from "vscode";
import type { Messages } from "../i18n/types";
import { classifyOther } from "../task/classify-other";
import { engineForPreset, TASK_PRESETS } from "../task/presets";
import type { RankingEngineId, TaskPresetId } from "../types";

type PresetQuickPickItem = vscode.QuickPickItem & { presetId: TaskPresetId };

export async function pickTask(
  messages: Messages
): Promise<{ presetId: TaskPresetId; engineId: RankingEngineId; customText?: string } | undefined> {
  const preset = await vscode.window.showQuickPick<PresetQuickPickItem>(
    TASK_PRESETS.map((p) => ({ label: messages.task.presets[p.id], presetId: p.id })),
    { placeHolder: messages.task.placeholder }
  );
  if (!preset) return undefined;

  if (preset.presetId !== "other") {
    return { presetId: preset.presetId, engineId: engineForPreset(preset.presetId) };
  }

  const text = await vscode.window.showInputBox({
    prompt: messages.task.otherPrompt,
    placeHolder: messages.task.otherPlaceholder,
  });
  if (text === undefined) return undefined;

  const trimmed = text.trim();
  if (!trimmed) return undefined;

  return { presetId: "other", engineId: classifyOther(trimmed), customText: trimmed };
}
```

`src/apply/apply-adapter.ts` — `ClipboardPayload` adds `engine: RankingEngineId`; `task: TaskPresetId`. `toClipboardPayload(rec, presetId, engineId, rank = 1)` sets both. Update `applyRecommendation` and `copyRecommendationToClipboard` signatures to take `presetId` then `engineId` after `strategy` / before `messages`.

`src/commands/recommend.ts`:

- `fetchBenchmarksAndSession(config, engineId: RankingEngineId)` and `const arenaCategory = config.arena.categories[engineId]`.
- After `pickTask`: `const { presetId, engineId, customText } = task`.
- Progress fetch uses `engineId`.
- `rankRecommendations({ ..., engineId, customText })`.
- `taskLabel = customText ? messages.task.presets.other : messages.task.presets[presetId]`.
- Copy/apply pass `presetId, engineId`.

- [ ] **Step 4: Run adapter + suite subset**

Run: `rtk npx vitest run src/__tests__/apply-adapter.test.ts src/__tests__/config.test.ts`

Expected: PASS. (`config.test.ts` still compares `c.arena.categories` to `ARENA_CATEGORIES` — now five engine keys.)

---

### Task 6: Eval matrix + CONTRIBUTING

**Files:**

- Modify: `src/ranking/eval-matrix.ts`
- Modify: `src/__tests__/ranking-eval-matrix.test.ts`
- Modify: `CONTRIBUTING.md`

**Interfaces:**

- Consumes: `RankingEngineId`, `rankRecommendations({ engineId })`
- Produces: `runEvalMatrix()` iterates the five engines (not nine presets). Extra `balanced` rows for `otherCustomTexts`. Report headings are engine ids.

- [ ] **Step 1: Rewrite eval-matrix tests**

```ts
import { describe, expect, it } from "vitest";
import { classifyOther } from "../task/classify-other";
import { engineForPreset, TASK_PRESETS } from "../task/presets";
import { formatEvalReport, runEvalMatrix } from "../ranking/eval-matrix";

describe("ranking eval matrix (all engines)", () => {
  const results = runEvalMatrix();
  const report = formatEvalReport(results);

  it("prints a human-readable matrix for manual review", () => {
    console.log(`\n${report}\n`);
    expect(report).toContain("## writing");
    expect(report).toContain("## coding");
    expect(report).toContain("## reasoning");
    expect(report).toContain("## cheap");
    expect(report).toContain("## balanced");
  });

  it("returns top-3 for every engine scenario", () => {
    expect(results.length).toBeGreaterThanOrEqual(5);
    for (const row of results) {
      expect(row.recommendations.length).toBeGreaterThan(0);
      expect(row.recommendations.length).toBeLessThanOrEqual(3);
    }
  });

  it("prefers high-intelligence models for writing over pure flash", () => {
    const writing = results.find((r) => r.engineId === "writing" && !r.customText);
    expect(writing).toBeDefined();
    const top = writing!.recommendations[0]!;
    expect(top.sessionModel.name).not.toMatch(/GLM|Flash/i);
    expect(top.breakdown.taskFit).toBeGreaterThan(0.5);
  });

  it("ranks a coding-specialist ahead of pure flash for coding", () => {
    const coding = results.find((r) => r.engineId === "coding");
    expect(coding).toBeDefined();
    const top = coding!.recommendations[0]!;
    expect(top.sessionModel.name).toMatch(/Composer|GPT-5|Grok 4\.7|Opus/i);
    expect(top.sessionModel.name).not.toMatch(/GLM 5\.3 Flash/i);
  });

  it("does not rank unmatched Unknown Corp LLM above matched models", () => {
    for (const row of results) {
      const first = row.recommendations[0];
      if (!first) continue;
      if (first.sessionModel.id === "unknown-corp-llm") {
        expect(first.badges).not.toContain("matched");
        expect(row.matchedCount).toBe(0);
      }
    }
  });

  it("bumps context for balanced + large-codebase custom text vs plain balanced", () => {
    const plain = results.find((r) => r.engineId === "balanced" && r.customText === undefined);
    const large = results.find(
      (r) => r.engineId === "balanced" && r.customText?.includes("monorepo") === true
    );
    expect(plain).toBeDefined();
    expect(large).toBeDefined();
    const order = { standard: 0, medium: 1, high: 2 } as const;
    expect(order[large!.recommendations[0]!.contextWindow]).toBeGreaterThanOrEqual(
      order[plain!.recommendations[0]!.contextWindow]
    );
  });

  it("surfaces a mid-tier option in cheap top-3 (not only Opus-class)", () => {
    const cheap = results.find((r) => r.engineId === "cheap");
    expect(cheap).toBeDefined();
    const names = cheap!.recommendations.map((r) => r.sessionModel.name);
    const hasMidTier = names.some((n) => /Grok|Composer|Gemini|GLM|GPT-5\.6/i.test(n));
    expect(hasMidTier).toBe(true);
  });
});

describe("preset → engine smoke", () => {
  it("every non-other preset resolves via engineForPreset", () => {
    for (const { id } of TASK_PRESETS) {
      if (id === "other") continue;
      expect(engineForPreset(id)).toMatch(/^(coding|reasoning|writing|cheap)$/);
    }
  });

  it("maps former free-text samples to engines", () => {
    expect(classifyOther("écrire un script python pour scraper")).toBe("coding");
    expect(classifyOther("scénario de test gherkin")).toBe("reasoning");
    expect(classifyOther("rédiger une user story Jira")).toBe("writing");
  });
});
```

- [ ] **Step 2: Run eval tests to verify they fail**

Run: `rtk npx vitest run src/__tests__/ranking-eval-matrix.test.ts`

Expected: FAIL — still iterating old profile ids.

- [ ] **Step 3: Switch eval-matrix to engines**

```ts
import { FUZZY_THRESHOLD, RANKING_WEIGHTS, REASONING_MODEL_PATTERNS } from "../constants";
import { matchModels } from "../matching/model-matcher";
import type { AdvisorConfig, RankingEngineId, Recommendation } from "../types";
import { formatScoreBreakdown } from "../ui/format-recommendation";
import { EVAL_ALIASES, EVAL_ARENA, EVAL_BENCHMARKS, EVAL_SESSION_MODELS } from "./eval-fixtures";
import { rankRecommendations } from "./task-ranker";

export const EVAL_ENGINES: RankingEngineId[] = [
  "coding",
  "reasoning",
  "writing",
  "cheap",
  "balanced",
];

export interface EvalEngineResult {
  engineId: RankingEngineId;
  customText?: string;
  recommendations: Recommendation[];
  matchedCount: number;
  weakCount: number;
}
```

`runEvalMatrix` loops `EVAL_ENGINES`. For `balanced` only, also run `otherCustomTexts` defaulting to `[undefined, "gros monorepo multi-fichier à refactorer"]` — emit one row without custom text from the main loop **or** skip `balanced` in the main loop and handle it like today’s `other`. Simplest: main loop ranks every engine with no custom text; afterwards extra `balanced` rows for each non-undefined custom text.

`formatEvalReport` titles: if `customText` then `` `balanced — custom: "..."` `` else `engineId`.

- [ ] **Step 4: Update CONTRIBUTING ranking docs**

Replace the **Task fit** table with engines:

| Engine | Raw signal |
| `coding` | coding index × 0.7 + LiveCodeBench × 0.3 (falls back to whichever exists) |
| `writing` | mean of intelligence index and GDPval / writing eval when present |
| `reasoning`, `cheap`, `balanced` | intelligence index |

Replace the **Weights** table:

| Engine | taskFit | arena | cost |
| `writing` | 0.50 | 0.25 | 0.25 |
| `coding` | 0.45 | 0.20 | 0.35 |
| `cheap` | 0.35 | 0.20 | 0.45 |
| `reasoning`, `balanced` | 0.45 | 0.25 | 0.30 |

Context/thinking bullets: writing → high/medium; coding → standard/medium; cheap → standard/low; reasoning and balanced → medium/medium.

Clipboard JSON example adds `"engine": "writing"` next to `"task": "spec"`.

Replace “Adding a task profile” with two subsections:

1. **Adding a QuickPick preset** — add `TaskPresetId`, `TASK_PRESETS` row, `PRESET_ENGINE` mapping, i18n en/fr. Do not add Arena/ranker branches unless it needs a new engine.
2. **Adding a ranking engine** — add `RankingEngineId`, `ARENA_CATEGORIES`, `rawTaskFit` / `engineDefaults` / `resolveEngineWeights`, eval-matrix engine, tests.

Pipeline description: `pickTask` still then fetch/match/rank. Mention labels vs engines in the module map (`src/task/presets.ts`, `src/task/classify-other.ts`, `src/ranking/task-ranker.ts`).

Add the new spec/plan links under Design docs.

- [ ] **Step 5: Run full verification**

Run: `rtk npm test`

Expected: all Vitest tests PASS.

Run: `rtk npm run eval:ranking`

Expected: report with five `##` engine sections; coding top is not GLM Flash; writing top is not Flash.

Run: `rtk npx tsc --noEmit` if the project has a check script; otherwise `rtk npm test` is enough if it typechecks. Grep the repo for leftover `TaskProfileId`, `pythonScript`, `testScenario`, `profileId` in `src/` (docs/superpowers history may keep old names).

Expected: no leftover identifiers in `src/`.

---

## Spec coverage

| Spec requirement | Task |
| 9 QuickPick rows, Autre last | 1 + 2 |
| `PRESET_ENGINE` mapping | 1 |
| Five engines, Arena categories | 1 + 4 |
| Classifier → engine, empty → balanced, cheap-first overlap | 3 |
| Ranker taskFit / weights / defaults | 4 |
| Clipboard `task` + `engine`; picker keeps preset id for Autre | 5 |
| Eval matrix per engine + preset smoke | 6 |
| CONTRIBUTING + breaking clipboard note | 6 |
| No LLM classifier, no 2-level UI, no match/provider changes | all (out of scope) |
