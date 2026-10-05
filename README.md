# Task Model Advisor

VS Code extension that recommends the best available LLM (model, context window, thinking effort) for a task using live benchmarks from [Artificial Analysis](https://artificialanalysis.ai/) and an Arena-style leaderboard mirror.

Works on **Visual Studio Code + GitHub Copilot** and **Cursor** from the same package.

## Install

**Development (Extension Development Host)**

1. Clone the repo and run `npm install` then `npm run compile`.
2. Open the folder in VS Code or Cursor, press **F5** to launch an Extension Development Host.
3. In the host window, run the recommend command (see below).

**Packaged `.vsix`**

```bash
npm install
npm run compile
npm run package   # vsce package → task-model-advisor-0.1.0.vsix
```

Install the `.vsix` via **Extensions: Install from VSIX…** in the command palette.

## Configuration

Set your Artificial Analysis Data API key in user or workspace settings:

| Setting | Description |
|---------|-------------|
| `taskModelAdvisor.artificialAnalysis.apiKey` | Required for benchmark fetch (Artificial Analysis Data API). |

Other settings use sensible defaults (`taskModelAdvisor.enabled`, Arena categories, ranking weights, aliases, `taskModelAdvisor.applyStrategy`, etc.). See `package.json` → `contributes.configuration`.

## Usage

**Command:** Task Model Advisor: Recommend a model for this task

**Shortcut:** `Cmd+Option+R` (macOS) · `Ctrl+Alt+R` (Windows / Linux)

1. Pick a task preset or **Autre** (free-text description).
2. Wait for benchmarks and session models to load.
3. Choose one of up to **three** recommendations (Validate, Copy configuration, or Refresh benchmarks).

## Ranking eval matrix

Synthetic catalog (Cursor-like session models + AA/Arena fixtures). Runs matching + ranking for every task profile and prints top-3 with score breakdowns:

```bash
npm run eval:ranking
```

Edit fixtures in `src/ranking/eval-fixtures.ts` to stress-test scenarios.

## Privacy

- **Network:** HTTP requests run **only** when you invoke the recommend command or choose **Refresh benchmarks** — not in the background.
- **Autre text:** Custom task text is used **locally** (keyword-based profile selection). It is not sent to Artificial Analysis, Arena, or any extension-author server in v1.
- **No telemetry** of prompt content in v1.

## Known limitations

- Ranking: base weights `0.45×taskFit + 0.25×arena + 0.3×cost`, with a per-profile tilt (spec more quality; userStory / pythonScript more cost-aware). Cost uses absolute log $/1M (~$0.10–$15). Top-3 also injects a cheaper matched alternative when the leader is expensive.
- Recommendation UI shows `score · fit · arena · cost` on each row.
- **Validate on Cursor (experimental):** applies model via `cursorai.action.switchToModelSlug` with `modelIdWithParams` (includes `effort` for thinking, optional `context` hint). Then probes a full `modelConfig` (incl. `maxMode`) for high-context recs — Max Mode may only stick on some Cursor builds. Clipboard JSON always as backup. Set `taskModelAdvisor.applyStrategy` to `clipboard-only` to skip.
- **Cursor models:** Cursor does **not** expose Agent models through `vscode.lm`. The extension tries, in order: `vscode.lm` → Cursor CLI (`agent --list-models`, with optional `taskModelAdvisor.cursor.apiKey`) → Cursor API `GET /v1/models` → manual multi-select from `taskModelAdvisor.fallbackModels`.
- Create a Cursor API key at [cursor.com/dashboard](https://cursor.com/dashboard) → **API Keys**, then set `taskModelAdvisor.cursor.apiKey`. Alternatively run `agent login` in a terminal so the CLI can list models.
- **Context window tiers** are heuristic (profile defaults, Artificial Analysis `contextWindowTokens` caps, and keyword bumps for large codebases). They approximate host UI labels (`standard` / `medium` / `high`) and may not match every editor build.

## Acceptance checklist (design §12)

Manual verification before release:

- [ ] **1.** Run the command, pick each of the five task entries, and receive up to three recommendations from **session-available models only**.
- [ ] **2.** With a valid AA API key and network, recommendations reflect AA pricing/indices and Arena data when the mirror responds.
- [ ] **3.** With Arena unavailable, recommendations still work with a non-blocking warning.
- [ ] **4.** **Validate** applies or copies full configuration without throwing.
- [ ] **5.** Extension loads on Windows VS Code (Copilot) and macOS Cursor without separate builds.
- [ ] **6.** Unit test suite covers ranking and matching with at least 20 fixture cases including enterprise alias scenarios (`npm test`).

## Manual test matrix (owner)

| Scenario | Expected |
|----------|----------|
| **macOS Cursor** — recommend after chat is available | Top 3 from session models; badges and rationale shown. |
| **Windows VS Code + Copilot** — same flow | Same behavior; models match Copilot allowlist labels. |
| **Bad / missing AA API key** or network blocked for AA | Clear error (Artificial Analysis fetch failed); command exits without crash. |
| **Arena down** (mirror unreachable; mock in tests) | Warning in UI; ranking continues using Artificial Analysis only. |
| **Empty `discoverSessionModels` list** | On Cursor: manual multi-select from `fallbackModels`. On VS Code+Copilot: sign in / open chat, or same fallback. |

## Development

```bash
npm install
npm run compile
npm test
npm run watch   # optional: tsc --watch
```

Design spec: `docs/superpowers/specs/2026-03-22-task-model-advisor-design.md`.
