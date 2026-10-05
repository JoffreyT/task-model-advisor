import { describe, expect, it } from "vitest";
import { parseAgentModelsOutput } from "../host/cursor-model-discovery";

describe("parseAgentModelsOutput", () => {
  it("parses id - display name rows and plain labels", () => {
    const stdout = `
Loading models…
Auto
grok-4.7 - Grok 4.7 High Fast
composer-2.5 - Composer 2.5
Claude Opus 5.5 Medium
`;
    const models = parseAgentModelsOutput(stdout);
    expect(models.map((m) => m.id)).toEqual([
      "Auto",
      "grok-4.7",
      "composer-2.5",
      "Claude Opus 5.5 Medium",
    ]);
    expect(models[1]?.name).toBe("Grok 4.7 High Fast");
    expect(models[1]?.vendor).toBe("cursor");
  });

  it("skips auth / empty messages", () => {
    expect(
      parseAgentModelsOutput("Authentication required\nNot logged in\n")
    ).toEqual([]);
    expect(parseAgentModelsOutput("No models available for this account.")).toEqual(
      []
    );
  });

  it("dedupes by id case-insensitively", () => {
    const models = parseAgentModelsOutput("Composer 2.5\ncomposer 2.5\n");
    expect(models).toHaveLength(1);
  });
});
