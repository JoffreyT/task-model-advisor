import { describe, expect, it, vi } from "vitest";

vi.mock("vscode", () => ({
  lm: { selectChatModels: vi.fn() },
  env: { appName: "Cursor" },
}));

import * as vscode from "vscode";
import { discoverSessionModels } from "../host/model-discovery";

describe("discoverSessionModels", () => {
  it("dedupes vscode.lm models that share a display name", async () => {
    vi.mocked(vscode.lm.selectChatModels).mockResolvedValue([
      { id: "Claude Sonnet 4.5", name: "Claude Sonnet 4.5", vendor: "a", family: "display" },
      { id: "claude-4.5-sonnet", name: "Claude Sonnet 4.5", vendor: "cursor", family: "slug" },
    ] as Awaited<ReturnType<typeof vscode.lm.selectChatModels>>);

    const result = await discoverSessionModels();

    expect(result.models).toEqual([
      {
        id: "claude-4.5-sonnet",
        name: "Claude Sonnet 4.5",
        vendor: "cursor",
        family: "slug",
      },
    ]);
    expect(result.warnings).toEqual([]);
  });
});
