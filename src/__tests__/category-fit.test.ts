import { describe, expect, it } from "vitest";
import {
  complexityCostWeight,
  rawCapabilityBlend,
  rawCategoryFit,
  rawComplexityFit,
  resolveCategoryDefaults,
} from "../ranking/category-fit";
import type { BenchmarkModel } from "../types";

function bench(partial: Partial<BenchmarkModel> & { slug: string; name: string }): BenchmarkModel {
  return {
    evaluations: {},
    ...partial,
  };
}

describe("rawCategoryFit", () => {
  it("prefers intelligence for quickCheap", () => {
    const cheap = bench({
      slug: "a",
      name: "A",
      intelligence: 30,
      coding: 90,
    });
    const smart = bench({
      slug: "b",
      name: "B",
      intelligence: 80,
      coding: 20,
    });
    expect(rawCategoryFit(cheap, "quickCheap")).toBeLessThan(rawCategoryFit(smart, "quickCheap"));
    expect(rawCategoryFit(cheap, "development")).toBeGreaterThan(
      rawCategoryFit(smart, "development")
    );
  });

  it("weights agentic for autonomousAgent", () => {
    const agent = bench({
      slug: "a",
      name: "A",
      intelligence: 50,
      coding: 50,
      evaluations: { artificial_analysis_agentic_index: 90 },
    });
    const plain = bench({
      slug: "b",
      name: "B",
      intelligence: 70,
      coding: 70,
    });
    expect(rawCategoryFit(agent, "autonomousAgent")).toBeGreaterThan(
      rawCategoryFit(plain, "autonomousAgent")
    );
  });
});

describe("rawComplexityFit", () => {
  it("favors cost on basic complexity", () => {
    const pricey = bench({
      slug: "p",
      name: "P",
      intelligence: 90,
      coding: 90,
      blendedPricePer1M: 12,
    });
    const budget = bench({
      slug: "b",
      name: "B",
      intelligence: 50,
      coding: 50,
      blendedPricePer1M: 0.3,
    });
    expect(rawComplexityFit(budget, "basic")).toBeGreaterThan(rawComplexityFit(pricey, "basic"));
    expect(rawComplexityFit(pricey, "expert")).toBeGreaterThan(rawComplexityFit(budget, "expert"));
  });

  it("reduces cost weight as complexity rises", () => {
    expect(complexityCostWeight("basic")).toBeGreaterThan(complexityCostWeight("expert"));
  });
});

describe("rawCapabilityBlend", () => {
  it("includes agentic when present", () => {
    const withAgent = bench({
      slug: "a",
      name: "A",
      intelligence: 40,
      coding: 40,
      evaluations: { artificial_analysis_agentic_index: 100 },
    });
    expect(rawCapabilityBlend(withAgent)).toBeGreaterThan(40);
  });
});

describe("resolveCategoryDefaults", () => {
  it("bumps context for expert complexity", () => {
    const basic = resolveCategoryDefaults("development", "basic");
    const expert = resolveCategoryDefaults("development", "expert");
    expect(expert.contextWindow).not.toBe(basic.contextWindow);
  });

  it("keeps quickCheap low thinking on basic", () => {
    expect(resolveCategoryDefaults("quickCheap", "basic").thinkingEffort).toBe("low");
  });
});
