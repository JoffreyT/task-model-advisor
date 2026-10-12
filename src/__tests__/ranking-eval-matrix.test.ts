import { describe, expect, it } from "vitest";
import { TASK_CATEGORIES } from "../task/categories";
import { formatEvalReport, runEvalMatrix } from "../ranking/eval-matrix";

describe("ranking eval matrix (category × complexity)", () => {
  const results = runEvalMatrix({
    categories: ["development", "analysisDoc", "quickCheap", "autonomousAgent"],
    complexities: ["basic", "intermediate", "expert"],
  });
  const report = formatEvalReport(results);

  it("prints a human-readable matrix for manual review", () => {
    console.log(`\n${report}\n`);
    expect(report).toContain("## development");
    expect(report).toContain("## quickCheap");
    expect(report).toContain("· expert");
  });

  it("returns top-3 for every scenario", () => {
    expect(results.length).toBe(4 * 3);
    for (const row of results) {
      expect(row.recommendations.length).toBeGreaterThan(0);
      expect(row.recommendations.length).toBeLessThanOrEqual(3);
    }
  });

  it("prefers high-intelligence models for analysisDoc over pure flash", () => {
    const row = results.find(
      (r) => r.categoryId === "analysisDoc" && r.complexity === "intermediate"
    );
    expect(row).toBeDefined();
    const top = row!.recommendations[0]!;
    expect(top.sessionModel.name).not.toMatch(/GLM|Flash/i);
    expect(top.breakdown.categoryFit).toBeGreaterThan(0.5);
  });

  it("ranks a coding-specialist ahead of pure flash for development", () => {
    const row = results.find(
      (r) => r.categoryId === "development" && r.complexity === "intermediate"
    );
    expect(row).toBeDefined();
    const top = row!.recommendations[0]!;
    expect(top.sessionModel.name).toMatch(/Composer|GPT-5|Grok 4\.7|Opus/i);
    expect(top.sessionModel.name).not.toMatch(/GLM 5\.3 Flash/i);
  });

  it("does not rank unmatched Unknown Corp LLM above matched models", () => {
    for (const row of results) {
      const first = row.recommendations[0];
      if (!first) continue;
      if (first.sessionModel.id === "unknown-corp-llm") {
        expect(first.badges).not.toContain("matched");
        expect(row.matchedCount).toBe(0);
      }
    }
  });

  it("surfaces mid-tier options in quickCheap basic top-3", () => {
    const row = results.find((r) => r.categoryId === "quickCheap" && r.complexity === "basic");
    expect(row).toBeDefined();
    const names = row!.recommendations.map((r) => r.sessionModel.name);
    const hasMidTier = names.some((n) => /Grok|Composer|Gemini|GLM|GPT-5\.6/i.test(n));
    expect(hasMidTier).toBe(true);
  });

  it("covers all categories in full matrix", () => {
    const full = runEvalMatrix();
    expect(full.length).toBe(TASK_CATEGORIES.length * 4);
  });
});
