# Contributing to Task Model Advisor

Developer and release notes. End-user docs live in [README.md](README.md).

## Development setup

```bash
npm install
npm run compile
npm test
npm run lint
npm run watch   # optional: tsc --watch
```

`npm install` runs `prepare` → installs the Husky **pre-commit** hook. On each commit: **lint-staged** (ESLint + Prettier on staged files), then **`npm test`**. Either failure blocks the commit.

**Extension Development Host (F5)**

1. Open this folder in VS Code or Cursor.
2. Press **F5** to launch an Extension Development Host.
3. In the host window, run **Task Model Advisor: Recommend a model for this task**.

**Packaged `.vsix`**

```bash
npm run package   # → task-model-advisor-0.1.0.vsix
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

Pre-commit: Husky → `lint-staged` (ESLint + Prettier on staged files), then `npm test`.

## Ranking eval matrix

Synthetic catalog (Cursor-like session models + AA/Arena fixtures). Runs matching + ranking for every task profile and prints top-3 with score breakdowns:

```bash
npm run eval:ranking
```

Edit fixtures in `src/ranking/eval-fixtures.ts` to stress-test scenarios.

### Ranking notes (for tuning)

- Base weights: `0.45×taskFit + 0.25×arena + 0.3×cost`, with a per-profile tilt (spec → more quality; userStory / pythonScript → more cost-aware).
- Cost uses absolute log $/1M (~$0.10–$15). Too much cost weight → cheap flash models dominate; too little → expensive Opus everywhere.
- Top-3 injects a cheaper matched alternative when the leader is expensive (`diversifyTop3`).
- Recommendation UI shows `score · fit · arena · cost` on each row.

### Host / apply notes

- **Cursor models:** Cursor does not expose Agent models through `vscode.lm`. Order: `vscode.lm` → Cursor CLI (`agent --list-models`, optional `taskModelAdvisor.cursor.apiKey`) → Cursor API `GET /v1/models` → manual multi-select from `taskModelAdvisor.fallbackModels`.
- **Validate on Cursor (experimental):** `cursorai.action.switchToModelSlug` with `modelIdWithParams` (effort + optional context hint); probes Max Mode for high-context recs — may not stick on all builds. Clipboard JSON always as backup.
- **Arena soft-fail:** unreachable mirror → warning + AA-only ranking (expected).

## Design docs

- Spec: `docs/superpowers/specs/2026-03-22-task-model-advisor-design.md`
- Plan: `docs/superpowers/plans/2026-10-05-task-model-advisor.md`

## Acceptance checklist (design §12)

Manual verification before release:

- [ ] **1.** Run the command, pick each of the five task entries, and receive up to three recommendations from **session-available models only**.
- [ ] **2.** With a valid AA API key and network, recommendations reflect AA pricing/indices and Arena data when the mirror responds.
- [ ] **3.** With Arena unavailable, recommendations still work with a non-blocking warning.
- [ ] **4.** **Validate** applies or copies full configuration without throwing.
- [ ] **5.** Extension loads on Windows VS Code (Copilot) and macOS Cursor without separate builds.
- [ ] **6.** Unit test suite covers ranking and matching with at least 20 fixture cases including enterprise alias scenarios (`npm test`).

## Manual test matrix (owner)

| Scenario                                               | Expected                                                                                                         |
| ------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------- |
| **macOS Cursor** — recommend after chat is available   | Top 3 from session models; badges and rationale shown.                                                           |
| **Windows VS Code + Copilot** — same flow              | Same behavior; models match Copilot allowlist labels.                                                            |
| **Bad / missing AA API key** or network blocked for AA | Clear error (Artificial Analysis fetch failed); command exits without crash.                                     |
| **Arena down** (mirror unreachable; mock in tests)     | Warning in UI; ranking continues using Artificial Analysis only.                                                 |
| **Empty `discoverSessionModels` list**                 | On Cursor: manual multi-select from `fallbackModels`. On VS Code+Copilot: sign in / open chat, or same fallback. |

## Marketplace / release (deferred)

Do not publish until the owner asks. Remaining items typically include:

- Real `publisher` (not `"local"`), `repository`, `license`, `keywords`, icon, `galleryBanner`
- `LICENSE` file
- Open VSX / VS Marketplace publish
- Screenshots under `docs/images/` linked from the README
