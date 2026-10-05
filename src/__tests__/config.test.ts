import { describe, it, expect } from "vitest";
import { resolveConfig } from "../config";

describe("resolveConfig", () => {
  it("applies defaults when raw is empty", () => {
    const c = resolveConfig({});
    expect(c.enabled).toBe(true);
    expect(c.ranking.weights).toEqual({ taskFit: 0.5, arena: 0.3, cost: 0.2 });
    expect(c.fetch.timeoutMs).toBe(8000);
    expect(c.matching.fuzzyThreshold).toBe(0.72);
  });

  it("overrides nested weights", () => {
    const c = resolveConfig({
      ranking: { weights: { taskFit: 0.7, arena: 0.2, cost: 0.1 } },
    });
    expect(c.ranking.weights.taskFit).toBe(0.7);
  });
});
