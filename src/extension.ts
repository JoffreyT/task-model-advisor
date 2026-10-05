import * as vscode from "vscode";
import { runRecommendCommand } from "./commands/recommend";

export function activate(context: vscode.ExtensionContext): void {
  const disposable = vscode.commands.registerCommand("taskModelAdvisor.recommend", () =>
    runRecommendCommand()
  );
  context.subscriptions.push(disposable);
}

export function deactivate(): void {}
