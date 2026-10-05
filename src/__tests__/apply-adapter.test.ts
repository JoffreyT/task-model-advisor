import { describe, expect, it } from "vitest";
import { candidateModelIds } from "../apply/cursor-apply-ids";
import type { Recommendation } from "../types";

function fakeRec(id: string, name: string): Recommendation {
  return {
    sessionModel: { id, name, vendor: "cursor" },
    contextWindow: "medium",
    thinkingEffort: "low",
    breakdown: {
      taskFit: 1,
      arena: 0,
      cost: 0.5,
      matchConfidence: 1,
      matchedBenchmarkIds: [],
    },
    blendedPricePer1M: 0.24,
    costTier: "budget",
    warnings: [],
  };
}

describe("candidateModelIds", () => {
  it("keeps cursor slug ids and adds kebab guess from display name", () => {
    const ids = candidateModelIds(fakeRec("glm-5.3-flash", "GLM 5.3 Flash"));
    expect(ids[0]).toBe("glm-5.3-flash");
    expect(ids).toContain("GLM 5.3 Flash");
    // display name kebabizes to same slug → deduped
    expect(ids).toHaveLength(2);
  });

  it("dedupes when id equals name", () => {
    const ids = candidateModelIds(fakeRec("composer-2.5", "composer-2.5"));
    expect(ids).toEqual(["composer-2.5"]);
  });
});
