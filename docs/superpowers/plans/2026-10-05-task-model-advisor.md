# Task Model Advisor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a VS Code/Cursor extension that recommends the top 3 session-available models (plus context + thinking) for a chosen task, using fresh Artificial Analysis + Arena data, with Validate → apply/clipboard.

**Architecture:** Pure TypeScript core (profiles, matching, ranking, providers) unit-tested with Vitest; thin VS Code adapters for QuickPick, `vscode.lm.selectChatModels()`, progress, clipboard, and best-effort apply. One command orchestrates: pick task → fetch benchmarks in parallel → discover session models → match → rank → show top 3 → validate/copy/refresh.

**Tech Stack:** TypeScript, VS Code Extension API (`engines.vscode` ^1.90.0), Vitest, native `fetch`, `@vscode/vsce` for packaging. No WASM tokenizer. Settings prefix: `taskModelAdvisor.*`.

## Global Constraints

- Product name: **Task Model Advisor**; repo: `task-model-advisor`; never brand as “Prompt Router”.
- Recommend **only** models returned by session discovery; never invent models from AA/Arena alone.
- Network **only** on recommend/refresh; one AA list fetch per invocation; Arena failure → AA-only + warning.
- No silent benchmark cache in v1.
- Fixed five task presets + Autre in v1 (no customizable QuickPick — v2).
- Commits: **optional** — repository owner commits manually; skip git commit steps unless explicitly asked.
- Spec source of truth: `docs/superpowers/specs/2026-03-22-task-model-advisor-design.md`.

---

## File structure (create)

```
task-model-advisor/
├── package.json
├── tsconfig.json
├── vitest.config.ts
├── .vscodeignore
├── .gitignore
├── README.md
├── src/
│   ├── extension.ts                 # activate / register command
│   ├── commands/recommend.ts        # orchestration
│   ├── types.ts                     # shared domain types
│   ├── config.ts                    # read vscode settings → typed Config
│   ├── task/
│   │   ├── presets.ts               # five presets + Autre
│   │   └── classify-other.ts        # keyword → TaskProfileId
│   ├── matching/
│   │   ├── normalize.ts
│   │   └── model-matcher.ts
│   ├── ranking/
│   │   └── task-ranker.ts
│   ├── providers/
│   │   ├── artificial-analysis.ts
│   │   └── arena.ts
│   ├── host/
│   │   └── model-discovery.ts
│   ├── ui/
│   │   ├── task-picker.ts
│   │   └── recommendation-ui.ts
│   └── apply/
│       └── apply-adapter.ts
└── src/__tests__/
    ├── fixtures/
    │   ├── aa-models.json
    │   └── arena-coding.json
    ├── classify-other.test.ts
    ├── normalize.test.ts
    ├── model-matcher.test.ts
    ├── task-ranker.test.ts
    ├── artificial-analysis.test.ts
    └── arena.test.ts
```

---

### Task 1: Extension scaffold + Vitest

**Files:**
- Create: `package.json`, `tsconfig.json`, `vitest.config.ts`, `.vscodeignore`, `.gitignore`, `src/extension.ts`, `README.md`
- Modify: existing `.gitignore` if present

**Interfaces:**
- Produces: package id `task-model-advisor`, command `taskModelAdvisor.recommend`, activation on command

- [ ] **Step 1: Write `package.json`**

```json
{
  "name": "task-model-advisor",
  "displayName": "Task Model Advisor",
  "description": "Recommend the best available LLM (model, context, thinking) for a task using live benchmarks.",
  "version": "0.1.0",
  "publisher": "local",
  "engines": { "vscode": "^1.90.0" },
  "categories": ["Other"],
  "activationEvents": ["onCommand:taskModelAdvisor.recommend"],
  "main": "./out/extension.js",
  "contributes": {
    "commands": [
      {
        "command": "taskModelAdvisor.recommend",
        "title": "Task Model Advisor: Recommend a model for this task"
      }
    ],
    "keybindings": [
      {
        "command": "taskModelAdvisor.recommend",
        "key": "ctrl+alt+r",
        "mac": "cmd+alt+r"
      }
    ],
    "configuration": {
      "title": "Task Model Advisor",
      "properties": {
        "taskModelAdvisor.enabled": { "type": "boolean", "default": true },
        "taskModelAdvisor.artificialAnalysis.apiKey": {
          "type": "string",
          "default": "",
          "description": "Artificial Analysis Data API key"
        },
        "taskModelAdvisor.arena.source": {
          "type": "string",
          "default": "wulong-mirror",
          "enum": ["wulong-mirror"]
        },
        "taskModelAdvisor.arena.categories": {
          "type": "object",
          "default": {
            "spec": "text",
            "userStory": "text",
            "testScenario": "hard_prompts",
            "pythonScript": "coding",
            "other": "text"
          }
        },
        "taskModelAdvisor.ranking.weights": {
          "type": "object",
          "default": { "taskFit": 0.5, "arena": 0.3, "cost": 0.2 }
        },
        "taskModelAdvisor.modelAliases": {
          "type": "object",
          "default": {},
          "additionalProperties": { "type": "string" }
        },
        "taskModelAdvisor.matching.fuzzyThreshold": {
          "type": "number",
          "default": 0.72,
          "minimum": 0,
          "maximum": 1
        },
        "taskModelAdvisor.applyStrategy": {
          "type": "string",
          "default": "auto-then-manual",
          "enum": ["auto-then-manual", "clipboard-only"]
        },
        "taskModelAdvisor.fetch.timeoutMs": {
          "type": "number",
          "default": 8000
        },
        "taskModelAdvisor.reasoningModelPatterns": {
          "type": "array",
          "items": { "type": "string" },
          "default": ["o1", "o3", "deepseek-r1", "extended"]
        }
      }
    }
  },
  "scripts": {
    "vscode:prepublish": "npm run compile",
    "compile": "tsc -p ./",
    "watch": "tsc -watch -p ./",
    "test": "vitest run",
    "test:watch": "vitest",
    "package": "vsce package"
  },
  "devDependencies": {
    "@types/node": "^20.11.0",
    "@types/vscode": "^1.90.0",
    "@vscode/vsce": "^3.0.0",
    "typescript": "^5.4.0",
    "vitest": "^2.0.0"
  }
}
```

- [ ] **Step 2: Write `tsconfig.json` and `vitest.config.ts`**

```json
{
  "compilerOptions": {
    "module": "commonjs",
    "target": "ES2022",
    "lib": ["ES2022"],
    "outDir": "out",
    "rootDir": "src",
    "sourceMap": true,
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true
  },
  "exclude": ["node_modules", ".vscode-test", "src/__tests__"]
}
```

```ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["src/__tests__/**/*.test.ts"],
    environment: "node",
  },
});
```

- [ ] **Step 3: Stub `src/extension.ts`**

```ts
import * as vscode from "vscode";

export function activate(context: vscode.ExtensionContext): void {
  const disposable = vscode.commands.registerCommand(
    "taskModelAdvisor.recommend",
    async () => {
      vscode.window.showInformationMessage(
        "Task Model Advisor: wiring incomplete — implement recommend command."
      );
    }
  );
  context.subscriptions.push(disposable);
}

export function deactivate(): void {}
```

- [ ] **Step 4: Update `.gitignore`**

```
node_modules/
out/
*.vsix
.DS_Store
.vscode-test/
```

- [ ] **Step 5: Install and verify compile + empty tests**

Run: `npm install && npm run compile && npm test`  
Expected: compile OK; vitest “No test files found” or 0 tests until Task 2 — if Vitest fails on empty, add a temporary `src/__tests__/smoke.test.ts` with `expect(true).toBe(true)` then remove later, or keep as smoke.

---

### Task 2: Domain types + config reader

**Files:**
- Create: `src/types.ts`, `src/config.ts`
- Test: `src/__tests__/config.test.ts` (pure defaults without vscode — export `resolveConfig(raw)`)

**Interfaces:**
- Produces:
  - `TaskProfileId = "spec" | "userStory" | "testScenario" | "pythonScript" | "other"`
  - `SessionModel { id: string; name: string; family?: string; vendor?: string }`
  - `BenchmarkModel { slug: string; name: string; creatorSlug?: string; intelligence?: number; coding?: number; blendedPricePer1M?: number; contextWindowTokens?: number; evaluations: Record<string, number | null> }`
  - `ArenaEntry { model: string; rank: number; score: number | null }`
  - `MatchQuality = "matched" | "weak" | "enterprise"` (enterprise is additive flag: `badges: MatchQuality[]`)
  - `Recommendation { sessionModel: SessionModel; score: number; breakdown: { taskFit: number; arena: number; cost: number }; contextWindow: "standard" | "medium" | "high"; thinkingEffort: "off" | "low" | "medium" | "high"; rationale: string; badges: Array<"matched" | "weak" | "enterprise"> }`
  - `AdvisorConfig` matching settings defaults from package.json
  - `resolveConfig(raw: Record<string, unknown>): AdvisorConfig`

- [ ] **Step 1: Write failing test for `resolveConfig`**

```ts
import { describe, it, expect } from "vitest";
import { resolveConfig } from "../config";

describe("resolveConfig", () => {
  it("applies defaults when raw is empty", () => {
    const c = resolveConfig({});
    expect(c.enabled).toBe(true);
    expect(c.ranking.weights).toEqual({ taskFit: 0.5, arena: 0.3, cost: 0.2 });
    expect(c.fetch.timeoutMs).toBe(8000);
    expect(c.matching.fuzzyThreshold).toBe(0.72);
  });

  it("overrides nested weights", () => {
    const c = resolveConfig({
      ranking: { weights: { taskFit: 0.7, arena: 0.2, cost: 0.1 } },
    });
    expect(c.ranking.weights.taskFit).toBe(0.7);
  });
});
```

- [ ] **Step 2: Run test — expect FAIL (module missing)**

Run: `npx vitest run src/__tests__/config.test.ts`

- [ ] **Step 3: Implement `src/types.ts` and `src/config.ts`**

Implement types as listed in Interfaces. `resolveConfig` deep-merges known keys with defaults; ignore unknown keys.

- [ ] **Step 4: Run test — expect PASS**

---

### Task 3: Task presets + Autre classifier

**Files:**
- Create: `src/task/presets.ts`, `src/task/classify-other.ts`
- Test: `src/__tests__/classify-other.test.ts`

**Interfaces:**
- Consumes: `TaskProfileId`
- Produces:
  - `TASK_PRESETS: Array<{ id: TaskProfileId; label: string }>` (Autre last)
  - `classifyOther(text: string): TaskProfileId` — never throws; unknown → `"other"` mapped to nearest or stay `"other"` with default medium profile handled in ranker via `"other"` weights = intelligence-focused like userStory

- [ ] **Step 1: Write failing tests**

```ts
import { describe, it, expect } from "vitest";
import { classifyOther } from "../task/classify-other";
import { TASK_PRESETS } from "../task/presets";

describe("TASK_PRESETS", () => {
  it("has five entries ending with other", () => {
    expect(TASK_PRESETS).toHaveLength(5);
    expect(TASK_PRESETS.map((p) => p.id)).toEqual([
      "spec",
      "userStory",
      "testScenario",
      "pythonScript",
      "other",
    ]);
    expect(TASK_PRESETS[0].label).toBe("Écrire une spec");
    expect(TASK_PRESETS[3].label).toContain("Python");
  });
});

describe("classifyOther", () => {
  it("maps python automation keywords to pythonScript", () => {
    expect(classifyOther("écrire un script python pour scraper")).toBe(
      "pythonScript"
    );
  });
  it("maps user story keywords", () => {
    expect(classifyOther("rédiger une user story Jira")).toBe("userStory");
  });
  it("maps test scenario keywords", () => {
    expect(classifyOther("scénario de test gherkin")).toBe("testScenario");
  });
  it("maps spec keywords", () => {
    expect(classifyOther("write a functional specification")).toBe("spec");
  });
  it("defaults to other when unclear", () => {
    expect(classifyOther("bonjour")).toBe("other");
  });
});
```

- [ ] **Step 2: Run — expect FAIL**

- [ ] **Step 3: Implement presets + keyword maps (FR+EN)**

```ts
// classify-other.ts — sketch
const RULES: Array<{ id: Exclude<TaskProfileId, "other">; patterns: RegExp[] }> = [
  { id: "pythonScript", patterns: [/python/i, /script/i, /automatis/i, /automat/i] },
  { id: "testScenario", patterns: [/sc[eé]nario/i, /gherkin/i, /cas de test/i, /test case/i] },
  { id: "userStory", patterns: [/user story/i, /histoire utilisateur/i, /jira/i] },
  { id: "spec", patterns: [/sp[eé]c/i, /specification/i, /cahier des charges/i] },
];

export function classifyOther(text: string): TaskProfileId {
  const t = text.trim();
  if (!t) return "other";
  for (const rule of RULES) {
    if (rule.patterns.some((p) => p.test(t))) return rule.id;
  }
  return "other";
}
```

Tune so overlapping cases pick first matching rule order (python before generic “script” if needed — order as above).

- [ ] **Step 4: Run — expect PASS**

---

### Task 4: Normalize + model matcher

**Files:**
- Create: `src/matching/normalize.ts`, `src/matching/model-matcher.ts`
- Test: `src/__tests__/normalize.test.ts`, `src/__tests__/model-matcher.test.ts`

**Interfaces:**
- Consumes: `SessionModel`, `BenchmarkModel`, `AdvisorConfig.modelAliases`, `fuzzyThreshold`
- Produces:
  - `normalizeModelKey(s: string): string`
  - `similarity(a: string, b: string): number` // 0..1 token Jaccard or normalized Levenshtein
  - `matchModels(session: SessionModel[], benchmarks: BenchmarkModel[], aliases: Record<string, string>, threshold: number): MatchedModel[]`
  - `MatchedModel { session: SessionModel; benchmark: BenchmarkModel | null; score: number; badges: Array<"matched" | "weak" | "enterprise"> }`

- [ ] **Step 1: Write normalize tests**

```ts
import { describe, it, expect } from "vitest";
import { normalizeModelKey, similarity } from "../matching/normalize";

describe("normalizeModelKey", () => {
  it("lowercases and strips enterprise/date noise", () => {
    expect(normalizeModelKey("GPT-4o (Entreprise)")).toContain("gpt");
    expect(normalizeModelKey("gpt-4o-2024-08-06")).toBe(
      normalizeModelKey("gpt-4o")
    );
  });
});

describe("similarity", () => {
  it("is high for near-identical strings", () => {
    expect(similarity("gpt-4o", "gpt-4o")).toBe(1);
    expect(similarity("claude-3-5-sonnet", "claude-3.5-sonnet")).toBeGreaterThan(
      0.7
    );
  });
});
```

- [ ] **Step 2: Implement `normalize.ts`**

Rules: lowercase; replace `_`/`.` with `-`; remove substrings `enterprise`, `entreprise`, `(...)`; strip ISO-like date suffixes `-20\d{2}-\d{2}-\d{2}`; collapse multiple `-`.

Use token Jaccard on `-` split tokens for `similarity`.

- [ ] **Step 3: Write matcher tests (≥5 cases toward acceptance “20 fixtures”)**

```ts
import { describe, it, expect } from "vitest";
import { matchModels } from "../matching/model-matcher";

const benches = [
  { slug: "gpt-4o", name: "GPT-4o", evaluations: {} },
  { slug: "gpt-4o-mini", name: "GPT-4o mini", evaluations: {} },
  { slug: "claude-3-5-sonnet", name: "Claude 3.5 Sonnet", evaluations: {} },
];

describe("matchModels", () => {
  it("matches via alias", () => {
    const session = [
      { id: "copilot-gpt-4o-mini-enterprise", name: "GPT-4o mini entreprise" },
    ];
    const out = matchModels(
      session,
      benches,
      { "copilot-gpt-4o-mini-enterprise": "gpt-4o-mini" },
      0.72
    );
    expect(out[0].benchmark?.slug).toBe("gpt-4o-mini");
    expect(out[0].badges).toContain("matched");
    expect(out[0].badges).toContain("enterprise");
  });

  it("fuzzy-matches display name", () => {
    const out = matchModels(
      [{ id: "x", name: "Claude 3.5 Sonnet" }],
      benches,
      {},
      0.72
    );
    expect(out[0].benchmark?.slug).toBe("claude-3-5-sonnet");
    expect(out[0].badges).toEqual(["matched"]);
  });

  it("returns null benchmark when below threshold", () => {
    const out = matchModels(
      [{ id: "custom-corp-llm", name: "Corp Internal LLM v9" }],
      benches,
      {},
      0.72
    );
    expect(out[0].benchmark).toBeNull();
    expect(out[0].badges).toContain("weak");
  });
});
```

- [ ] **Step 4: Implement `model-matcher.ts`**

Algorithm per session model:
1. If `aliases[id]` or `aliases[name]` → exact slug match → badges `matched` + `enterprise` if name/id matches `/enterprise|entreprise/i`.
2. Else compute max similarity vs each benchmark `slug` and `normalize(name)`; if ≥ threshold → matched.
3. Else benchmark null, badge `weak`.

- [ ] **Step 5: Run all matching tests — PASS**

---

### Task 5: Task ranker (top 3)

**Files:**
- Create: `src/ranking/task-ranker.ts`
- Test: `src/__tests__/task-ranker.test.ts`
- Fixtures: expand inline data to reach ≥20 ranking/matching cases across Tasks 4–5

**Interfaces:**
- Consumes: `MatchedModel[]`, `ArenaEntry[]`, `TaskProfileId`, weights, `reasoningModelPatterns`
- Produces: `rankRecommendations(...): Recommendation[]` length ≤ 3

Profile signal keys:
- `spec`: prefer `intelligence` (+ `gdpval` / writing keys if present in `evaluations`)
- `userStory`: `intelligence` (0.8×)
- `testScenario`: `intelligence`
- `pythonScript`: `coding` then `livecodebench` / LiveCodeBench evaluation keys
- `other`: same as `userStory`

Defaults context/thinking from spec §7.1; bump thinking one step if any `reasoningModelPatterns` matches id/name/family (case-insensitive).

- [ ] **Step 1: Write failing ranker tests**

```ts
import { describe, it, expect } from "vitest";
import { rankRecommendations } from "../ranking/task-ranker";

describe("rankRecommendations", () => {
  it("prefers high coding index for pythonScript among matched models", () => {
    const matched = [
      {
        session: { id: "a", name: "Cheap Coder" },
        benchmark: {
          slug: "cheap-coder",
          name: "Cheap Coder",
          coding: 90,
          intelligence: 40,
          blendedPricePer1M: 1,
          evaluations: { livecodebench: 0.8 },
        },
        score: 1,
        badges: ["matched" as const],
      },
      {
        session: { id: "b", name: "Smart Writer" },
        benchmark: {
          slug: "smart-writer",
          name: "Smart Writer",
          coding: 20,
          intelligence: 95,
          blendedPricePer1M: 10,
          evaluations: {},
        },
        score: 1,
        badges: ["matched" as const],
      },
    ];
    const top = rankRecommendations({
      matched,
      arena: [{ model: "Cheap Coder", rank: 1, score: 1200 }],
      profileId: "pythonScript",
      weights: { taskFit: 0.5, arena: 0.3, cost: 0.2 },
      reasoningModelPatterns: ["o1", "o3"],
    });
    expect(top[0].sessionModel.id).toBe("a");
    expect(top.length).toBeLessThanOrEqual(3);
  });

  it("fills with weak matches when fewer than 3 matched", () => {
    const matched = [
      {
        session: { id: "only", name: "Only" },
        benchmark: {
          slug: "only",
          name: "Only",
          intelligence: 50,
          blendedPricePer1M: 2,
          evaluations: {},
        },
        score: 1,
        badges: ["matched" as const],
      },
      {
        session: { id: "weak1", name: "Weak One" },
        benchmark: null,
        score: 0,
        badges: ["weak" as const],
      },
      {
        session: { id: "weak2", name: "Weak Two" },
        benchmark: null,
        score: 0,
        badges: ["weak" as const],
      },
    ];
    const top = rankRecommendations({
      matched,
      arena: [],
      profileId: "spec",
      weights: { taskFit: 0.5, arena: 0.3, cost: 0.2 },
      reasoningModelPatterns: [],
    });
    expect(top).toHaveLength(3);
    expect(top.some((r) => r.badges.includes("weak"))).toBe(true);
  });

  it("bumps thinking for reasoning model patterns", () => {
    const matched = [
      {
        session: { id: "o3-mini", name: "o3-mini" },
        benchmark: {
          slug: "o3-mini",
          name: "o3-mini",
          intelligence: 80,
          blendedPricePer1M: 5,
          evaluations: {},
        },
        score: 1,
        badges: ["matched" as const],
      },
    ];
    const top = rankRecommendations({
      matched,
      arena: [],
      profileId: "userStory",
      weights: { taskFit: 1, arena: 0, cost: 0 },
      reasoningModelPatterns: ["o3"],
    });
    expect(top[0].thinkingEffort).not.toBe("low");
  });
});
```

- [ ] **Step 2: Implement scoring**

Normalize each component 0..1 across the **matched-with-benchmark** subset; weak entries get `taskFit=0`, `arena=0`, `cost=0`, score slightly below worst matched (or sort matched first then weak by name).

`arenaNorm`: match Arena `model` via `normalizeModelKey` to session/benchmark name; if Elo scores present, min-max normalize among eligible; else use `1 - (rank-1)/N`.

`costEfficiency`: `1 / (blendedPricePer1M + epsilon)` then min-max; missing price → 0.5 neutral.

`rationale`: top 2 factors by contribution `w * component`.

- [ ] **Step 3: Run — PASS; ensure combined matcher+ranker cases ≥ 20** (add more `it(...)` with table-driven data if short)

---

### Task 6: Artificial Analysis provider

**Files:**
- Create: `src/providers/artificial-analysis.ts`
- Test: `src/__tests__/artificial-analysis.test.ts`
- Fixture: `src/__tests__/fixtures/aa-models.json` (minimal 3–5 models shaped like API)

**Interfaces:**
- Produces: `fetchArtificialAnalysisModels(opts: { apiKey: string; timeoutMs: number; fetchImpl?: typeof fetch }): Promise<BenchmarkModel[]>`
- Throws typed errors: `missing_api_key`, `http_error`, `timeout`, `parse_error`

- [ ] **Step 1: Add fixture JSON** with fields `slug`, `name`, `evaluations.artificial_analysis_intelligence_index`, `evaluations.artificial_analysis_coding_index`, `pricing.price_1m_blended_3_to_1` (adjust mapping if live API shape differs — document mapping in code comments).

- [ ] **Step 2: Write tests with mock fetch**

```ts
import { describe, it, expect, vi } from "vitest";
import { fetchArtificialAnalysisModels } from "../providers/artificial-analysis";
import fixture from "./fixtures/aa-models.json";

describe("fetchArtificialAnalysisModels", () => {
  it("rejects empty api key", async () => {
    await expect(
      fetchArtificialAnalysisModels({ apiKey: "", timeoutMs: 1000 })
    ).rejects.toMatchObject({ code: "missing_api_key" });
  });

  it("maps list response to BenchmarkModel[]", async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => fixture,
    });
    const models = await fetchArtificialAnalysisModels({
      apiKey: "test",
      timeoutMs: 5000,
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    expect(models.length).toBeGreaterThan(0);
    expect(models[0].slug).toBeTruthy();
  });

  it("surfaces http 429", async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: false,
      status: 429,
      json: async () => ({}),
    });
    await expect(
      fetchArtificialAnalysisModels({
        apiKey: "test",
        timeoutMs: 5000,
        fetchImpl: fetchImpl as unknown as typeof fetch,
      })
    ).rejects.toMatchObject({ code: "http_error", status: 429 });
  });
});
```

- [ ] **Step 3: Implement provider**

Use URL from Artificial Analysis docs current free/list endpoint (verify at implementation time against https://artificialanalysis.ai/data-api/docs). Headers: `x-api-key` or documented auth. `AbortSignal.timeout(timeoutMs)`. Map response → `BenchmarkModel`.

- [ ] **Step 4: Run — PASS**

---

### Task 7: Arena provider

**Files:**
- Create: `src/providers/arena.ts`
- Test: `src/__tests__/arena.test.ts`
- Fixture: `src/__tests__/fixtures/arena-coding.json`

**Interfaces:**
- Produces: `fetchArenaLeaderboard(opts: { category: string; source: string; timeoutMs: number; fetchImpl?: typeof fetch }): Promise<ArenaEntry[]>`
- On failure: throw; orchestrator catches and continues with `[]` + warning (Task 10).

Default `wulong-mirror` base URL (document exact URL in code, e.g. community JSON mirror documented in design). Map category: `text` | `coding` | `hard_prompts` → mirror query params / file names as available; if category missing, try `text` fallback once then empty.

- [ ] **Step 1–4:** Same TDD pattern as AA: mock fetch, map `models[].{model,rank,score}`, timeout test.

---

### Task 8: Host model discovery

**Files:**
- Create: `src/host/model-discovery.ts`

**Interfaces:**
- Produces: `discoverSessionModels(): Promise<SessionModel[]>` wrapping `vscode.lm.selectChatModels()`
- Map `LanguageModelChat` → `{ id, name, family, vendor }`

- [ ] **Step 1: Implement**

```ts
import * as vscode from "vscode";
import type { SessionModel } from "../types";

export async function discoverSessionModels(): Promise<SessionModel[]> {
  const models = await vscode.lm.selectChatModels();
  return models.map((m) => ({
    id: m.id,
    name: m.name,
    family: m.family,
    vendor: m.vendor,
  }));
}
```

- [ ] **Step 2: No automated VS Code host test in v1** — document manual check in README: open Copilot/Cursor chat signed-in, run command, empty list shows friendly error.

---

### Task 9: Task picker + recommendation UI

**Files:**
- Create: `src/ui/task-picker.ts`, `src/ui/recommendation-ui.ts`

**Interfaces:**
- `pickTask(): Promise<{ profileId: TaskProfileId; customText?: string } | undefined>`
- `showRecommendations(recs: Recommendation[], warnings: string[]): Promise<"validate" | "copy" | "refresh" | undefined>` and selected recommendation index via QuickPick `buttons` or two-step: first pick recommendation, then pick action.

UX (v1 QuickPick, no Webview):

1. `pickTask`: show `TASK_PRESETS`; if `other`, `showInputBox` for description; then `classifyOther` if other.
2. `showRecommendations`: items labeled  
   `$(sparkle) ${name} | ${context} | think:${effort} [${badges}] — ${rationale}`  
   On accept → second QuickPick: Validate / Copy / Refresh.

- [ ] **Step 1: Implement both modules** (no unit tests; keep logic thin)

- [ ] **Step 2: Manual smoke after Task 10**

---

### Task 10: Apply adapter + orchestrator command

**Files:**
- Create: `src/apply/apply-adapter.ts`, `src/commands/recommend.ts`
- Modify: `src/extension.ts` to call `runRecommendCommand`

**Interfaces:**
- `toClipboardPayload(rec: Recommendation, profileId: TaskProfileId): object` (shape from spec §8.1)
- `applyRecommendation(rec: Recommendation, strategy: AdvisorConfig["applyStrategy"]): Promise<{ applied: boolean; detail: string }>`
- `runRecommendCommand(): Promise<void>`

Apply order:
1. If `clipboard-only` → write clipboard + info message; return.
2. Try `vscode.commands.executeCommand` candidates (probe list in code comments; empty success OK): e.g. known Copilot model picker commands if discovered during manual test — wrap each try/catch.
3. Always write clipboard JSON.
4. `showInformationMessage` with model / context / thinking for manual confirm.

Orchestrator loop:

```
read config (if !enabled → warn return)
pickTask → cancel return
progress: parallel AA + Arena + discoverSessionModels
if session empty → error return
if AA fails → error (required)
if Arena fails → warnings.push(...)
match → rank → showRecommendations
validate → apply; copy → clipboard; refresh → goto fetch
```

- [ ] **Step 1: Implement apply-adapter + clipboard helpers**

- [ ] **Step 2: Implement `runRecommendCommand` with `withProgress`**

- [ ] **Step 3: Wire `extension.ts`**

```ts
import { runRecommendCommand } from "./commands/recommend";
// registerCommand → runRecommendCommand
```

- [ ] **Step 4: `npm run compile` — no errors**

---

### Task 11: README + manual acceptance checklist

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Document**
  - Install (F5 / `vsce package`)
  - Set `taskModelAdvisor.artificialAnalysis.apiKey`
  - Shortcut `Cmd+Option+R` / `Ctrl+Alt+R`
  - Privacy: fetches only on command; Autre text stays local
  - Acceptance checklist mirroring spec §12 (6 items)
  - Known limitation: Validate may be clipboard-only on some hosts

- [ ] **Step 2: Run full unit suite**

Run: `npm test`  
Expected: all green; ≥20 cases across matcher/ranker/classifier.

- [ ] **Step 3: Manual matrix (owner)**  
  - macOS Cursor: recommend → top 3 from session models  
  - Windows VS Code + Copilot: same  
  - Disconnect network / bad AA key → clear error  
  - Arena down (mock later) → warning + still ranks

---

## Spec coverage self-check

| Spec section | Task(s) |
|--------------|---------|
| §3 UX presets + Autre + top 3 + badges + Validate/Copy/Refresh | 3, 4, 5, 9, 10 |
| §4 modules | file structure + 3–10 |
| §5 AA + Arena fetch B, Arena soft-fail | 6, 7, 10 |
| §6 discovery + aliases + fuzzy + weak fill | 4, 8, 5 |
| §7 profiles + formula + reasoning bump | 3, 5 |
| §8 apply + clipboard JSON | 10 |
| §9 settings schema | 1, 2 |
| §10 stack | 1 |
| §11 timeout / no silent cache | 6, 7, 10 |
| §12 acceptance | 11 + tests Tasks 3–5 |
| §14 v2 | intentionally omitted |

## Placeholder / consistency notes

- Settings prefix always `taskModelAdvisor.*`.
- Types `Recommendation.badges` include optional `enterprise` alongside `matched`/`weak`.
- Commit steps omitted (owner commits manually).

---

## Execution handoff

Plan complete and saved to `docs/superpowers/plans/2026-10-05-task-model-advisor.md`.

**Two execution options:**

1. **Subagent-Driven (recommended)** — fresh subagent per task, review between tasks  
2. **Inline Execution** — execute tasks in this session with checkpoints  

Which approach?
