import { describe, expect, it } from "vitest";
import {
  buildSwitchParams,
  candidateModelIds,
  composerModelConfigArgs,
  contextToMaxMode,
  switchToModelSlugArgs,
  thinkingToEffortParams,
} from "../apply/cursor-apply-ids";
import type { Recommendation } from "../types";

function fakeRec(
  overrides: {
    id?: string;
    name?: string;
    contextWindow?: Recommendation["contextWindow"];
    thinkingEffort?: Recommendation["thinkingEffort"];
  } = {}
): Recommendation {
  const id = overrides.id ?? "grok-4.6";
  const name = overrides.name ?? "Grok 4.6 Medium";
  return {
    sessionModel: { id, name, vendor: "cursor" },
    score: 1,
    breakdown: { taskFit: 1, arena: 0, cost: 0.5 },
    contextWindow: overrides.contextWindow ?? "medium",
    thinkingEffort: overrides.thinkingEffort ?? "low",
    rationale: "test",
    badges: ["matched"],
    blendedPricePer1M: 0.24,
    costTier: "low",
  };
}

describe("candidateModelIds", () => {
  it("keeps cursor slug ids and adds kebab guess from display name", () => {
    const ids = candidateModelIds(
      fakeRec({ id: "glm-5.3-flash", name: "GLM 5.3 Flash" })
    );
    expect(ids[0]).toBe("glm-5.3-flash");
    expect(ids).toContain("GLM 5.3 Flash");
    expect(ids).toHaveLength(2);
  });

  it("dedupes when id equals name", () => {
    const ids = candidateModelIds(
      fakeRec({ id: "composer-2.5", name: "composer-2.5" })
    );
    expect(ids).toEqual(["composer-2.5"]);
  });
});

describe("thinking / context mapping", () => {
  it("maps thinking to effort params and omits when off", () => {
    expect(thinkingToEffortParams("medium")).toEqual([
      { id: "effort", value: "medium" },
    ]);
    expect(thinkingToEffortParams("off")).toEqual([]);
  });

  it("maps high context to Max Mode", () => {
    expect(contextToMaxMode("high")).toBe(true);
    expect(contextToMaxMode("medium")).toBe(false);
    expect(contextToMaxMode("standard")).toBe(false);
  });

  it("builds switch params with effort and context hints", () => {
    expect(
      buildSwitchParams(
        fakeRec({ thinkingEffort: "high", contextWindow: "high" })
      )
    ).toEqual([
      { id: "effort", value: "high" },
      { id: "context", value: "high" },
    ]);
  });

  it("embeds params in switchToModelSlug args", () => {
    const args = switchToModelSlugArgs("grok-4.6", [
      { id: "effort", value: "medium" },
    ]) as { modelIdWithParams: string };
    expect(JSON.parse(args.modelIdWithParams)).toEqual({
      modelId: "grok-4.6",
      params: [{ id: "effort", value: "medium" }],
    });
  });

  it("builds composer modelConfig with maxMode", () => {
    const cfg = composerModelConfigArgs(
      "grok-4.6",
      fakeRec({ thinkingEffort: "low", contextWindow: "high" })
    ) as {
      modelName: string;
      maxMode: boolean;
      selectedModels: Array<{ modelId: string; parameters: unknown[] }>;
    };
    expect(cfg.modelName).toBe("grok-4.6");
    expect(cfg.maxMode).toBe(true);
    expect(cfg.selectedModels[0].parameters).toContainEqual({
      id: "effort",
      value: "low",
    });
  });
});
