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
