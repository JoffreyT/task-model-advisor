# Task Model Advisor — Design Specification

**Status:** Validated  
**Date:** 2026-03-22  
**Intended repository:** Standalone VS Code extension at `~/dev/task-model-advisor` (greenfield)  
**Marketplace display name:** Task Model Advisor  
**Hosts:** Visual Studio Code + GitHub Copilot (Windows, work) and Cursor (macOS, personal)

> Formerly drafted as « LLM Prompt Router ». Renamed to avoid confusion with the existing Marketplace extension **Prompt Router** (Ask/Plan/Agent mode routing).

---

## 1. Summary

**Task Model Advisor** is a VS Code extension that helps the user pick the best **model**, **context window**, and **thinking effort** for a given task at the **start of a conversation** (or on demand). It does not score prompts in real time and does not block chat submission.

On each invocation, the extension:

1. Asks what kind of task the user wants to perform (preset or free text).
2. Fetches **fresh** benchmark and pricing data from external APIs (Artificial Analysis + Arena-style leaderboards).
3. Lists only models **available in the current editor session** (enterprise Copilot allowlist, Cursor model list, etc.).
4. Ranks candidates and shows the **top 3** recommendations with rationale.
5. Lets the user **Validate** one option to apply settings to the agent when the host API allows; otherwise guides manual selection and copies structured metadata to the clipboard.

---

## 2. Goals and non-goals

### Goals

- **Cost and quota awareness:** Prefer cheaper models when quality is sufficient for the task.
- **Quality when it matters:** Surface higher-reasoning models for specs, test design, and automation scripts when benchmarks support it.
- **Session-accurate recommendations:** Never suggest a model the user cannot select in the current session.
- **Cross-host:** Same extension package installable on VS Code (Copilot) and Cursor.
- **Transparent sourcing:** Show why each recommendation ranks where it does (benchmark indices, Arena category, relative cost).

### Non-goals (v1)

- Real-time analysis while typing in chat or a status bar updated on every keystroke.
- Local-only scoring (regex/token heuristics from the original brief) as the primary engine.
- Prompt blocking or modification via chat hooks.
- Scraping Artificial Analysis or Arena web pages without a documented HTTP API or approved mirror.
- Guaranteeing 100 % automatic application of model/context/thinking on all hosts (best-effort + manual fallback).
- Customizable QuickPick task list (fixed five presets in v1; user personalization in **v2**).
- Automatic SessionStart / chat-hook entry points (**v2**).

---

## 3. User experience

### 3.1 Entry points (v1)

| Trigger | Behavior |
|--------|----------|
| Command palette / `Cmd+Option+R` (`Ctrl+Alt+R` on Windows) | Primary: **Task Model Advisor: Recommend a model for this task** |

SessionStart hooks and other automatic entry points are deferred to **v2** (§14).

### 3.2 Flow

1. **Task selection (QuickPick)**  
   - Écrire une spec  
   - Écrire une user story  
   - Écrire un scénario de test  
   - Écrire un script Python pour automatiser une action  
   - **Autre** → multiline input for a custom task description  

2. **Loading**  
   Progress notification: fetching benchmarks (target: complete within ~3 s on a typical connection; show error if timeout).

3. **Recommendations**  
   QuickPick or Webview listing **exactly three** options (or fewer if fewer than three session models match benchmarks). Each row includes:
   - Model name (as shown in the host UI)
   - Suggested context window tier (Standard / Medium / High — mapped to host labels)
   - Suggested thinking effort (Off / Low / Medium / High — mapped to host labels)
   - Short rationale (task fit, Arena category rank if matched, relative cost from Artificial Analysis)
   - Match-quality badge (see §3.4)

4. **Actions**  
   - **Validate this option** — run Apply adapter (§6)  
   - **Copy configuration** — JSON to clipboard  
   - **Refresh benchmarks** — repeat network fetch and re-rank  

### 3.3 Validate semantics

**Validate** means: apply everything the host exposes programmatically; if any field cannot be set, show a focused notification with the three parameters to set manually and keep clipboard populated.

The user remains in control; the extension does not send prompts to an LLM for routing decisions in v1.

### 3.4 Match-quality badges

Each recommendation row may show a badge that describes **how confidently** the session model was linked to benchmark data (Artificial Analysis / Arena). These are UI labels only; they do not change the Apply flow.

| Badge | Meaning |
|-------|---------|
| **Matched** | The session model was mapped to a benchmark row with high confidence (alias exact, or fuzzy score ≥ threshold). Rank uses full AA + Arena scores. |
| **Weak match** | The model is available in the session, but no solid benchmark mapping (name too different, missing from AA/Arena). Shown only as filler when fewer than three strong matches exist; rank is heuristic / name-based, not benchmark-backed. |
| **Enterprise** | Optional hint that the host display name looks like a corporate/allowlisted variant (e.g. `…-enterprise`, org-prefixed id). Ranking still uses the aliased public benchmark sibling when an alias exists; the badge warns the user that the label in Copilot/Cursor may differ from public brand names. |

Example: Copilot shows `GPT-4o (entreprise)`. Alias maps it to AA slug `gpt-4o` → badge **Matched** (+ optionally **Enterprise**). If no alias and fuzzy match fails → may appear as **Weak match** if needed to fill the top 3.

---

## 4. Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                     VS Code Extension (TypeScript)               │
├─────────────────────────────────────────────────────────────────┤
│  TaskPicker          HostModelDiscovery    BenchmarkFetcher      │
│  (presets + custom)  (session models)      (AA + Arena parallel) │
│         │                    │                      │            │
│         └────────────────────┴──────────┬───────────┘            │
│                                         ▼                        │
│                              ModelMatcher (aliases + fuzzy)      │
│                                         ▼                        │
│                              TaskRanker → Top 3                  │
│                                         ▼                        │
│                              RecommendationUI                    │
│                                         ▼                        │
│                              ApplyAdapter (host-specific)        │
└─────────────────────────────────────────────────────────────────┘
          │                                    │
          ▼                                    ▼
   vscode.lm.selectChatModels()         HTTPS (on invoke only)
   vscode.commands.* (best-effort)      Artificial Analysis API
                                        Arena leaderboard mirror
```

### 4.1 Modules

| Module | Responsibility |
|--------|----------------|
| `task-picker` | QuickPick presets + custom text |
| `host-model-discovery` | Enumerate chat models for current host |
| `providers/artificial-analysis` | Fetch and normalize model list + evaluations + pricing |
| `providers/arena` | Fetch category leaderboard (Elo-style scores) |
| `model-matcher` | Map host model IDs/names to benchmark records |
| `task-ranker` | Composite score + top-3 selection |
| `recommendation-ui` | QuickPick/Webview + clipboard |
| `apply-adapter` | VS Code vs Cursor apply strategies |

All ranking and matching run **locally** after fetch. No user prompt content is sent to third parties except what the user typed for **Autre** (used only locally for keyword-based profile selection unless future versions add optional cloud classification).

---

## 5. External data (invocation-time fetch — option B)

### 5.1 Artificial Analysis

- **API:** Documented Data API (e.g. `GET /api/v2/language/models` or documented free-tier list endpoint per current docs).
- **Auth:** User-supplied API key in settings (`taskModelAdvisor.artificialAnalysis.apiKey`).
- **Usage:** One list fetch per recommendation invocation (minimize calls for free-tier daily limits, e.g. 100/day).
- **Fields used:** Model identity (name, slug, creator), capability indices (intelligence, coding, etc.), pricing (blended / input / output), optional context window when available on tier.

### 5.2 Arena (LMSYS / lmarena)

- Arena does not publish a stable official public API in all environments.
- **v1 strategy:** Configurable provider defaulting to a **documented third-party mirror** (e.g. community JSON API that snapshots arena.ai leaderboards), with category parameter.
- **Failure:** If Arena fetch fails, rank using Artificial Analysis only and show a non-blocking warning in the UI.

### 5.3 Network and privacy

- Network calls occur **only** when the user runs the recommend command (or Refresh).
- No telemetry of prompt text to extension author servers in v1.
- Corporate proxies: surface clear errors; user may need to configure VS Code proxy settings.

---

## 6. Session model discovery and matching

### 6.1 Discovery

- Call `vscode.lm.selectChatModels()` (empty or broad selector) during user-initiated command.
- Handle empty list: show message to open chat / sign in to Copilot or Cursor and retry.
- Cache discovery result for the duration of the command (not across invocations).

### 6.2 Matching benchmark rows to session models

1. Normalize strings (lowercase, strip version suffixes, remove dates).
2. Apply user **aliases** from settings (`taskModelAdvisor.modelAliases`: host id → benchmark slug or canonical name).
3. Fuzzy match on `family`, vendor/creator, and display name (Levenshtein or token overlap; threshold configurable).
4. **Eligible set** = intersection(session models, matched benchmark rows above threshold).
5. If fewer than three eligible models, fill remaining slots with session-only entries marked **Weak match** (rank by name heuristics only, no benchmark score).

### 6.3 Enterprise allowlists

Recommendations are **only** drawn from discovered session models. Benchmark data is used to **order** that set, not to introduce unavailable models.

---

## 7. Task profiles and ranking

### 7.1 Preset → profile

| Preset | Primary AA signals | Arena category (default) | Default context | Default thinking |
|--------|-------------------|---------------------------|-----------------|------------------|
| Écrire une spec | Intelligence index, GDPval / writing-oriented indices | `text` | Medium–High | Medium |
| Écrire une user story | Intelligence (lower weight than spec) | `text` | Standard–Medium | Low–Medium |
| Écrire un scénario de test | Intelligence, structure/IF-oriented indices if present | `hard_prompts` or closest available | Medium | Medium |
| Script Python (automation) | **Coding index**, LiveCodeBench | `coding` | Standard (raise if user indicates large codebase in custom text) | Medium |
| Autre | Keyword classifier → nearest preset profile | Same as inferred profile | Medium | Medium |

For **Autre**, a lightweight local keyword map (French + English) selects the nearest profile; no LLM call in v1.

### 7.2 Composite score

For each eligible session model \(M\):

\[
\text{score}(M) = w_t \cdot \text{taskFit}(M) + w_a \cdot \text{arenaNorm}(M) + w_c \cdot \text{costEfficiency}(M)
\]

- **taskFit:** Normalized weighted sum of relevant AA indices for the active profile (0 if no match).
- **arenaNorm:** Normalized Elo (or rank-derived score) in the profile’s Arena category (0 if unmatched).
- **costEfficiency:** Inverse of blended price per million tokens (higher = cheaper is better), normalized across eligible set.

Default weights: `taskFit: 0.5`, `arena: 0.3`, `cost: 0.2` (user-configurable).

### 7.3 Thinking and context overrides

After ranking, adjust thinking **up** one level if the selected model’s id/family indicates a dedicated reasoning line (e.g. o-series, extended thinking brands — maintain a configurable pattern list).

Context suggestion remains heuristic (not from AA) unless context window field is present on the matched benchmark row, in which case cap suggestion to `min(heuristic, model max)`.

### 7.4 Output

- Sort descending by `score`.
- Take top 3 distinct models.
- Attach human-readable **why** string per row (top 2 contributing factors).

---

## 8. Apply adapter (Validate)

### 8.1 Order of attempts

1. Host-specific documented or discovered commands to set chat model (if any succeed in testing for Copilot/Cursor versions targeted).
2. Workspace/user settings keys only if documented and safe for the host.
3. Fallback: notification + clipboard JSON:

```json
{
  "model": "<display name>",
  "modelId": "<host id if known>",
  "contextWindow": "64k",
  "thinkingEffort": "medium",
  "task": "spec",
  "rank": 1,
  "scoreBreakdown": { "taskFit": 0.82, "arena": 0.71, "cost": 0.65 }
}
```

### 8.2 Host matrix (expectations)

| Host | Model selection | Context / thinking |
|------|-----------------|---------------------|
| VS Code + Copilot | Best-effort via commands/API; may be partial | Often manual; UI lists exact values to pick |
| Cursor | Best-effort; API surface may differ | Often manual; same clipboard fallback |

v1 acceptance: **Validate** succeeds automatically on at least one target environment in manual test matrix; other environments degrade gracefully without errors.

---

## 9. Configuration schema

```json
{
  "taskModelAdvisor.enabled": true,
  "taskModelAdvisor.artificialAnalysis.apiKey": "",
  "taskModelAdvisor.arena.source": "wulong-mirror",
  "taskModelAdvisor.arena.categories": {
    "spec": "text",
    "userStory": "text",
    "testScenario": "hard_prompts",
    "pythonScript": "coding",
    "other": "text"
  },
  "taskModelAdvisor.ranking.weights": {
    "taskFit": 0.5,
    "arena": 0.3,
    "cost": 0.2
  },
  "taskModelAdvisor.modelAliases": {
    "copilot-gpt-4o-mini-enterprise": "gpt-4o-mini"
  },
  "taskModelAdvisor.matching.fuzzyThreshold": 0.72,
  "taskModelAdvisor.applyStrategy": "auto-then-manual",
  "taskModelAdvisor.fetch.timeoutMs": 8000,
  "taskModelAdvisor.reasoningModelPatterns": ["o1", "o3", "deepseek-r1", "extended"]
}
```

---

## 10. Technical stack

| Area | Choice |
|------|--------|
| Language | TypeScript |
| Extension API | `vscode.commands`, `vscode.window` (QuickPick, progress, notifications), `vscode.lm.selectChatModels` |
| Packaging | Standard VS Code extension (`vsce`), engines compatible with VS Code 1.90+ and Cursor (verify each release) |
| Tests | Unit tests for `model-matcher`, `task-ranker`, profile mapping; fixture JSON for AA/Arena responses |
| Dependencies | Minimal HTTP client (`fetch`); no WASM tokenizer in v1 |

---

## 11. Performance and reliability

| Criterion | Target |
|-----------|--------|
| Time to show recommendations after task selection | ≤ 3 s p95 with warm network; hard timeout `fetch.timeoutMs` (default 8 s) |
| Memory | ≤ 30 MB incremental for extension host during command |
| Offline | Command fails clearly if AA key missing or network unreachable; no silent stale cache in v1 (user chose fresh fetch each invocation) |
| Rate limits | One AA list call per invocation; document daily quota for free tier |

---

## 12. Acceptance criteria

1. User can run the command, pick each of the five task entries, and receive up to three recommendations from **session-available models only**.
2. With a valid AA API key and network, recommendations reflect AA pricing/indices and Arena data when the mirror responds.
3. With Arena unavailable, recommendations still work with warning.
4. **Validate** applies or copies full configuration without throwing.
5. Extension loads on Windows VS Code (Copilot) and macOS Cursor without separate builds.
6. Unit test suite covers ranking and matching with at least 20 fixture cases including enterprise alias scenarios.

---

## 13. Risks and mitigations

| Risk | Mitigation |
|------|------------|
| Copilot/Cursor cannot set model programmatically | Document manual steps; clipboard JSON; iterate Apply adapter per host version |
| Arena mirror downtime or ToS change | Pluggable provider; AA-only fallback |
| AA free tier rate limit | Single batch fetch; user messaging on 429 |
| Fuzzy match wrong model | Aliases + threshold tuning + Weak match badge |
| Work proxy blocks API | Clear error; optional custom API base URL setting (future) |

---

## 14. Version 2 (out of v1 scope)

v1 ships with a **fixed** QuickPick of five task presets (§3.2) and a manual command entry point only.

**v2** adds:

1. **SessionStart hook** (Cursor `.cursor/hooks.json`, Copilot hooks) that suggests running the recommend command when a chat session starts — no automatic ranking, no prompt blocking.
2. **Customizable QuickPick tasks** — the user can personalize the extension:
   - Add / rename / reorder / remove task presets
   - Map each custom task to a ranking profile (AA indices, Arena category, default context & thinking)
   - Persist configuration in `settings.json` (e.g. `taskModelAdvisor.tasks[]`)
   - Keep **Autre** (free text) as a built-in escape hatch
3. Optional cached benchmarks with TTL (hybrid / offline mode).
4. User feedback loop (“this model worked”) to tune weights locally.
5. `@router` chat participant for in-chat reruns.
6. Proposed VS Code chat hooks for non-blocking pre-submit hints.

---

## 15. Revision history

| Date | Change |
|------|--------|
| 2026-03-22 | Initial design from brainstorming: shifted from real-time local scoring to task-based benchmark routing; session-only models; invocation-time fetch; top 3 + Validate. |
| 2026-03-22 | Clarified match-quality badges (§3.4); moved SessionStart + customizable QuickPick to explicit **v2** (§14); removed “Optional v1.1”. |
| 2026-03-22 | Renamed product/repo to **Task Model Advisor** / `task-model-advisor` (avoid Marketplace clash with Prompt Router). |
