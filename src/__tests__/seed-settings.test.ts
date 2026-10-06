import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it, vi } from "vitest";
import {
  SETTING_KEYS,
  seedUnsetUserSettings,
  shouldSeedSetting,
  type SettingInspection,
} from "../seed-settings";

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
