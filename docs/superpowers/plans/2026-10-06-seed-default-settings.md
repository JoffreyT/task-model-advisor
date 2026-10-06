# Seed Default Settings Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** On activation, write every unset `taskModelAdvisor.*` setting into User settings using the `package.json` default.

**Architecture:** A VS Code-free module owns the key list, the "is this unset?" predicate, and the seed loop. `activate` passes the live configuration section and `ConfigurationTarget.Global`. Defaults are read from `inspect().defaultValue`, so `package.json` stays the only copy.

**Tech Stack:** TypeScript, VS Code Extension API (`engines.vscode` ^1.90.0), Vitest.

## Global Constraints

- Write a key only when `globalValue`, `workspaceValue`, and `workspaceFolderValue` are all `undefined` and `defaultValue` is defined.
- The written value is `inspect().defaultValue`. Do not hard-code a second copy of the defaults.
- Keys already set in user, workspace, or workspace-folder scope stay unchanged.
- A failed `update` is reported with `console.error` and does not prevent activation or the other keys from being seeded. No notification is shown.
- Empty API keys are written as `""`.
- Language-specific overrides are ignored. A key counts as set only in the global, workspace, or workspace-folder scope.
- If the user later deletes a key, the next activation writes the current package default again.
- Once a key is written, a later extension release that changes the package default does not overwrite it.
- No prompt before writing. No workspace-settings write. No migration of existing values. No `globalState` flag.
- Commits: optional — repository owner commits manually; skip git commit steps unless explicitly asked.
- Only the two API keys are user settings (`artificialAnalysis.apiKey`, `cursor.apiKey`). Arena source, categories, ranking weights, aliases, fuzzy threshold, apply strategy, fetch timeout, and reasoning patterns are constants in `src/constants.ts`, so they are neither contributed nor seeded.
- Spec source of truth: `docs/superpowers/specs/2026-10-06-seed-default-settings-design.md`.

## File structure

- Create: `src/seed-settings.ts` — key list, `shouldSeedSetting`, `seedUnsetUserSettings`. No `vscode` import, so Vitest can load it.
- Create: `src/__tests__/seed-settings.test.ts` — predicate, package.json parity, fake section.
- Modify: `src/extension.ts` — call the seeder after the command is registered.

---

### Task 1: Seeding predicate and key list

**Files:**

- Create: `src/seed-settings.ts`
- Test: `src/__tests__/seed-settings.test.ts`

**Interfaces:**

- Consumes: `package.json` `contributes.configuration.properties` keys under `taskModelAdvisor.`
- Produces:
  - `SETTING_KEYS: readonly string[]`
  - `SettingInspection` with optional `globalValue`, `workspaceValue`, `workspaceFolderValue`, `defaultValue` (`unknown`)
  - `shouldSeedSetting(inspected: SettingInspection | undefined): boolean`

- [ ] **Step 1: Write the failing test**

Create `src/__tests__/seed-settings.test.ts`:

```typescript
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { SETTING_KEYS, shouldSeedSetting, type SettingInspection } from "../seed-settings";

describe("SETTING_KEYS", () => {
  it("matches package.json configuration properties", () => {
    const pkg = JSON.parse(readFileSync(resolve(process.cwd(), "package.json"), "utf8")) as {
      contributes: { configuration: { properties: Record<string, unknown> } };
    };
    const fromPackage = Object.keys(pkg.contributes.configuration.properties)
      .map((key) => key.replace(/^taskModelAdvisor\./, ""))
      .sort();

    expect([...SETTING_KEYS].sort()).toEqual(fromPackage);
  });
});

describe("shouldSeedSetting", () => {
  it("seeds when no scope is set and a default exists", () => {
    expect(shouldSeedSetting({ defaultValue: true })).toBe(true);
  });

  it("seeds a defined default even when it is empty, false, or zero", () => {
    expect(shouldSeedSetting({ defaultValue: "" })).toBe(true);
    expect(shouldSeedSetting({ defaultValue: false })).toBe(true);
    expect(shouldSeedSetting({ defaultValue: 0 })).toBe(true);
  });

  it("does not seed when any scope already has a value", () => {
    expect(shouldSeedSetting({ globalValue: true, defaultValue: false })).toBe(false);
    expect(shouldSeedSetting({ workspaceValue: "x", defaultValue: "y" })).toBe(false);
    expect(shouldSeedSetting({ workspaceFolderValue: 1, defaultValue: 2 })).toBe(false);
  });

  it("treats an explicit false as already set", () => {
    expect(shouldSeedSetting({ globalValue: false, defaultValue: true })).toBe(false);
  });

  it("does not seed when there is no package default", () => {
    expect(shouldSeedSetting({})).toBe(false);
    expect(shouldSeedSetting(undefined)).toBe(false);
  });

  it("ignores language-specific values", () => {
    const inspected = {
      defaultValue: "",
      globalLanguageValue: "secret",
    } as SettingInspection;

    expect(shouldSeedSetting(inspected)).toBe(true);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/__tests__/seed-settings.test.ts`

Expected: FAIL because `../seed-settings` cannot be resolved.

- [ ] **Step 3: Write the minimal implementation**

Create `src/seed-settings.ts`:

```typescript
export interface SettingInspection {
  globalValue?: unknown;
  workspaceValue?: unknown;
  workspaceFolderValue?: unknown;
  defaultValue?: unknown;
}

export const SETTING_KEYS = ["artificialAnalysis.apiKey", "cursor.apiKey"] as const;

export function shouldSeedSetting(inspected: SettingInspection | undefined): boolean {
  if (!inspected) {
    return false;
  }
  return (
    inspected.globalValue === undefined &&
    inspected.workspaceValue === undefined &&
    inspected.workspaceFolderValue === undefined &&
    inspected.defaultValue !== undefined
  );
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/__tests__/seed-settings.test.ts`

Expected: PASS (7 tests).

---

### Task 2: Seed unset user settings on activation

**Files:**

- Modify: `src/seed-settings.ts`
- Modify: `src/__tests__/seed-settings.test.ts`
- Modify: `src/extension.ts`

**Interfaces:**

- Consumes: `SETTING_KEYS`, `shouldSeedSetting`, `SettingInspection` from Task 1
- Produces: `seedUnsetUserSettings(section: SettingsSection, target: number): Promise<void>`
  - `SettingsSection.inspect(key: string): SettingInspection | undefined`
  - `SettingsSection.update(key: string, value: unknown, target: number): Thenable<void>`

- [ ] **Step 1: Write the failing test**

Append to `src/__tests__/seed-settings.test.ts`. Add `vi` to the vitest import:

```typescript
import { describe, expect, it, vi } from "vitest";
```

Add `seedUnsetUserSettings` to the seed-settings import:

```typescript
import {
  SETTING_KEYS,
  seedUnsetUserSettings,
  shouldSeedSetting,
  type SettingInspection,
} from "../seed-settings";
```

Append this describe block:

```typescript
describe("seedUnsetUserSettings", () => {
  it("writes only unset keys and continues after a failed update", async () => {
    const error = new Error("read only");
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    const updates: Array<{ key: string; value: unknown; target: number }> = [];
    const section = {
      inspect(key: string): SettingInspection | undefined {
        if (key === "artificialAnalysis.apiKey") {
          return { defaultValue: "" };
        }
        if (key === "cursor.apiKey") {
          return { defaultValue: "" };
        }
        return { globalValue: "set", defaultValue: "set" };
      },
      update(key: string, value: unknown, target: number): Promise<void> {
        if (key === "artificialAnalysis.apiKey") {
          return Promise.reject(error);
        }
        updates.push({ key, value, target });
        return Promise.resolve();
      },
    };

    await seedUnsetUserSettings(section, 1);

    expect(updates).toEqual([{ key: "cursor.apiKey", value: "", target: 1 }]);
    expect(consoleError).toHaveBeenCalledWith(
      'taskModelAdvisor: failed to seed setting "artificialAnalysis.apiKey"',
      error
    );
    consoleError.mockRestore();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/__tests__/seed-settings.test.ts`

Expected: FAIL because `seedUnsetUserSettings` is not exported.

- [ ] **Step 3: Write the seeder**

Append to `src/seed-settings.ts`:

```typescript
export interface SettingsSection {
  inspect(key: string): SettingInspection | undefined;
  update(key: string, value: unknown, target: number): Thenable<void>;
}

export async function seedUnsetUserSettings(
  section: SettingsSection,
  target: number
): Promise<void> {
  for (const key of SETTING_KEYS) {
    try {
      const inspected = section.inspect(key);
      if (!inspected || !shouldSeedSetting(inspected)) {
        continue;
      }
      await section.update(key, inspected.defaultValue, target);
    } catch (error) {
      console.error(`taskModelAdvisor: failed to seed setting "${key}"`, error);
    }
  }
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/__tests__/seed-settings.test.ts`

Expected: PASS (8 tests).

- [ ] **Step 5: Call the seeder from activate**

Replace `src/extension.ts` with:

```typescript
import * as vscode from "vscode";
import { runRecommendCommand } from "./commands/recommend";
import { seedUnsetUserSettings, type SettingsSection } from "./seed-settings";

export function activate(context: vscode.ExtensionContext): void {
  const disposable = vscode.commands.registerCommand("taskModelAdvisor.recommend", () =>
    runRecommendCommand()
  );
  context.subscriptions.push(disposable);

  const section = vscode.workspace.getConfiguration("taskModelAdvisor");
  const settings: SettingsSection = {
    inspect: (key) => section.inspect(key),
    update: (key, value, target) =>
      section.update(key, value, target as vscode.ConfigurationTarget),
  };
  void seedUnsetUserSettings(settings, vscode.ConfigurationTarget.Global);
}

export function deactivate(): void {}
```

`ConfigurationTarget.Global` is `1`, the same target the unit test passes. The wrapper keeps `vscode` out of `seed-settings.ts`. Command registration stays above the seed call, and per-key `catch` keeps a failed write from rejecting activation.

- [ ] **Step 6: Run the full test suite and the typecheck**

Run: `npx vitest run`

Expected: PASS

Run: `npx tsc -p . --noEmit`

Expected: exit 0

Run: `npx eslint src --max-warnings 0`

Expected: exit 0
