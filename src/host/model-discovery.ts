import * as vscode from "vscode";
import type { SessionModel } from "../types";

export async function discoverSessionModels(): Promise<SessionModel[]> {
  const models = await vscode.lm.selectChatModels();
  return models.map((m) => ({
    id: m.id,
    name: m.name,
    family: m.family,
    vendor: m.vendor,
  }));
}
