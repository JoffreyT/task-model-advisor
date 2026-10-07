# Public task presets (labels → ranking engines)

**Status:** Approved in chat  
**Date:** 2026-10-07  
**Audience:** Marketplace v1 — Cursor / VS Code generalist, with a light product/writing tilt

## Summary

Replace the current five personal presets (`spec`, `userStory`, `testScenario`, `pythonScript`, `other`) with a public-facing QuickPick of **8 task labels + Autre**, while ranking through a smaller set of **5 ranking engines**. Labels capture what the user wants to do; engines capture what actually changes score, Arena category, cost tilt, and context/thinking defaults.

This keeps the QuickPick recognizable without inventing a distinct scoring formula for every deliverable type.

## Goals

- Speak to everyday coding workflows (implement, debug, refactor, review).
- Keep two writing-oriented entries the author already uses (spec/doc, user story).
- Differentiable recommendations: two labels that share an engine may show the same ranking order; that is acceptable and preferred over fake differentiation.
- Stay under 10 QuickPick rows including Autre.
- Preserve the existing pipeline: pick → fetch → match → rank → show top 3.

## Non-goals

- Two-level QuickPick (category then subtype).
- User-customizable preset list (still deferred).
- LLM-based task classification (Autre stays keyword/regex → engine).
- Changing match logic (session ↔ benchmark) or data providers.
- Publishing / Marketplace listing copy (separate from this change).

## Approach

**Labels rich → few ranking engines.**

- `TaskPresetId`: id of a QuickPick row (stable string for i18n and clipboard metadata).
- `RankingEngineId`: id consumed by `task-ranker`, Arena category lookup, and weight resolution.
- Each preset maps to exactly one engine via a static table.
- Ranking APIs take `RankingEngineId` (or resolve preset → engine once at the start of `runRecommendCommand`). Clipboard / UI may still record the human preset id so “Validate” metadata stays meaningful.

### Why not 1:1 preset = profile

Several current profiles already collapse to nearly the same signals (`spec` / `userStory` / writing-like `other`). Expanding the list 1:1 would multiply dead weight and make `eval:ranking` noise without improving recommendations.

## QuickPick list

Order is intentional: coding first, writing mid-list, cheap near the end, Autre last.

| Order | Preset id    | Label (FR)                            | Label (EN)                   | Engine                               |
| ----: | ------------ | ------------------------------------- | ---------------------------- | ------------------------------------ |
|     1 | `writeCode`  | Écrire / modifier du code             | Write / edit code            | `coding`                             |
|     2 | `debug`      | Déboguer / expliquer un bug           | Debug / explain a bug        | `reasoning`                          |
|     3 | `refactor`   | Refactorer / restructurer             | Refactor / restructure       | `coding`                             |
|     4 | `codeReview` | Revue de code / trouver des problèmes | Review code / find issues    | `reasoning`                          |
|     5 | `spec`       | Écrire une spec / doc technique       | Write a spec / technical doc | `writing`                            |
|     6 | `userStory`  | Écrire une user story                 | Write a user story           | `writing`                            |
|     7 | `tests`      | Écrire des tests / scénarios          | Write tests / scenarios      | `reasoning`                          |
|     8 | `cheap`      | Tâche rapide / modèle pas cher        | Quick task / cheaper model   | `cheap`                              |
|     9 | `other`      | Autre…                                | Other…                       | classifier → engine, else `balanced` |

Removed as a dedicated row: `pythonScript` (covered by `writeCode` + Autre keywords).

`tests` uses `reasoning` (not `coding`) so hard-prompt / intelligence signals dominate; LiveCodeBench stays reserved for the `coding` engine.

## Ranking engines

| Engine      | taskFit raw signal                                                                 | Arena category                            | Weight tilt vs base `0.45 / 0.25 / 0.30`                                      | Default context | Default thinking |
| ----------- | ---------------------------------------------------------------------------------- | ----------------------------------------- | ----------------------------------------------------------------------------- | --------------- | ---------------- |
| `coding`    | coding × 0.7 + LiveCodeBench × 0.3 (same fallback rules as today’s `pythonScript`) | `coding`                                  | cost +0.05, arena −0.05 (clamp arena ≥ 0.15)                                  | `standard`      | `medium`         |
| `reasoning` | intelligence index                                                                 | `hard_prompts` (fallback chain unchanged) | base weights                                                                  | `medium`        | `medium`         |
| `writing`   | mean(intelligence, GDPval/writing) when present, else intelligence                 | `text`                                    | taskFit +0.05, cost −0.05 (clamp cost ≥ 0.15)                                 | `high`          | `medium`         |
| `cheap`     | intelligence index                                                                 | `text`                                    | cost +0.15, taskFit −0.10, arena −0.05 (clamps: taskFit ≥ 0.25, arena ≥ 0.15) | `standard`      | `low`            |
| `balanced`  | intelligence index                                                                 | `text`                                    | base weights                                                                  | `medium`        | `medium`         |

Existing behaviors that stay:

- Context capped by real model context tokens; bumped one tier when custom text matches codebase / repo / monorepo / multi-fichier / large / gros.
- Thinking bumped one level for reasoning-model name patterns (`REASONING_MODEL_PATTERNS`).
- Weak matches appended after matched; `diversifyTop3` unchanged.

## Autre classifier

`classifyOther(text)` returns a `RankingEngineId` (not a legacy preset id).

Suggested keyword groups (FR + EN):

| Engine      | Example patterns                                                                                            |
| ----------- | ----------------------------------------------------------------------------------------------------------- |
| `coding`    | code, implement, implementer, python, script, refactor, API, function, bugfix (when paired with “fix/impl”) |
| `reasoning` | debug, bug, explain, pourquoi, why, review, revue, test, gherkin, scénario, scenario                        |
| `writing`   | spec, spéc, documentation, doc, user story, histoire utilisateur, cahier des charges, ADR                   |
| `cheap`     | quick, rapide, cheap, pas cher, simple, draft, brouillon                                                    |
| else        | `balanced`                                                                                                  |

First matching rule wins; order of rules in code should prefer more specific engines before `writing`/`coding` catch-alls if patterns overlap. Exact regex list is an implementation detail covered by unit tests.

Empty input → `balanced`.

## Type and module shape

- Replace `TaskProfileId` with:
  - `TaskPresetId` — union of the nine preset ids above.
  - `RankingEngineId` — `"coding" | "reasoning" | "writing" | "cheap" | "balanced"`.
- `TASK_PRESETS`: ordered list of `{ id: TaskPresetId }` (Autre last).
- `PRESET_ENGINE: Record<Exclude<TaskPresetId, "other">, RankingEngineId>`.
- `ARENA_CATEGORIES: Record<RankingEngineId, string>`.
- Ranker functions (`rawTaskFit`, `profileDefaults`, `resolveProfileWeights`, `rankRecommendations`) key off `RankingEngineId`.
- i18n `presets` keys follow `TaskPresetId`.
- Clipboard JSON: write `task` as the **preset** id (what the user picked) and `engine` as the resolved `RankingEngineId`.

## Migration / compatibility

- No persisted user setting stores profile ids today → no settings migration.
- Tests, eval fixtures, and CONTRIBUTING ranking tables must be updated to engines + new presets.
- `npm run eval:ranking` runs every **engine** (not every preset), plus a smoke that each preset resolves to an engine and Autre classification samples map as expected.
- Breaking change for anyone scripting against old clipboard `task` values (`pythonScript`, `testScenario`); acceptable pre-Marketplace; document in CONTRIBUTING / changelog when publishing.

## Testing

- Unit: preset → engine map completeness; classifier cases (including former python / gherkin / user story phrases); ranker weight and taskFit switches per engine; eval matrix expectations rewritten for engines.
- Manual: QuickPick shows 9 rows in FR and EN; picking each non-Autre preset returns a top 3; Autre free text routes sensibly.

## Out of scope

- Changing Artificial Analysis or Arena fetch behavior.
- Customizable presets / user overrides.
- Visual redesign of the recommendation popup beyond new labels.
