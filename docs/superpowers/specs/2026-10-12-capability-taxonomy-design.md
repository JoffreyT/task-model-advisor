# Capability taxonomy + complexity (ranking v2)

**Status:** Implemented with plan 2026-10-12  
**Date:** 2026-10-12

## Summary

Replace nine technical task presets and five ranking engines with **seven capability categories** and a **four-level complexity** dimension. Scoring uses two normalized pillars blended 70/30: category fit (benchmarks + Arena) and complexity adjustment (cost vs capability).

## User flow

1. QuickPick: task category (7 rows, emojis in labels).
2. QuickPick: complexity (Basic → Expert).
3. No « Autre » / free-text classifier in the recommend path.

## Types

- `TaskCategoryId`: `quickCheap` | `analysisDoc` | `development` | `testingReview` | `debugging` | `architectureDesign` | `autonomousAgent`
- `ComplexityLevel`: `basic` | `intermediate` | `advanced` | `expert`

Clipboard JSON: `category`, `complexity` (replaces `task` preset id and `engine`).

## Arena categories

| TaskCategoryId     | Arena category |
| ------------------ | -------------- |
| quickCheap         | text           |
| analysisDoc        | text           |
| development        | coding         |
| testingReview      | hard_prompts   |
| debugging          | coding         |
| architectureDesign | hard_prompts   |
| autonomousAgent    | coding         |

## Category benchmark blends (`rawCategoryFit`)

| Category           | Signals                                                                                     |
| ------------------ | ------------------------------------------------------------------------------------------- |
| quickCheap         | 60% intelligence, 40% inverted cost proxy via intelligence-only (cost in complexity pillar) |
| analysisDoc        | intelligence + GDPval/writing                                                               |
| development        | coding + LiveCodeBench                                                                      |
| testingReview      | 50% coding, 50% intelligence                                                                |
| debugging          | 40% coding, 35% intelligence, 25% SWE-like eval keys                                        |
| architectureDesign | 55% intelligence, 45% coding                                                                |
| autonomousAgent    | 45% agentic index, 35% coding, 20% SWE-like                                                 |

Arena is folded into the category pillar: `0.80 * capabilityBlend + 0.20 * arenaNorm` before session min-max.

## Complexity pillar (`rawComplexityFit`)

Uses `absoluteCostScore(price)` when price known, plus `rawCapabilityBlend` (intelligence, coding, agentic, SWE-like).

| Complexity   | cost weight | capability weight |
| ------------ | ----------- | ----------------- |
| basic        | 0.75        | 0.25              |
| intermediate | 0.40        | 0.60              |
| advanced     | 0.15        | 0.85              |
| expert       | 0.05        | 0.95              |

## Final score

`CATEGORY_SCORE_WEIGHT = 0.70`, `COMPLEXITY_SCORE_WEIGHT = 0.30`

Per matched model: min-max normalize category raw and complexity raw across session, then blend.

`Recommendation.breakdown`: `{ categoryFit, complexityFit, arena, cost }` — arena/cost retained for UI explanations; primary score uses the 70/30 blend of categoryFit and complexityFit.

## Context / thinking defaults

Derived from `resolveCategoryDefaults(categoryId, complexity)` — higher complexity and architecture/autonomous categories bump context and thinking.

## quickCheap category pillar

Uses intelligence-only capability (no coding/agentic); complexity basic strongly favors cost.
