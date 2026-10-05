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

## Privacy

- **Network:** HTTP requests run **only** when you invoke the recommend command or choose **Refresh benchmarks** — not in the background.
- **Autre text:** Custom task text is used **locally** (keyword-based profile selection). It is not sent to Artificial Analysis, Arena, or any extension-author server in v1.
- **No telemetry** of prompt content in v1.

## Known limitations

- **Validate** may be **clipboard-only** on some hosts: if the editor exposes no stable API to set model / context / thinking, the extension copies structured JSON and shows manual steps (`taskModelAdvisor.applyStrategy`: `auto-then-manual` vs `clipboard-only`).
- **Empty session models:** If `discoverSessionModels()` returns no chat models, you see: *“No chat models available in this session. Sign in to Copilot or Cursor and open chat, then try again.”* Open chat and ensure you are signed in before retrying.
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
| **Empty `discoverSessionModels` list** | Friendly error asking to sign in and open chat (see above). |

## Development

```bash
npm install
npm run compile
npm test
npm run watch   # optional: tsc --watch
```

Design spec: `docs/superpowers/specs/2026-03-22-task-model-advisor-design.md`.
