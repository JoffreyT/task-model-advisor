# Configurable recommendation count

**Status:** Approved in chat  
**Date:** 2026-10-11

## Summary

The number of models shown after a task pick is a VS Code setting, `taskModelAdvisor.recommendationCount`. The allowed range is the integers 3 through 5. The default is 3.

The current top 3, including the cheaper-alternative slot from `diversifyTop3`, stays the head of the list. A higher setting appends the next models by score.

## Setting

`package.json` contributes:

- key: `taskModelAdvisor.recommendationCount`
- type: `number`
- minimum: 3
- maximum: 5
- default: 3
- description: `Number of model recommendations to show (3–5).`

`recommendationCount` is added to `SETTING_KEYS`, so first launch seeds it like the other contributed settings.

`AdvisorConfig` gains `recommendationCount: number`.

`resolveConfig` accepts the raw value only when it is an integer from 3 to 5. A missing value, a non-integer (`3.5`, `"4"`), or an out-of-range value (`2`, `6`) becomes 3. The settings UI also constrains the spinner; this clamp covers a hand-edited `settings.json`.

`loadAdvisorConfig` reads `recommendationCount` from the `taskModelAdvisor` section and passes it to `resolveConfig`.

## Ranking

`RankRecommendationsInput` gains an optional `limit`. `rankRecommendations` uses `limit` when it is an integer from 3 to 5. Otherwise it uses 3. Callers that omit `limit` (existing tests, the eval matrix) keep today's top 3.

Selection:

1. Score and sort as today, including weak matches after matched models.
2. `diversifyTop3` is unchanged and still returns at most three models. The best model stays first. One cheaper matched alternative is inserted when the list is longer than three and such an alternative exists. Order among those three stays score-descending.
3. When the effective limit is 3, that list is the result.
4. When the effective limit is greater than 3, append models from the full ranked list that are not already selected, in that list's order, until the result length reaches the limit or the ranked list runs out.
5. When fewer models exist than the limit, return every ranked model.

A model dropped from the diversified top 3 in favor of the cheaper alternative can reappear at position 4 or later. Positions 1–3 for a given task stay the same whether the limit is 3 or 5.

## Command and UI

`runRecommendCommand` passes `config.recommendationCount` as `limit`. `showRecommendations` already renders the list it receives. No QuickPick or copy change.

## Tests

- `resolveConfig`: empty input yields 3; 3, 4, and 5 are kept; 2, 6, 3.5, and `"4"` become 3.
- Ranker, `limit` omitted: existing top-3 assertions still hold.
- Ranker, `limit: 5`, with more than three candidates: the first three session-model ids match the default call; later ids are the next ranked models not already chosen; length is `min(5, ranked length)`.
- Eval matrix stays at most 3 because it does not pass `limit`.
- `SETTING_KEYS` stays aligned with `package.json` configuration properties.

## Out of scope

- Asking for the count on each command run.
- Changing the `diversifyTop3` rule.
- Translated setting descriptions (existing setting copy is English in `package.json`).
- A per-task count.
