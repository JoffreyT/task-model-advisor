# Dedupe session models by display name

**Status:** Approved in chat  
**Date:** 2026-10-11

## Summary

At work, Cursor's language-model API returns the same model twice under the same display name and different internal ids. The recommendation list then shows that name twice.

`vscode.lm.selectChatModels()` is the path used inside the editor, and it currently returns every entry as-is. The CLI and HTTP fallbacks already collapse entries that share an id. This change collapses entries that share a display name, on every discovery path, before matching and ranking.

Variants whose display names differ (`Grok 4.7` and `Grok 4.7 High Fast`) stay separate.

## Behavior

`discoverSessionModels` runs `dedupeSessionModels` on the list it is about to return, including the `vscode.lm` list and the Cursor CLI or API list. An empty list stays empty.

The dedupe key is the display name, trimmed, then lowercased. A blank name uses the trimmed, lowercased id instead, so unnamed entries do not all collapse together. An entry whose name and id are both blank is dropped.

Entries that share a key become one entry:

1. Prefer an id that contains no whitespace. That is the Cursor slug (`claude-4.5-sonnet`), which apply tries first.
2. When several ids have no whitespace, keep the earliest one.
3. When every id contains whitespace, keep the earliest entry.

The survivor keeps its own `id`, `name`, `family`, and `vendor`. Fields are not merged across duplicates. The survivor stays in the position of the first entry of its group, so the rest of the list order is unchanged.

Only surrounding whitespace is stripped. Internal spaces stay, so `Claude  Sonnet` and `Claude Sonnet` remain two models. Case does not, so `Claude Sonnet 4.5` and `claude sonnet 4.5` become one.

## Shape

- `dedupeSessionModels` is a pure function in `src/host/dedupe-session-models.ts`. It does not import `vscode`, so tests call it directly.
- `discoverSessionModels` is the only caller. CLI id-dedupe in `parseAgentModelsOutput` stays as it is.

## Tests

- Two entries named `Claude Sonnet 4.5` with ids `Claude Sonnet 4.5` and `claude-4.5-sonnet` become one entry, and the slug id is kept.
- Two slug ids with the same name keep the first slug.
- `Grok 4.7` and `Grok 4.7 High Fast` both remain.
- A blank name is keyed by id. Two blank names with different ids both remain. An entry with a blank name and a blank id is dropped.
- Relative order of distinct names is preserved.

## Out of scope

- Fuzzy matching of different labels.
- Collapsing Fast, High, or Thinking variants.
- Changes to ranking, matching thresholds, or apply probes.
