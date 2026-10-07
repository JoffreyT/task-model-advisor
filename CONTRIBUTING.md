# Contributing to Task Model Advisor

Everything for developers: setup, how the extension works, tuning, testing and release.
End-user docs live in [README.md](README.md).

**Contents**

1. [Development setup](#development-setup)
2. [Scripts](#scripts)
3. [How it works](#how-it-works)
4. [Tuning and extending](#tuning-and-extending)
5. [Design docs](#design-docs)
6. [Release](#release)

## Development setup

```bash
npm install
npm run compile
npm test
npm run lint
npm run watch   # optional: tsc --watch
```

`npm install` runs `prepare` → installs the Husky **pre-commit** hook. On each commit: **lint-staged** (ESLint + Prettier check on staged files), then `npm test`. Either failure blocks the commit.

**Extension Development Host (F5)**

1. Open this folder in VS Code or Cursor.
2. Press **F5** to launch an Extension Development Host.
3. In the host window, run **Task Model Advisor: Recommend a model for this task**.

**Packaged `.vsix`**

```bash
npm run package   # → task-model-advisor-<version>.vsix
```

## Scripts

| Script                 | Purpose                              |
| ---------------------- | ------------------------------------ |
| `npm run compile`      | TypeScript → `out/`                  |
| `npm test`             | Vitest unit suite                    |
| `npm run lint`         | ESLint on `src/`                     |
| `npm run lint:fix`     | ESLint with `--fix`                  |
| `npm run format`       | Prettier write                       |
| `npm run format:check` | Prettier check (no write)            |
| `npm run eval:ranking` | Synthetic ranking matrix (see below) |
| `npm run package`      | `vsce package` → `.vsix`             |

## How it works

### Pipeline

```text
 pickTask ──► fetch in parallel ──► match ──► rank ──► QuickPick ──► apply / copy / refresh
              ├─ Artificial Analysis  (benchmarks, pricing)
              ├─ Arena leaderboard    (soft-fail)
              └─ session models       (vscode.lm → Cursor CLI → Cursor API)
```

Orchestrated by `runRecommendCommand` in `src/commands/recommend.ts`. **Refresh** loops back to the fetch step with the same task. `pickTask` returns a **preset label** id (`TaskPresetId`); ranking uses the resolved **engine** (`RankingEngineId`) from `engineForPreset` or `classifyOther`.

### Module map

| Path                                   | Role                                                           |
| -------------------------------------- | -------------------------------------------------------------- |
| `src/extension.ts`                     | `activate`: registers the command, then seeds settings         |
| `src/seed-settings.ts`                 | Writes unset `taskModelAdvisor.*` keys to User settings        |
| `src/config.ts`                        | Builds `AdvisorConfig` from the two API keys + constants       |
| `src/constants.ts`                     | Every tunable that is **not** a user setting                   |
| `src/commands/recommend.ts`            | The end-to-end flow                                            |
| `src/task/presets.ts`                  | QuickPick **labels** (8 tasks + Autre) and preset → engine map |
| `src/task/classify-other.ts`           | Autre free text → **ranking engine** (regex, no LLM)           |
| `src/providers/artificial-analysis.ts` | AA Data API client and mapping to `BenchmarkModel`             |
| `src/providers/arena.ts`               | Arena leaderboard client (wulong mirror)                       |
| `src/host/model-discovery.ts`          | Session models: `vscode.lm`, then Cursor fallbacks             |
| `src/host/cursor-model-discovery.ts`   | `agent --list-models` and `GET /v1/models`                     |
| `src/matching/`                        | Name normalization, similarity, session ↔ benchmark matching   |
| `src/ranking/task-ranker.ts`           | **Engine** scoring, context/thinking heuristics, top-3         |
| `src/ranking/eval-*.ts`                | Synthetic catalog and matrix for tuning                        |
| `src/apply/`                           | Clipboard payload and Cursor model switching                   |
| `src/ui/`                              | QuickPick UI and score formatting                              |

### Settings vs constants

User settings: the two API keys (`artificialAnalysis.apiKey`, `cursor.apiKey`) and `taskModelAdvisor.language` (`en` or `fr`). UI strings live in `src/i18n/en.ts` and `src/i18n/fr.ts`. Everything else is a constant in `src/constants.ts`: Arena source and categories, ranking weights, model aliases, fuzzy threshold, apply strategy, fetch timeout, reasoning-model patterns.

On activation, `seedUnsetUserSettings` writes any key that is unset in user, workspace and workspace-folder scope into **User** settings, using the `package.json` default. A test fails if `SETTING_KEYS` and `contributes.configuration.properties` diverge. Details: [seed spec](docs/superpowers/specs/2026-10-06-seed-default-settings-design.md).

### Data sources

| Source              | Endpoint                                                                 | Auth                | Used for                                                               |
| ------------------- | ------------------------------------------------------------------------ | ------------------- | ---------------------------------------------------------------------- |
| Artificial Analysis | `GET https://artificialanalysis.ai/api/v2/data/llms/models`              | `x-api-key`         | Intelligence / coding index, evaluations, blended $/1M, context tokens |
| Arena (mirror)      | `GET https://api.wulong.dev/arena-ai-leaderboards/v1/leaderboard?name=…` | none                | Rank and optional Elo score per category                               |
| Cursor API          | `GET https://api.cursor.com/v1/models`                                   | `Bearer` Cursor key | Session models, last resort on Cursor                                  |

- AA failures (**missing key, HTTP, timeout, parse**) are fatal: the command shows an error and exits.
- Arena failures are **non-fatal**: a warning is shown and ranking continues on AA only. Category fallback chain: `hard_prompts` → `text`, `coding` → `code`. A `404` or an empty list moves to the next name.
- All requests use `AbortSignal.timeout(FETCH_TIMEOUT_MS)` (8 s).

### Session model discovery

Order in `discoverSessionModels`:

1. `vscode.lm.selectChatModels()`. Used as-is when non-empty (VS Code + Copilot).
2. If empty and the host looks like Cursor (or a Cursor key is set): Cursor CLI — `agent --list-models`, then `agent models`, with `--api-key` / `CURSOR_API_KEY` when a key is set.
3. If a key is set and the CLI yielded nothing: Cursor API `GET /v1/models`.
4. Still empty → the command stops with an error.

Cursor does not expose Agent models through `vscode.lm`, hence steps 2–3.

### Matching

Each session model is linked to a benchmark model:

1. Alias lookup by session `id` or `name` (`MODEL_ALIASES`, empty by default).
2. Otherwise best similarity between normalized names/slugs; accepted above `FUZZY_THRESHOLD` (0.72).
3. Badges: `matched`, `weak` (no reliable benchmark), `enterprise` (id or name contains "enterprise" / "entreprise").

### Ranking

`final score = wTaskFit × taskFit + wArena × arena + wCost × cost`, each component in [0, 1].

**Task fit** (min-max normalized across matched models):

| Engine                           | Raw signal                                                                |
| -------------------------------- | ------------------------------------------------------------------------- |
| `coding`                         | coding index × 0.7 + LiveCodeBench × 0.3 (falls back to whichever exists) |
| `writing`                        | mean of intelligence index and GDPval / writing eval when present         |
| `reasoning`, `cheap`, `balanced` | intelligence index                                                        |

**Arena**: if any entry has an Elo score, Elo is min-max normalized; otherwise `1 - (rank - 1) / n`. No entry → 0.

**Cost**: absolute log scale, not min-max, so a $0.24 model and a $8 model are meaningfully apart:

```text
cost = 1 - clamp( (ln(price) - ln(0.10)) / (ln(15) - ln(0.10)) )     unknown price → 0.5
```

**Weights**: base `0.45 / 0.25 / 0.30` (`RANKING_WEIGHTS`), tilted per engine in `resolveEngineWeights`:

| Engine                  | taskFit | arena | cost |
| ----------------------- | ------- | ----- | ---- |
| `writing`               | 0.50    | 0.25  | 0.25 |
| `coding`                | 0.45    | 0.20  | 0.35 |
| `cheap`                 | 0.35    | 0.20  | 0.45 |
| `reasoning`, `balanced` | 0.45    | 0.25  | 0.30 |

Cost weight tuning rule of thumb: too high → cheap flash models dominate; too low → expensive Opus everywhere.

**Output**

- **Weak** models are appended after all matched ones, with a zeroed breakdown.
- `diversifyTop3` keeps the #1 and tries to include one cheaper matched alternative (cost score ≥ 0.35 and price ≤ 55% of the leader's, or a clearly better cost score when a price is unknown). The final three are ordered by score.
- **Context window**: engine default (`writing` high, `coding` standard, `cheap` standard, `reasoning` and `balanced` medium), capped by the model's real context size (< 48k standard, < 100k medium, else high), bumped one tier when custom text mentions codebase / repo / monorepo / multi-fichier / large / gros.
- **Thinking effort**: engine default (`writing` medium, `coding` medium, `cheap` low, `reasoning` and `balanced` medium), bumped one level for reasoning models (`REASONING_MODEL_PATTERNS`: `o1`, `o3`, `deepseek-r1`, `extended`).
- The UI row shows `score · fit · arena · cost`.

### Applying a recommendation

Every **Validate** and **Copy** writes this to the clipboard first:

```json
{
  "model": "Claude Opus 5.5 Medium",
  "modelId": "claude-opus-5-5-medium",
  "contextWindow": "high",
  "thinkingEffort": "medium",
  "task": "spec",
  "engine": "writing",
  "rank": 1,
  "scoreBreakdown": { "taskFit": 1, "arena": 1, "cost": 0.13 },
  "blendedPricePer1M": 8,
  "costTier": "high"
}
```

**Breaking change (pre-Marketplace):** clipboard `task` values are **preset** ids (`spec`, `debug`, `other`, …). Old profile ids such as `pythonScript` and `testScenario` are no longer written. Scripts should read `engine` for ranking semantics and `task` for what the user picked.

- **VS Code:** nothing else to apply; an info message tells the user what to select.
- **Cursor (experimental):** `tryApplyCursorModel` probes undocumented commands in order, without checking `getCommands()` (many Cursor actions are filtered from that list):
  1. `cursorai.action.switchToModelSlug` (and the `Glass` variants) with `modelIdWithParams` = `{ modelId, params: [{ id: "effort" }, { id: "context" }] }`, then `newAgentWithModel`.
  2. A second probe with a full `modelConfig` to set Max Mode (**on** only for `high` context).
  - Model ids tried: the session `id`, the `name`, and slugified variants of both.
  - A failure at any point falls back to the manual message. The clipboard JSON is always there.
- `APPLY_STRATEGY` (`auto-then-manual`) is a constant; `clipboard-only` skips auto-apply.

## Tuning and extending

### Ranking eval matrix

Synthetic catalog (Cursor-like session models + AA/Arena fixtures). Runs matching + ranking for every **ranking engine** (plus extra `balanced` rows with custom text) and prints the top 3 with score breakdowns:

```bash
npm run eval:ranking
```

Edit fixtures in `src/ranking/eval-fixtures.ts` to stress-test scenarios.

### Common changes

| I want to…                 | Edit                                                                                                  |
| -------------------------- | ----------------------------------------------------------------------------------------------------- |
| Change base weights        | `RANKING_WEIGHTS` in `src/constants.ts`, then re-run `npm run eval:ranking`                           |
| Change per-engine tilt     | `resolveEngineWeights` in `src/ranking/task-ranker.ts`                                                |
| Map a host model to a slug | `MODEL_ALIASES` in `src/constants.ts`                                                                 |
| Treat a model as reasoning | `REASONING_MODEL_PATTERNS` in `src/constants.ts`                                                      |
| Add a new user setting     | `contributes.configuration` in `package.json`, `SETTING_KEYS`, `resolveConfig` (a test checks parity) |

### Adding a QuickPick preset

1. Add the id to `TaskPresetId` in `src/types.ts`.
2. Add a row to `TASK_PRESETS` and map it in `PRESET_ENGINE` (`src/task/presets.ts`).
3. Add en/fr labels in `src/i18n/en.ts` and `src/i18n/fr.ts`.
4. Do **not** add Arena or ranker branches unless the preset needs a **new** engine (map it to an existing engine instead).
5. Add tests; eval matrix only needs a change if you add a new engine.

### Adding a ranking engine

1. Add the id to `RankingEngineId` in `src/types.ts`.
2. Add its Arena category in `ARENA_CATEGORIES` (`src/constants.ts`).
3. Extend `rawTaskFit`, `engineDefaults`, and `resolveEngineWeights` in `src/ranking/task-ranker.ts`.
4. Add the engine to `EVAL_ENGINES` in `src/ranking/eval-matrix.ts` and update eval-matrix tests.
5. Update the ranking tables in this file and run `npm run eval:ranking`.

## Design docs

`docs/superpowers/` holds the design history, newest first:

- Public task presets: [spec](docs/superpowers/specs/2026-10-07-public-task-presets-design.md) · [plan](docs/superpowers/plans/2026-10-07-public-task-presets.md)
- Seed settings: [spec](docs/superpowers/specs/2026-10-06-seed-default-settings-design.md) · [plan](docs/superpowers/plans/2026-10-06-seed-default-settings.md)
- Original: [spec](docs/superpowers/specs/2026-03-22-task-model-advisor-design.md) · [plan](docs/superpowers/plans/2026-10-05-task-model-advisor.md)

> The original spec and plan still describe settings that are now constants (`enabled`, `arena.source`, `modelAliases`, `matching.fuzzyThreshold`, `applyStrategy`, `fallbackModels`…). `src/constants.ts` and this file are the current source of truth.

## Release

### Acceptance checklist (original design §12)

Manual verification before release:

- [ ] **1.** Run the command, pick each of the five task entries, and receive up to three recommendations from **session-available models only**.
- [ ] **2.** With a valid AA API key and network, recommendations reflect AA pricing/indices and Arena data when the mirror responds.
- [ ] **3.** With Arena unavailable, recommendations still work with a non-blocking warning.
- [ ] **4.** **Validate** applies or copies the full configuration without throwing.
- [ ] **5.** Extension loads on Windows VS Code (Copilot) and macOS Cursor without separate builds.
- [ ] **6.** Unit test suite covers ranking and matching with at least 20 fixture cases including enterprise alias scenarios (`npm test`).

### Manual test matrix (owner)

| Scenario                                               | Expected                                                                                                                            |
| ------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------- |
| **macOS Cursor** — recommend after chat is available   | Top 3 from session models; each row shows context, thinking, price, and one sentence.                                               |
| **Windows VS Code + Copilot** — same flow              | Same behavior; models match Copilot allowlist labels.                                                                               |
| **Bad / missing AA API key** or network blocked for AA | Clear error (Artificial Analysis fetch failed); command exits without crash.                                                        |
| **Arena down** (mirror unreachable; mock in tests)     | Warning in UI; ranking continues using Artificial Analysis only.                                                                    |
| **Empty session model list**                           | Error message; command exits. On Cursor: set `taskModelAdvisor.cursor.apiKey` or run `agent login`. On VS Code: sign in to Copilot. |

### Marketplace (deferred)

Do not publish until the owner asks. Remaining items typically include:

- `publisher` (`jft63`) + `LICENSE` (MIT) set; still needed: `keywords`, icon, `galleryBanner`
- `LICENSE` file
- Open VSX / VS Marketplace publish
- Keep the mock-up `docs/images/demo.gif` in sync with UI labels via `bash docs/images/demo/build-gif.sh` (see `docs/images/README.md`)
