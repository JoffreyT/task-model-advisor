# Recommendation Popup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show the top three models in a QuickPick as context, thinking, and price plus one sentence, with English and French catalogs selected by `taskModelAdvisor.language` (default English).

**Architecture:** `src/i18n/en.ts` and `src/i18n/fr.ts` export the same `Messages` type. Pure formatters in `src/ui/format-recommendation.ts` turn a visible row plus its siblings into the description and the sentence. QuickPicks and toasts receive a `Messages` value loaded from the setting. Ranking fields (`rationale`, scores, badges, `costTier`) stay on `Recommendation` and in the eval report.

**Tech Stack:** TypeScript, VS Code Extension API (`engines.vscode` ^1.140.0), Vitest.

## Global Constraints

- Runtime copy comes only from `src/i18n/en.ts` and `src/i18n/fr.ts`. No i18n library.
- `taskModelAdvisor.language` is `"en"` or `"fr"`. Default `"en"`. Any other value resolves to `"en"`.
- The command reads the setting once per `runRecommendCommand` invocation.
- `package.json` command title, setting descriptions, progress title `Task Model Advisor`, and network error strings stay English.
- Price on a recommendation row is `$X.XX/1M`. Toasts keep `~$X.XX/1M`. Unknown price is `unknown price` / `prix inconnu`.
- A `weak` badge forces `No reliable benchmark.` / `Sans benchmark fiable.` The `enterprise` badge is not rendered.
- Sentence words come from the catalog. Which clauses appear does not.
- Do not change scores, weights, diversification, clipboard JSON, or the `Recommendation` type fields.
- The demo gif stays a mock-up rebuilt from `docs/images/demo/demo.html`. No screen recording. No `package.nls`. No third language.
- Commits: optional — repository owner commits manually; skip git commit steps unless explicitly asked.
- Spec source of truth: `docs/superpowers/specs/2026-10-06-recommendation-popup-design.md`.

## File structure

- Create: `src/i18n/types.ts` — `Messages` and `CursorSuccessInput`.
- Create: `src/i18n/en.ts` — English catalog.
- Create: `src/i18n/fr.ts` — French catalog.
- Create: `src/i18n/index.ts` — `messagesFor`.
- Create: `src/__tests__/i18n.test.ts` — key parity and a few exact strings.
- Modify: `src/types.ts` — `AdvisorConfig.language`.
- Modify: `src/config.ts` — resolve `language`.
- Modify: `src/seed-settings.ts` — add `language` to `SETTING_KEYS`.
- Modify: `package.json` — contribute the setting.
- Modify: `src/ui/format-recommendation.ts` — description and detail formatters. Keep `formatScoreBreakdown`.
- Modify: `src/__tests__/recommendation-ui.test.ts` — formatter cases.
- Modify: `src/task/presets.ts` — ids only, labels leave this file.
- Modify: `src/ui/task-picker.ts` — labels from `Messages`.
- Modify: `src/ui/recommendation-ui.ts` — QuickPick layout and English/French actions.
- Modify: `src/commands/recommend.ts` — load messages, pass the task title.
- Modify: `src/apply/apply-adapter.ts` — toasts from `Messages`.
- Modify: `src/__tests__/classify-other.test.ts` — stop asserting French preset labels.
- Modify: `src/__tests__/config.test.ts` — language resolution.
- Modify: `README.md`, `CONTRIBUTING.md`, `docs/images/README.md`, `docs/images/demo/demo.html`, then rebuild `docs/images/demo.gif`.

---

### Task 1: Language catalogs

**Files:**

- Create: `src/i18n/types.ts`
- Create: `src/i18n/en.ts`
- Create: `src/i18n/fr.ts`
- Create: `src/i18n/index.ts`
- Test: `src/__tests__/i18n.test.ts`

**Interfaces:**

- Consumes: `TaskProfileId` from `src/types.ts`.
- Produces: `Messages`, `CursorSuccessInput`, `messagesFor(language: string | undefined): Messages`, `en`, `fr`.

- [ ] **Step 1: Write the failing test**

Create `src/__tests__/i18n.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { en } from "../i18n/en";
import { fr } from "../i18n/fr";
import { messagesFor } from "../i18n";

function leafKeys(value: unknown, prefix = ""): string[] {
  if (typeof value === "function" || value === null || typeof value !== "object") {
    return [prefix];
  }
  return Object.entries(value).flatMap(([key, child]) =>
    leafKeys(child, prefix ? `${prefix}.${key}` : key)
  );
}

describe("messages", () => {
  it("gives en and fr the same keys", () => {
    expect(leafKeys(fr).sort()).toEqual(leafKeys(en).sort());
  });

  it("defaults to English", () => {
    expect(messagesFor(undefined)).toBe(en);
    expect(messagesFor("nope")).toBe(en);
    expect(messagesFor("fr")).toBe(fr);
  });

  it("exposes the approved task and weak strings", () => {
    expect(en.task.presets.spec).toBe("Write a spec");
    expect(fr.task.presets.spec).toBe("Écrire une spec");
    expect(en.recommendations.sentence.weak).toBe("No reliable benchmark.");
    expect(fr.recommendations.sentence.weak).toBe("Sans benchmark fiable.");
    expect(en.notifications.copySuccess("Composer 2.5", "~$1.50/1M")).toBe(
      'Task Model Advisor: config copied for "Composer 2.5" (~$1.50/1M).'
    );
    expect(fr.notifications.copySuccess("Composer 2.5", "~$1.50/1M")).toBe(
      'Task Model Advisor: config copiée pour "Composer 2.5" (~$1.50/1M).'
    );
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/__tests__/i18n.test.ts`

Expected: FAIL, cannot find `src/i18n/en`.

- [ ] **Step 3: Add the catalogs**

Create `src/i18n/types.ts`:

```ts
import type { TaskProfileId } from "../types";

export type ContextTier = "standard" | "medium" | "high";
export type ThinkingTier = "off" | "low" | "medium" | "high";

export interface CursorSuccessInput {
  kind: "new-agent" | "composer";
  name: string;
  price: string;
  thinking: string;
  thinkingApplied: boolean;
  maxModeApplied: boolean;
  maxModeOn: boolean;
  context: string;
  commandId: string;
}

export interface SentenceFragments {
  bestFit: string;
  strongFit: string;
  weakerFit: string;
  comparisons: string;
  cheapest: string;
  pricier: string;
  reasonablePrice: string;
  /** Includes the leading comma: ", and " or ", et ". */
  fitComparisonsJoiner: string;
  /** Full sentence, including the period. */
  limitedData: string;
  /** Full sentence, including the period. */
  weak: string;
}

export interface Messages {
  task: {
    placeholder: string;
    presets: Record<TaskProfileId, string>;
    otherPrompt: string;
    otherPlaceholder: string;
  };
  recommendations: {
    placeholder: string;
    context: Record<ContextTier, string>;
    thinking: Record<ThinkingTier, string>;
    unknownPrice: string;
    sentence: SentenceFragments;
  };
  actions: {
    placeholder: string;
    apply: string;
    copy: string;
    refresh: string;
  };
  notifications: {
    unknownPrice: string;
    toastPrice: (amount: number | null) => string;
    copySuccess: (name: string, price: string) => string;
    copyFailed: (message: string) => string;
    validationFailed: (message: string) => string;
    manualApply: (name: string, price: string, context: string, thinking: string) => string;
    cursorSuccess: (input: CursorSuccessInput) => string;
    probesFailed: (errors: string) => string;
    noRunnableProbe: string;
  };
}
```

Create `src/i18n/en.ts` exporting `en: Messages` with:

- `task.placeholder`: `What kind of task?`
- presets: `Write a spec`, `Write a user story`, `Write a test scenario`, `Write a Python script to automate a task`, `Other`
- `otherPrompt`: `Describe the task`
- `otherPlaceholder`: `e.g. refactor the auth module`
- `recommendations.placeholder`: `Choose a recommendation`
- context: `standard context`, `medium context`, `high context`
- thinking: `thinking off`, `low thinking`, `medium thinking`, `high thinking`
- `unknownPrice`: `unknown price`
- sentence: `Best fit for this task`, `Strong fit`, `Weaker fit for this task`, `well ranked in comparisons`, `The cheapest`, `Pricier`, `at a reasonable price`, joiner `, and `, `Limited benchmark data.`, `No reliable benchmark.`
- actions: placeholder `Action`, `Apply (copy config)`, `Copy only`, `Refresh benchmarks`
- `toastPrice`: finite amount → `` `~$${amount.toFixed(2)}/1M` ``, otherwise `unknown price`
- `copySuccess`: `` `Task Model Advisor: config copied for "${name}" (${price}).` ``
- `copyFailed`: `` `Task Model Advisor: could not copy (${message}).` ``
- `validationFailed`: `` `Task Model Advisor: validation failed (${message}).` ``
- `manualApply`: `` `Task Model Advisor: model "${name}" (${price}), context "${context}", thinking "${thinking}". Config copied — set these manually in the Agent picker.` ``
- `cursorSuccess`: `new Agent` or `current composer model`, then `model "${name}"`, thinking with ` (effort)` only when `thinkingApplied`, `Max Mode ON|OFF (context ${context})` or `context "${context}" must be set manually (Max Mode)`, then `via ${commandId}. Config copied too.`
- `probesFailed`: `` `probes failed (${errors})` ``
- `noRunnableProbe`: `no runnable probe`

Create `src/i18n/fr.ts` with the same shape:

- `Quel type de tâche ?`
- `Écrire une spec`, `Écrire une user story`, `Écrire un scénario de test`, `Écrire un script Python pour automatiser une action`, `Autre`
- `Décrivez la tâche`, `Ex. refactorer le module auth`
- `Choisissez une recommandation`
- `contexte standard`, `contexte moyen`, `contexte élevé`
- `réflexion désactivée`, `réflexion faible`, `réflexion moyenne`, `réflexion élevée`
- `prix inconnu`
- fragments: `Le plus adapté à cette tâche`, `Très adapté`, `Moins adapté à cette tâche`, `bien classé dans les comparatifs`, `Le moins cher`, `Plus cher`, `à un prix raisonnable`, joiner `, et `, `Données de benchmark insuffisantes.`, `Sans benchmark fiable.`
- actions: `Action`, `Valider (copier la config)`, `Copier seulement`, `Actualiser les benchmarks`
- `copySuccess`: `` `Task Model Advisor: config copiée pour "${name}" (${price}).` ``
- `copyFailed`: `` `Task Model Advisor: impossible de copier (${message}).` ``
- `validationFailed`: `` `Task Model Advisor: la validation a échoué (${message}).` ``
- `manualApply`: `` `Task Model Advisor: modèle "${name}" (${price}), contexte "${context}", thinking "${thinking}". Config copiée — applique-les manuellement dans le sélecteur Agent.` ``
- `cursorSuccess`: `nouvel Agent` or `modèle du composer courant`, `modèle "${name}"`, the same `thinking` word as English, `Max Mode ON|OFF (contexte ${context})` or `contexte "${context}" à régler manuellement (Max Mode)`, `Config aussi copiée.`
- `probesFailed`: `` `probes échouées (${errors})` ``
- `noRunnableProbe`: `aucune sonde exécutable`

`toastPrice` uses the same `~$` format and the French unknown-price word.

Create `src/i18n/index.ts`:

```ts
import { en } from "./en";
import { fr } from "./fr";
import type { Messages } from "./types";

export type { CursorSuccessInput, Messages } from "./types";

export function messagesFor(language: string | undefined): Messages {
  return language === "fr" ? fr : en;
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/__tests__/i18n.test.ts`

Expected: PASS

---

### Task 2: Language setting

**Files:**

- Modify: `package.json` (configuration properties)
- Modify: `src/types.ts` (`AdvisorConfig`)
- Modify: `src/config.ts` (`resolveConfig`)
- Modify: `src/seed-settings.ts` (`SETTING_KEYS`)
- Test: `src/__tests__/config.test.ts`
- Test: `src/__tests__/seed-settings.test.ts` (existing parity test, no new case)

**Interfaces:**

- Consumes: nothing from Task 1.
- Produces: `AdvisorConfig.language: "en" | "fr"`. `SETTING_KEYS` includes `"language"`.

- [ ] **Step 1: Write the failing config test**

Add to `src/__tests__/config.test.ts` inside `describe("resolveConfig")`:

```ts
it("defaults language to en and accepts only fr", () => {
  expect(resolveConfig({}).language).toBe("en");
  expect(resolveConfig({ language: "fr" }).language).toBe("fr");
  expect(resolveConfig({ language: "de" }).language).toBe("en");
  expect(resolveConfig({ language: "" }).language).toBe("en");
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/__tests__/config.test.ts`

Expected: FAIL, `language` is undefined.

- [ ] **Step 3: Implement the setting**

In `package.json`, add this property next to the existing `taskModelAdvisor.*` keys:

```json
"taskModelAdvisor.language": {
  "type": "string",
  "enum": ["en", "fr"],
  "default": "en",
  "description": "Language for Task Model Advisor prompts, recommendations, and notifications."
}
```

In `AdvisorConfig`, add `language: "en" | "fr"`.

In `resolveConfig`, set `language: raw.language === "fr" ? "fr" : "en"`.

In `SETTING_KEYS`, append `"language"` so the existing seeder writes the package default on first launch.

In `loadAdvisorConfig` inside `src/commands/recommend.ts`, pass `language: section.get<string>("language")` into `resolveConfig`. This file still will not use the value until Task 4. The config test does not import `recommend.ts`.

- [ ] **Step 4: Run the tests**

Run: `npx vitest run src/__tests__/config.test.ts src/__tests__/seed-settings.test.ts`

Expected: PASS, including `SETTING_KEYS` matching `package.json`.

---

### Task 3: Recommendation line and sentence

**Files:**

- Modify: `src/ui/format-recommendation.ts`
- Test: `src/__tests__/recommendation-ui.test.ts`

**Interfaces:**

- Consumes: `Messages` from `src/i18n/types.ts`, `RANKING_WEIGHTS` from `src/constants.ts`, `Recommendation` from `src/types.ts`.
- Produces:
  - `formatRecommendationDescription(rec: Recommendation, messages: Messages): string`
  - `formatRecommendationDetail(rec: Recommendation, visible: Recommendation[], messages: Messages): string`
  - existing `formatScoreBreakdown` unchanged

- [ ] **Step 1: Write the failing tests**

Append to `src/__tests__/recommendation-ui.test.ts`. Build three recommendations with the Python-script eval numbers:

| Name               | taskFit | arena | cost | price | context  | thinking | badges  |
| ------------------ | ------- | ----- | ---- | ----- | -------- | -------- | ------- |
| Composer 2.5       | 1       | 0.26  | 0.46 | 1.5   | standard | medium   | matched |
| GPT-5.6 Sol Medium | 0.91    | 0.79  | 0.17 | 6.5   | standard | medium   | matched |
| GLM 5.3 Flash      | 0.13    | 0     | 0.83 | 0.24  | standard | medium   | matched |

`score` can be `0`. `rationale` can be `"ignored"`. `costTier` can be `"medium"`. `sessionModel.id` can equal the name.

Assert, using `en` and `fr` and the three-row `visible` array:

- Composer description: `standard context · medium thinking · $1.50/1M`
- Composer detail: `Best fit for this task, at a reasonable price.`
- GPT detail: `Strong fit, and well ranked in comparisons. Pricier.`
- GLM detail: `The cheapest. Weaker fit for this task.`
- French Composer detail: `Le plus adapté à cette tâche, à un prix raisonnable.`
- French GPT detail: `Très adapté, et bien classé dans les comparatifs. Plus cher.`
- French GLM detail: `Le moins cher. Moins adapté à cette tâche.`
- French GLM description: `contexte standard · réflexion moyenne · $0.24/1M`

Also:

- A row with `badges: ["weak", "enterprise"]` and any breakdown has detail `No reliable benchmark.` and the description does not contain `enterprise`.
- A row with `blendedPricePer1M: null` has a description ending in `unknown price`.
- Two non-weak rows with `taskFit: 0.8` both get `Strong fit` and neither gets `Best fit`. Give them prices `1` and `2`, arena `0`, cost `0.5`, so cost is in the top pair and the `$1` row is cheapest. The `$2` detail contains `Strong fit` and does not contain `Best fit`.
- One visible row with a finite price and `taskFit: 1`, `arena: 0`, `cost: 0.5` is not cheapest and not priciest. Detail is `Best fit for this task, at a reasonable price.`

Keep the existing `formatScoreBreakdown` test.

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/__tests__/recommendation-ui.test.ts`

Expected: FAIL, `formatRecommendationDescription` is not exported.

- [ ] **Step 3: Implement the formatters**

Keep `formatScoreBreakdown`. Add this to `src/ui/format-recommendation.ts`:

```ts
import { RANKING_WEIGHTS } from "../constants";
import type { Messages } from "../i18n/types";
import type { RankingWeights, Recommendation } from "../types";

type FactorId = "taskFit" | "arena" | "cost";

function capitalize(text: string): string {
  if (!text) return text;
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function topFactors(rec: Recommendation, weights: RankingWeights): FactorId[] {
  const factors: Array<{ id: FactorId; contribution: number; order: number }> = [
    { id: "taskFit", contribution: weights.taskFit * rec.breakdown.taskFit, order: 0 },
    { id: "arena", contribution: weights.arena * rec.breakdown.arena, order: 1 },
    { id: "cost", contribution: weights.cost * rec.breakdown.cost, order: 2 },
  ];
  return factors
    .filter((factor) => factor.contribution > 0)
    .sort((a, b) => b.contribution - a.contribution || a.order - b.order)
    .slice(0, 2)
    .map((factor) => factor.id);
}

function knownPrice(rec: Recommendation): number | undefined {
  const price = rec.blendedPricePer1M;
  if (price == null || !Number.isFinite(price)) return undefined;
  return price;
}

function priceRole(
  rec: Recommendation,
  visible: Recommendation[]
): "cheapest" | "priciest" | "neither" {
  const price = knownPrice(rec);
  if (price === undefined) return "neither";
  const prices = visible.map(knownPrice).filter((value): value is number => value !== undefined);
  if (prices.length < 2) return "neither";
  const cheapest = Math.min(...prices);
  const priciest = Math.max(...prices);
  if (price === cheapest && prices.filter((value) => value === cheapest).length === 1) {
    return "cheapest";
  }
  if (price === priciest && prices.filter((value) => value === priciest).length === 1) {
    return "priciest";
  }
  return "neither";
}

function isBestFit(rec: Recommendation, visible: Recommendation[]): boolean {
  const peers = visible.filter((row) => !row.badges.includes("weak"));
  return peers.every((row) => row === rec || rec.breakdown.taskFit > row.breakdown.taskFit);
}

export function formatRecommendationDescription(rec: Recommendation, messages: Messages): string {
  const price = knownPrice(rec);
  const priceLabel =
    price === undefined ? messages.recommendations.unknownPrice : `$${price.toFixed(2)}/1M`;
  return `${messages.recommendations.context[rec.contextWindow]} · ${messages.recommendations.thinking[rec.thinkingEffort]} · ${priceLabel}`;
}

export function formatRecommendationDetail(
  rec: Recommendation,
  visible: Recommendation[],
  messages: Messages
): string {
  const sentence = messages.recommendations.sentence;
  if (rec.badges.includes("weak")) return sentence.weak;

  const factors = topFactors(rec, RANKING_WEIGHTS);
  const clauses: string[] = [];
  if (factors.includes("taskFit")) {
    if (isBestFit(rec, visible)) clauses.push(sentence.bestFit);
    else if (rec.breakdown.taskFit >= 0.5) clauses.push(sentence.strongFit);
    else clauses.push(sentence.weakerFit);
  }
  if (factors.includes("arena")) clauses.push(sentence.comparisons);

  let body = "";
  if (clauses.length === 2) body = `${clauses[0]}${sentence.fitComparisonsJoiner}${clauses[1]}`;
  else if (clauses.length === 1) body = clauses[0] ?? "";

  const role = priceRole(rec, visible);
  if (role === "cheapest") {
    const lead = `${capitalize(sentence.cheapest)}.`;
    if (!body) return lead;
    return `${lead} ${capitalize(body)}.`;
  }

  if (factors.includes("cost") && role !== "priciest") {
    body = body ? `${body}, ${sentence.reasonablePrice}` : sentence.reasonablePrice;
  }

  if (!body && role !== "priciest") return sentence.limitedData;

  let detail = body ? `${capitalize(body)}.` : "";
  if (role === "priciest") {
    const tail = `${capitalize(sentence.pricier)}.`;
    detail = detail ? `${detail} ${tail}` : tail;
  }
  return detail;
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/__tests__/recommendation-ui.test.ts`

Expected: PASS

---

### Task 4: Wire the QuickPicks

**Files:**

- Modify: `src/task/presets.ts`
- Modify: `src/ui/task-picker.ts`
- Modify: `src/ui/recommendation-ui.ts`
- Modify: `src/commands/recommend.ts`
- Modify: `src/__tests__/classify-other.test.ts`

**Interfaces:**

- Consumes: `Messages`, `messagesFor`, `formatRecommendationDescription`, `formatRecommendationDetail`.
- Produces:
  - `TASK_PRESETS: Array<{ id: TaskProfileId }>` with no `label`
  - `pickTask(messages: Messages)`
  - `showRecommendations(recs, warnings, taskLabel, messages)`

- [ ] **Step 1: Update the preset test**

In `src/__tests__/classify-other.test.ts`, delete the two `label` expectations. Keep the length and id-order assertions.

- [ ] **Step 2: Point the pickers at the catalog**

`src/task/presets.ts` exports ids only:

```ts
export const TASK_PRESETS: Array<{ id: TaskProfileId }> = [
  { id: "spec" },
  { id: "userStory" },
  { id: "testScenario" },
  { id: "pythonScript" },
  { id: "other" },
];
```

`pickTask(messages: Messages)` uses `messages.task.presets[p.id]` as the QuickPick label, `messages.task.placeholder` as the placeholder, `messages.task.otherPrompt` as the input prompt, and `messages.task.otherPlaceholder` as the input placeholder.

`showRecommendations(recs, warnings, taskLabel, messages)`:

- QuickPick `title` is `taskLabel`.
- `placeHolder` is `messages.recommendations.placeholder`.
- Label stays `` `$(sparkle) ${rec.sessionModel.name}` ``.
- Description is `formatRecommendationDescription(rec, messages)`.
- Detail is `formatRecommendationDetail(rec, recs, messages)`.
- Keep `matchOnDescription` and `matchOnDetail`.
- Actions use `$(check)`, `$(copy)`, and `$(refresh)` plus `messages.actions.apply`, `.copy`, and `.refresh`.
- Action placeholder is `messages.actions.placeholder`.
- Delete `formatCostLabel` and the `formatScoreBreakdown` import from this file. Keep the `export { formatScoreBreakdown }` re-export if `eval-matrix` or tests import it from `recommendation-ui`. `eval-matrix` imports `formatScoreBreakdown` from `format-recommendation`, so the re-export can go.

`runRecommendCommand`:

```ts
const config = loadAdvisorConfig();
const messages = messagesFor(config.language);
const task = await pickTask(messages);
```

After ranking, the title is `customText ? messages.task.presets.other : messages.task.presets[profileId]`. Pass it to `showRecommendations(recommendations, warnings, taskLabel, messages)`.

- [ ] **Step 3: Run the tests and the typecheck**

Run: `npx vitest run src/__tests__/classify-other.test.ts src/__tests__/recommendation-ui.test.ts && npx tsc -p . --noEmit`

Expected: PASS and no type errors.

---

### Task 5: Notification copy

**Files:**

- Modify: `src/apply/apply-adapter.ts`
- Modify: `src/commands/recommend.ts`

**Interfaces:**

- Consumes: `Messages`, `CursorSuccessInput`.
- Produces: `applyRecommendation(rec, strategy, profileId, messages, rank = 1)` and `copyRecommendationToClipboard(rec, profileId, messages, rank = 1)`.

- [ ] **Step 1: Thread `messages` through apply**

Replace the local `formatPrice` unknown branch with `messages.notifications.toastPrice(rec.blendedPricePer1M)`.

`manualApplyMessage(rec, messages)` calls `messages.notifications.manualApply(name, price, rec.contextWindow, rec.thinkingEffort)`.

Probe failure detail uses `messages.notifications.probesFailed(...)` and `messages.notifications.noRunnableProbe`.

`successMessage` calls `messages.notifications.cursorSuccess` with `kind: result.kind === "new-agent" ? "new-agent" : "composer"`, `maxModeOn: result.maxModeTarget`, and the raw context and thinking values.

`applyRecommendation` and `copyRecommendationToClipboard` take `messages` before the optional `rank`. Validation `catch` uses `messages.notifications.validationFailed`. Copy success and copy failure use the catalog functions.

In `runRecommendCommand`, pass `messages` into both functions. The remaining French string `` `Task Model Advisor: validation a échoué (${message}).` `` becomes `messages.notifications.validationFailed(message)`.

- [ ] **Step 2: Run the suite**

Run: `npx vitest run && npx tsc -p . --noEmit`

Expected: PASS and no type errors. `src/__tests__/apply-adapter.test.ts` does not call `applyRecommendation`, so it stays green.

---

### Task 6: Docs and demo gif

**Files:**

- Modify: `README.md`
- Modify: `CONTRIBUTING.md`
- Modify: `docs/images/README.md`
- Modify: `docs/images/demo/demo.html`
- Rebuild: `docs/images/demo.gif`

**Interfaces:**

- Consumes: the English catalog strings from Task 1 and the spec-task sentences from the spec.
- Produces: README, CONTRIBUTING, and the gif matching the English default UI.

- [ ] **Step 1: Update the docs**

In `README.md`:

- Replace the action table labels `Valider` (Validate), `Copier seulement` (Copy), and `Actualiser` (Refresh) with `Apply`, `Copy only`, and `Refresh benchmarks`. Keep the behavior descriptions.
- Delete the note `The interface labels are currently in French.`
- After the quick start, add one sentence: set `taskModelAdvisor.language` to `fr` for French prompts. The default is `en`.
- Replace the Good to know bullet about the **weak** badge with: a model that cannot be linked to a benchmark is shown with the sentence `No reliable benchmark.`

In `CONTRIBUTING.md`, change the macOS Cursor manual-test expected cell from `Top 3 from session models; badges and rationale shown.` to `Top 3 from session models; each row shows context, thinking, price, and one sentence.` In the “How it works” or settings area, name `src/i18n/en.ts`, `src/i18n/fr.ts`, and `taskModelAdvisor.language`.

In `docs/images/README.md`, delete the bullet that says to replace the gif with a real screen recording. Keep the rebuild command.

- [ ] **Step 2: Update the mock and rebuild the gif**

In `docs/images/demo/demo.html`, switch the visible copy to the English catalog:

- Task rows: `Write a spec`, `Write a user story`, `Write a test scenario`, `Write a Python script to automate a task`, `Other`.
- Recommendation placeholder: `Choose a recommendation`.
- Keep the three models Claude Opus 5.5 Medium, Claude Opus 5 High, and Grok 4.6 Medium.
- Descriptions: `high context · medium thinking · $8.00/1M`, `high context · medium thinking · $8.00/1M`, `high context · medium thinking · $2.20/1M`.
- Details: `Best fit for this task, and well ranked in comparisons.`, `Strong fit, and well ranked in comparisons.`, `The cheapest. Weaker fit for this task, and well ranked in comparisons.`
- Actions: `Apply (copy config)`, `Copy only`, `Refresh benchmarks`.

Run: `bash docs/images/demo/build-gif.sh`

Expected: `Wrote docs/images/demo.gif` and a non-empty file. Requires Google Chrome and `ffmpeg` on macOS.

- [ ] **Step 3: Run the full test suite**

Run: `npm test`

Expected: PASS
