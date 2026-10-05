# Task Model Advisor

Recommend the best **model**, **context window**, and **thinking effort** for your next task — based on live benchmarks, restricted to models you can actually use in this session.

Works on **Visual Studio Code + GitHub Copilot** and **Cursor** from the same package.

## Features

- **Task-aware top 3** — pick a preset (spec, user story, test scenario, Python script) or describe a custom task
- **Live benchmarks** — Artificial Analysis indices & pricing, plus Arena-style leaderboard data when available
- **Session-only models** — never suggests a model you cannot select in the current editor
- **Validate / Copy / Refresh** — apply when the host allows, or copy a structured config to the clipboard

## Install

**From the Marketplace** (when published)

Search for **Task Model Advisor** in the Extensions view and install.

**From a `.vsix`**

1. Download or build `task-model-advisor-*.vsix`
2. Command Palette → **Extensions: Install from VSIX…**
3. Select the file and reload if prompted

## Setup

1. Get an [Artificial Analysis](https://artificialanalysis.ai/) Data API key.
2. Open Settings and set:

| Setting                                      | Required                  | Description                                                                                         |
| -------------------------------------------- | ------------------------- | --------------------------------------------------------------------------------------------------- |
| `taskModelAdvisor.artificialAnalysis.apiKey` | Yes                       | Artificial Analysis Data API key                                                                    |
| `taskModelAdvisor.cursor.apiKey`             | Cursor only (recommended) | Lists Agent models when `vscode.lm` is empty ([Dashboard → API Keys](https://cursor.com/dashboard)) |
| `taskModelAdvisor.fallbackModels`            | Optional                  | Manual model list if auto-discovery fails — use the same labels as in your Agent picker             |

Other settings (`applyStrategy`, aliases, ranking weights, etc.) have sensible defaults.

## Usage

**Command:** `Task Model Advisor: Recommend a model for this task`  
**Shortcut:** `Cmd+Option+R` (macOS) · `Ctrl+Alt+R` (Windows / Linux)

1. Choose a task preset, or **Autre** and describe what you need.
2. Wait while benchmarks and session models load.
3. Pick one of up to three recommendations → **Validate**, **Copy configuration**, or **Refresh benchmarks**.

## Screenshots

_Screenshots coming soon — place images under `docs/images/` and link them here._

## Privacy

- Network requests run **only** when you invoke the command or **Refresh benchmarks** — not in the background.
- Custom task text (**Autre**) is used **locally** for profile selection. It is not sent to Artificial Analysis, Arena, or any extension-author server.
- No telemetry of prompt content.

## Limitations

- **Validate** is best-effort: on some hosts or Cursor builds, model/context/thinking may need a manual confirm. Clipboard JSON is always available as backup. Use `taskModelAdvisor.applyStrategy`: `clipboard-only` to skip auto-apply.
- On **Cursor**, Agent models are not exposed via `vscode.lm`. Discovery falls back to the Cursor CLI / API, then to `fallbackModels`.
- If the Arena leaderboard is unreachable, ranking continues with Artificial Analysis only (with a warning).
- Context window tiers (`standard` / `medium` / `high`) are heuristic approximations of host UI labels.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for development setup, tests, ranking eval, and the release checklist.
