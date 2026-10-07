import { describe, expect, it } from "vitest";
import { classifyOther } from "../task/classify-other";
import { engineForPreset, TASK_PRESETS } from "../task/presets";
import { formatEvalReport, runEvalMatrix } from "../ranking/eval-matrix";

describe("ranking eval matrix (all engines)", () => {
  const results = runEvalMatrix();
  const report = formatEvalReport(results);

  it("prints a human-readable matrix for manual review", () => {
    console.log(`\n${report}\n`);
    expect(report).toContain("## writing");
    expect(report).toContain("## coding");
    expect(report).toContain("## reasoning");
    expect(report).toContain("## cheap");
    expect(report).toContain("## balanced");
  });

  it("returns top-3 for every engine scenario", () => {
    expect(results.length).toBeGreaterThanOrEqual(5);
    for (const row of results) {
      expect(row.recommendations.length).toBeGreaterThan(0);
      expect(row.recommendations.length).toBeLessThanOrEqual(3);
    }
  });

  it("prefers high-intelligence models for writing over pure flash", () => {
    const writing = results.find((r) => r.engineId === "writing" && !r.customText);
    expect(writing).toBeDefined();
    const top = writing!.recommendations[0]!;
    expect(top.sessionModel.name).not.toMatch(/GLM|Flash/i);
    expect(top.breakdown.taskFit).toBeGreaterThan(0.5);
  });

  it("ranks a coding-specialist ahead of pure flash for coding", () => {
    const coding = results.find((r) => r.engineId === "coding");
    expect(coding).toBeDefined();
    const top = coding!.recommendations[0]!;
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

  it("bumps context for balanced + large-codebase custom text vs plain balanced", () => {
    const plain = results.find((r) => r.engineId === "balanced" && r.customText === undefined);
    const large = results.find(
      (r) => r.engineId === "balanced" && r.customText?.includes("monorepo") === true
    );
    expect(plain).toBeDefined();
    expect(large).toBeDefined();
    const order = { standard: 0, medium: 1, high: 2 } as const;
    expect(order[large!.recommendations[0]!.contextWindow]).toBeGreaterThanOrEqual(
      order[plain!.recommendations[0]!.contextWindow]
    );
  });

  it("surfaces a mid-tier option in cheap top-3 (not only Opus-class)", () => {
    const cheap = results.find((r) => r.engineId === "cheap");
    expect(cheap).toBeDefined();
    const names = cheap!.recommendations.map((r) => r.sessionModel.name);
    const hasMidTier = names.some((n) => /Grok|Composer|Gemini|GLM|GPT-5\.6/i.test(n));
    expect(hasMidTier).toBe(true);
  });
});

describe("preset → engine smoke", () => {
  it("every non-other preset resolves via engineForPreset", () => {
    for (const { id } of TASK_PRESETS) {
      if (id === "other") continue;
      expect(engineForPreset(id)).toMatch(/^(coding|reasoning|writing|cheap)$/);
    }
  });

  it("maps former free-text samples to engines", () => {
    expect(classifyOther("écrire un script python pour scraper")).toBe("coding");
    expect(classifyOther("scénario de test gherkin")).toBe("reasoning");
    expect(classifyOther("rédiger une user story Jira")).toBe("writing");
  });
});
