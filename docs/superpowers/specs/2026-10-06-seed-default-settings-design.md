# Seed default settings on first launch

**Status:** Approved in chat  
**Date:** 2026-10-06

## Summary

On activation, Task Model Advisor writes every `taskModelAdvisor.*` setting that is still unset into User settings, using the default already declared in `package.json`.

The extension already applies those defaults at runtime through `contributes.configuration`. This change makes them visible and editable in `settings.json` on a new machine.

## Behavior

Activation uses `onStartupFinished` so seeding runs when the editor finishes starting. The recommend command still activates the extension because VS Code generates `onCommand:taskModelAdvisor.recommend` from `contributes.commands`.

On `activate`, after the recommend command is registered:

1. Read the `taskModelAdvisor` configuration section.
2. For each contributed key, call `inspect`.
3. Write the key to User settings (`ConfigurationTarget.Global`) only when all of the following are true:
   - `globalValue` is `undefined`
   - `workspaceValue` is `undefined`
   - `workspaceFolderValue` is `undefined`
   - `defaultValue` is defined
4. The written value is `defaultValue` from `inspect`, which is the `package.json` default. The seeder does not hard-code a second copy of the defaults.
5. Keys the user or the workspace already set are left unchanged.
6. A failed `update` is reported with `console.error` and does not prevent activation or the other keys from being seeded. No notification is shown.

Keys covered, without the `taskModelAdvisor.` prefix:

- `artificialAnalysis.apiKey`
- `cursor.apiKey`

Arena source, categories, ranking weights, model aliases, fuzzy threshold, apply strategy, fetch timeout, and reasoning-model patterns live in `src/constants.ts`. They are not settings. There is no `enabled` setting: the editor activates the extension.

Empty API keys are written as `""`. The user still fills them in.

Language-specific overrides are ignored. A key counts as set only in the global, workspace, or workspace-folder scope.

If the user later deletes a key, the next activation writes the current package default again.

Once a key is written, it is a user value. A later extension release that changes the package default does not overwrite it.

## Shape

- `SETTING_KEYS` lists the keys above.
- `shouldSeedSetting` is a pure predicate over an inspection result. Tests cover it without the VS Code API.
- `seedUnsetUserSettings` performs the writes. `activate` calls it and swallows failures so command registration stays independent.
- A test reads `package.json` and fails if `contributes.configuration.properties` and `SETTING_KEYS` diverge.

## Out of scope

- Prompting the user before writing.
- Writing into workspace settings.
- Migrating or resetting values that are already set.
- A one-shot flag in `globalState`. Absence of a value is the signal to seed.
