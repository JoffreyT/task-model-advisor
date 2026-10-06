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
