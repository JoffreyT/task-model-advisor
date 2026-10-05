import { describe, it, expect } from "vitest";
import { normalizeModelKey, similarity } from "../matching/normalize";

describe("normalizeModelKey", () => {
  it("lowercases and strips enterprise/date noise", () => {
    expect(normalizeModelKey("GPT-4o (Entreprise)")).toContain("gpt");
    expect(normalizeModelKey("gpt-4o-2024-08-06")).toBe(normalizeModelKey("gpt-4o"));
  });

  it("replaces underscores and dots with hyphens", () => {
    expect(normalizeModelKey("claude_3.5_sonnet")).toBe("claude-3-5-sonnet");
  });

  it("collapses repeated hyphens", () => {
    expect(normalizeModelKey("gpt--4o")).toBe("gpt-4o");
  });

  it("normalizes spaces and punctuation to hyphens", () => {
    expect(normalizeModelKey("Claude Sonnet 4")).toBe("claude-sonnet-4");
  });
});

describe("similarity", () => {
  it("is high for near-identical strings", () => {
    expect(similarity("gpt-4o", "gpt-4o")).toBe(1);
    expect(similarity("claude-3-5-sonnet", "claude-3.5-sonnet")).toBeGreaterThan(0.7);
  });

  it("is low for unrelated strings", () => {
    expect(similarity("gpt-4o", "claude-3-5-sonnet")).toBeLessThan(0.5);
  });

  it("matches spaced display names to slugs above threshold", () => {
    expect(similarity("Claude Sonnet 4", "claude-sonnet-4")).toBeGreaterThan(0.72);
  });
});
