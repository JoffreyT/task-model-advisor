import { describe, expect, it } from "vitest";
import { formatEvalReport, runEvalMatrix } from "../ranking/eval-matrix";

describe("ranking eval matrix (all task profiles)", () => {
  const results = runEvalMatrix();
  const report = formatEvalReport(results);

  it("prints a human-readable matrix for manual review", () => {
    // Visible with: npm run eval:ranking
    console.log(`\n${report}\n`);
    expect(report).toContain("## spec");
    expect(report).toContain("## pythonScript");
    expect(report).toContain("## userStory");
    expect(report).toContain("## testScenario");
    expect(report).toContain("## other");
  });

  it("returns top-3 for every profile scenario", () => {
    expect(results.length).toBeGreaterThanOrEqual(5);
    for (const row of results) {
      expect(row.recommendations.length).toBeGreaterThan(0);
      expect(row.recommendations.length).toBeLessThanOrEqual(3);
    }
  });

  it("prefers high-intelligence / writing models for spec over pure flash", () => {
    const spec = results.find((r) => r.profileId === "spec" && !r.customText);
    expect(spec).toBeDefined();
    const top = spec!.recommendations[0]!;
    // Opus / Fable / GPT-class should outrank GLM Flash on spec
    expect(top.sessionModel.name).not.toMatch(/GLM|Flash/i);
    expect(top.breakdown.taskFit).toBeGreaterThan(0.5);
  });

  it("ranks a coding-specialist ahead of pure flash for pythonScript", () => {
    const py = results.find((r) => r.profileId === "pythonScript");
    expect(py).toBeDefined();
    const top = py!.recommendations[0]!;
    expect(top.sessionModel.name).toMatch(/Composer|GPT-5|Grok 4\.7|Opus/i);
    expect(top.sessionModel.name).not.toMatch(/GLM 5\.3 Flash/i);
  });

  it("does not rank unmatched Unknown Corp LLM above matched models", () => {
    for (const row of results) {
      const first = row.recommendations[0];
      if (!first) continue;
      if (first.sessionModel.id === "unknown-corp-llm") {
        expect(first.badges).not.toContain("matched");
        // Only acceptable if somehow no matched models — not our fixture case
        expect(row.matchedCount).toBe(0);
      }
    }
  });

  it("bumps context for other + large-codebase custom text vs plain other", () => {
    const plain = results.find((r) => r.profileId === "other" && r.customText === undefined);
    const large = results.find(
      (r) => r.profileId === "other" && r.customText?.includes("monorepo") === true
    );
    expect(plain).toBeDefined();
    expect(large).toBeDefined();
    const plainCtx = plain!.recommendations[0]!.contextWindow;
    const largeCtx = large!.recommendations[0]!.contextWindow;
    const order = { standard: 0, medium: 1, high: 2 } as const;
    expect(order[largeCtx]).toBeGreaterThanOrEqual(order[plainCtx]);
  });

  it("surfaces a mid-tier option in userStory top-3 (not only Opus-class)", () => {
    const us = results.find((r) => r.profileId === "userStory");
    expect(us).toBeDefined();
    const names = us!.recommendations.map((r) => r.sessionModel.name);
    const hasMidTier = names.some((n) => /Grok|Composer|Gemini|GLM|GPT-5\.6/i.test(n));
    expect(hasMidTier).toBe(true);
  });
});
