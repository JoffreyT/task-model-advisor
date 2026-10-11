# Recommendation Count Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a VS Code setting that chooses how many model recommendations to show, from 3 to 10, default 3.

**Architecture:** `clampRecommendationCount` is the only acceptance rule. `resolveConfig` stores the clamped value on `AdvisorConfig`. `selectRecommendations` keeps today's `diversifyTop3` result as the head of the list and appends later ranked models until the limit. The recommend command reads the setting and passes it as `limit`. The QuickPick already renders the list it receives.

**Tech Stack:** TypeScript, VS Code Extension API (`engines.vscode` ^1.128.0), Vitest.

## Global Constraints

- Setting key: `taskModelAdvisor.recommendationCount`. Type `number`. Minimum 3. Maximum 10. Default 3. Description: `Number of model recommendations to show (3–10).`
- Accept the value only when it is an integer from 3 to 10. A missing value, a non-integer (`3.5`, `"4"`), or an out-of-range value (`2`, `11`) becomes 3. Clamp in both `resolveConfig` and `rankRecommendations`.
- `diversifyTop3` stays unchanged. It still returns at most three models.
- Positions 1–3 for a given ranked list stay the same whether the limit is 3 or 10.
- When fewer models exist than the limit, return every ranked model.
- A model dropped from the diversified top 3 can reappear at position 4 or later.
- `showRecommendations` does not change.
- Callers that omit `limit` keep a top 3. The eval matrix does not pass `limit`.
- Do not ask for the count on each command run. Do not change the diversity rule. Do not translate the setting description. Do not add a per-task count.
- Do not create git commits. Leave every change uncommitted.
- Spec source of truth: `docs/superpowers/specs/2026-10-11-recommendation-count-design.md`.

## File structure

- Modify: `src/constants.ts` — min, max, and default for the count.
- Modify: `src/config.ts` — `clampRecommendationCount` and `AdvisorConfig.recommendationCount`.
- Modify: `src/types.ts` — `recommendationCount` on `AdvisorConfig`.
- Modify: `src/__tests__/config.test.ts` — default and rejected values.
- Modify: `package.json` — contributed setting.
- Modify: `src/seed-settings.ts` — add the key to `SETTING_KEYS`.
- Modify: `src/ranking/task-ranker.ts` — `selectRecommendations` and `limit` on the ranker input.
- Modify: `src/__tests__/task-ranker.test.ts` — head stability, append, short lists, invalid limits.
- Modify: `src/commands/recommend.ts` — read the setting and pass `limit`.

---

### Task 1: Clamp the count in config

**Files:**

- Modify: `src/constants.ts`
- Modify: `src/types.ts`
- Modify: `src/config.ts`
- Test: `src/__tests__/config.test.ts`

**Interfaces:**

- Consumes: nothing new.
- Produces: `RECOMMENDATION_COUNT_MIN` (3), `RECOMMENDATION_COUNT_MAX` (10), `RECOMMENDATION_COUNT_DEFAULT` (3), `clampRecommendationCount(value: unknown): number`, and `AdvisorConfig.recommendationCount: number`.

- [ ] **Step 1: Write the failing test**

Add this import next to the existing constants import in `src/__tests__/config.test.ts`:

```typescript
import {
  APPLY_STRATEGY,
  ARENA_CATEGORIES,
  ARENA_SOURCE,
  FETCH_TIMEOUT_MS,
  FUZZY_THRESHOLD,
  RANKING_WEIGHTS,
  REASONING_MODEL_PATTERNS,
  RECOMMENDATION_COUNT_DEFAULT,
} from "../constants";
```

Inside `it("uses extension constants when raw is empty")`, after `expect(c.cursor.apiKey).toBe("");`, add:

```typescript
expect(c.recommendationCount).toBe(RECOMMENDATION_COUNT_DEFAULT);
```

Append this test to the `describe("resolveConfig")` block:

```typescript
it("accepts an integer recommendation count from 3 to 10 and otherwise uses 3", () => {
  expect(resolveConfig({ recommendationCount: 3 }).recommendationCount).toBe(3);
  expect(resolveConfig({ recommendationCount: 7 }).recommendationCount).toBe(7);
  expect(resolveConfig({ recommendationCount: 10 }).recommendationCount).toBe(10);
  expect(resolveConfig({ recommendationCount: 2 }).recommendationCount).toBe(3);
  expect(resolveConfig({ recommendationCount: 11 }).recommendationCount).toBe(3);
  expect(resolveConfig({ recommendationCount: 3.5 }).recommendationCount).toBe(3);
  expect(resolveConfig({ recommendationCount: "4" }).recommendationCount).toBe(3);
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `rtk npx vitest run src/__tests__/config.test.ts`

Expected: FAIL. `RECOMMENDATION_COUNT_DEFAULT` is not exported, and `recommendationCount` is missing on the resolved config.

- [ ] **Step 3: Write the minimal implementation**

Append to `src/constants.ts`:

```typescript
export const RECOMMENDATION_COUNT_MIN = 3;
export const RECOMMENDATION_COUNT_MAX = 10;
export const RECOMMENDATION_COUNT_DEFAULT = 3;
```

Add this field to `AdvisorConfig` in `src/types.ts`, after `language`:

```typescript
/** How many recommendations to show. Integer from 3 to 10. */
recommendationCount: number;
```

In `src/config.ts`, import the three new constants and add:

```typescript
export function clampRecommendationCount(value: unknown): number {
  if (typeof value !== "number" || !Number.isInteger(value)) {
    return RECOMMENDATION_COUNT_DEFAULT;
  }
  if (value < RECOMMENDATION_COUNT_MIN || value > RECOMMENDATION_COUNT_MAX) {
    return RECOMMENDATION_COUNT_DEFAULT;
  }
  return value;
}
```

Set `recommendationCount: clampRecommendationCount(raw.recommendationCount)` on the object returned by `resolveConfig`.

- [ ] **Step 4: Run the test to verify it passes**

Run: `rtk npx vitest run src/__tests__/config.test.ts`

Expected: PASS

---

### Task 2: Contribute and seed the setting

**Files:**

- Modify: `package.json`
- Modify: `src/seed-settings.ts`
- Test: `src/__tests__/config.test.ts` (bounds match `package.json`)
- Test: `src/__tests__/seed-settings.test.ts` (existing `SETTING_KEYS` parity; do not edit that file)

**Interfaces:**

- Consumes: `RECOMMENDATION_COUNT_MIN`, `RECOMMENDATION_COUNT_MAX`, `RECOMMENDATION_COUNT_DEFAULT`.
- Produces: contributed key `taskModelAdvisor.recommendationCount` and `SETTING_KEYS` entry `"recommendationCount"`.

- [ ] **Step 1: Write the failing test**

Append this test to `describe("resolveConfig")` in `src/__tests__/config.test.ts`:

```typescript
it("matches the contributed recommendationCount bounds", () => {
  const pkg = JSON.parse(readFileSync(resolve(process.cwd(), "package.json"), "utf8")) as {
    contributes: {
      configuration: {
        properties: Record<string, { minimum?: number; maximum?: number; default?: number }>;
      };
    };
  };
  const property = pkg.contributes.configuration.properties["taskModelAdvisor.recommendationCount"];
  expect(property).toMatchObject({
    type: "number",
    minimum: RECOMMENDATION_COUNT_MIN,
    maximum: RECOMMENDATION_COUNT_MAX,
    default: RECOMMENDATION_COUNT_DEFAULT,
    description: "Number of model recommendations to show (3–10).",
  });
});
```

Add `readFileSync` from `node:fs`, `resolve` from `node:path`, and `RECOMMENDATION_COUNT_MIN` / `RECOMMENDATION_COUNT_MAX` to the imports in that test file.

- [ ] **Step 2: Run the test to verify it fails**

Run: `rtk npx vitest run src/__tests__/config.test.ts`

Expected: FAIL because `taskModelAdvisor.recommendationCount` is absent from `package.json` (`property` is `undefined`).

- [ ] **Step 3: Write the minimal implementation**

Add this property to `contributes.configuration.properties` in `package.json`, after `taskModelAdvisor.language`:

```json
"taskModelAdvisor.recommendationCount": {
  "type": "number",
  "minimum": 3,
  "maximum": 10,
  "default": 3,
  "description": "Number of model recommendations to show (3–10)."
}
```

Change `SETTING_KEYS` in `src/seed-settings.ts` to:

```typescript
export const SETTING_KEYS = [
  "artificialAnalysis.apiKey",
  "cursor.apiKey",
  "language",
  "recommendationCount",
] as const;
```

Leave `src/__tests__/seed-settings.test.ts` unchanged. Its parity test sorts both lists. Its seed test treats every key other than the two API keys as already set, so `recommendationCount` is not written in that test.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `rtk npx vitest run src/__tests__/config.test.ts src/__tests__/seed-settings.test.ts`

Expected: PASS

---

### Task 3: Append recommendations past the top 3

**Files:**

- Modify: `src/ranking/task-ranker.ts`
- Test: `src/__tests__/task-ranker.test.ts`

**Interfaces:**

- Consumes: `clampRecommendationCount(value: unknown): number` and the unchanged `diversifyTop3(ranked: Recommendation[]): Recommendation[]`.
- Produces: `selectRecommendations(ranked: Recommendation[], limit?: number): Recommendation[]`. `RankRecommendationsInput` gains optional `limit?: number`. `rankRecommendations` returns `selectRecommendations(ranked, limit)`.

- [ ] **Step 1: Write the failing test**

Add `selectRecommendations` to the import from `../ranking/task-ranker` in `src/__tests__/task-ranker.test.ts`.

Add `Recommendation` to a type import from `../types`.

Append this helper and describe block at the end of the test file:

```typescript
function recommendation(id: string, score: number, price: number, cost: number): Recommendation {
  return {
    sessionModel: { id, name: id },
    score,
    breakdown: { taskFit: score, arena: 0, cost },
    contextWindow: "standard",
    thinkingEffort: "low",
    rationale: "",
    badges: ["matched"],
    blendedPricePer1M: price,
    costTier: "medium",
  };
}

describe("selectRecommendations", () => {
  const ranked = [
    recommendation("a", 5, 10, 0.08),
    recommendation("b", 4, 10, 0.08),
    recommendation("c", 3, 10, 0.08),
    recommendation("d", 2, 1, 0.54),
    recommendation("e", 1, 10, 0.08),
  ];

  it("keeps the diversified top 3 when limit is omitted or invalid", () => {
    const top3 = ["a", "b", "d"];
    expect(selectRecommendations(ranked).map((row) => row.sessionModel.id)).toEqual(top3);
    expect(selectRecommendations(ranked, 3).map((row) => row.sessionModel.id)).toEqual(top3);
    expect(selectRecommendations(ranked, 2).map((row) => row.sessionModel.id)).toEqual(top3);
    expect(selectRecommendations(ranked, 11).map((row) => row.sessionModel.id)).toEqual(top3);
    expect(selectRecommendations(ranked, 3.5).map((row) => row.sessionModel.id)).toEqual(top3);
  });

  it("appends later models by rank without moving the top 3", () => {
    expect(selectRecommendations(ranked, 4).map((row) => row.sessionModel.id)).toEqual([
      "a",
      "b",
      "d",
      "c",
    ]);
    expect(selectRecommendations(ranked, 10).map((row) => row.sessionModel.id)).toEqual([
      "a",
      "b",
      "d",
      "c",
      "e",
    ]);
  });

  it("returns every model when the list is shorter than the limit", () => {
    const short = ranked.slice(0, 2);
    expect(selectRecommendations(short, 10).map((row) => row.sessionModel.id)).toEqual(["a", "b"]);
  });
});
```

`d` is the cheaper matched alternative (`price` 1 is at most 55% of `a`'s price 10, and its cost score 0.54 is at least 0.35), so `diversifyTop3` selects `a`, `b`, `d` and drops `c`. A limit above 3 puts `c` back after that head.

Inside `describe("rankRecommendations")`, append:

```typescript
it("extends the same top 3 when limit is above 3", () => {
  const matched = [50, 40, 30, 20, 10].map((intelligence) => ({
    session: { id: `m${intelligence}`, name: `m${intelligence}` },
    benchmark: {
      slug: `m${intelligence}`,
      name: `m${intelligence}`,
      intelligence,
      blendedPricePer1M: 5,
      evaluations: {},
    },
    score: 1,
    badges: ["matched" as const],
  }));
  const input = {
    matched,
    arena: [],
    engineId: "balanced" as const,
    weights: { taskFit: 1, arena: 0, cost: 0 },
    reasoningModelPatterns: [],
  };
  const head = rankRecommendations(input).map((row) => row.sessionModel.id);
  const extended = rankRecommendations({ ...input, limit: 10 });
  expect(head).toEqual(["m50", "m40", "m30"]);
  expect(extended.map((row) => row.sessionModel.id).slice(0, 3)).toEqual(head);
  expect(extended.map((row) => row.sessionModel.id)).toEqual(["m50", "m40", "m30", "m20", "m10"]);
});
```

Equal prices keep the diversity swap from firing, so this list is pure score order. `balanced` uses intelligence as task fit, and the zero arena and cost weights leave that order intact.

- [ ] **Step 2: Run the tests to verify they fail**

Run: `rtk npx vitest run src/__tests__/task-ranker.test.ts`

Expected: FAIL. `selectRecommendations` is not exported. The `limit` field is ignored, so the extended ranking still has length 3.

- [ ] **Step 3: Write the minimal implementation**

In `src/ranking/task-ranker.ts`, import `clampRecommendationCount` from `../config`.

Add `limit?: number` to `RankRecommendationsInput`.

Destructure `limit` in `rankRecommendations` alongside the existing fields.

Replace the final `return diversifyTop3(ranked).slice(0, 3);` with:

```typescript
return selectRecommendations(ranked, limit);
```

Add this function after `diversifyTop3`. Do not edit `diversifyTop3`.

```typescript
/**
 * Keep the diversified top 3, then append later ranked models up to the limit.
 * An omitted or invalid limit stays at 3.
 */
export function selectRecommendations(ranked: Recommendation[], limit?: number): Recommendation[] {
  const count = clampRecommendationCount(limit);
  const top = diversifyTop3(ranked);
  if (count <= top.length) return top;
  const chosen = new Set(top.map((row) => row.sessionModel.id));
  const extra = ranked.filter((row) => !chosen.has(row.sessionModel.id));
  return [...top, ...extra].slice(0, count);
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `rtk npx vitest run src/__tests__/task-ranker.test.ts src/__tests__/ranking-eval-matrix.test.ts`

Expected: PASS. The eval matrix still receives at most 3 recommendations because it does not pass `limit`.

---

### Task 4: Pass the setting into the ranker

**Files:**

- Modify: `src/commands/recommend.ts`

**Interfaces:**

- Consumes: `AdvisorConfig.recommendationCount` and `RankRecommendationsInput.limit`.
- Produces: `runRecommendCommand` passes the resolved count as `limit`. No new export.

- [ ] **Step 1: Wire the command**

There is no unit test for this adapter. `loadAdvisorConfig` reads VS Code configuration directly, and the ranker tests already cover `limit`.

In `loadAdvisorConfig`, add `recommendationCount` to the object passed to `resolveConfig`:

```typescript
return resolveConfig({
  artificialAnalysis: {
    apiKey: section.get<string>("artificialAnalysis.apiKey"),
  },
  cursor: {
    apiKey: section.get<string>("cursor.apiKey"),
  },
  language: section.get<string>("language"),
  recommendationCount: section.get<number>("recommendationCount"),
});
```

Pass the count on the existing `rankRecommendations` call:

```typescript
const recommendations = rankRecommendations({
  matched,
  arena,
  engineId,
  weights: config.ranking.weights,
  reasoningModelPatterns: config.reasoningModelPatterns,
  customText,
  limit: config.recommendationCount,
});
```

Do not change `showRecommendations`.

- [ ] **Step 2: Run the full check**

Run: `rtk npm test`

Expected: PASS

Run: `rtk npm run compile`

Expected: exit code 0
