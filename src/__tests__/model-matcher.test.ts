import { describe, it, expect } from "vitest";
import { matchModels } from "../matching/model-matcher";

const benches = [
  { slug: "gpt-4o", name: "GPT-4o", evaluations: {} },
  { slug: "gpt-4o-mini", name: "GPT-4o mini", evaluations: {} },
  { slug: "claude-3-5-sonnet", name: "Claude 3.5 Sonnet", evaluations: {} },
  { slug: "claude-sonnet-4", name: "Claude Sonnet 4", evaluations: {} },
];

describe("matchModels", () => {
  it("treats alias to missing catalog slug as weak match", () => {
    const out = matchModels(
      [
        {
          id: "copilot-gpt-4o-mini-enterprise",
          name: "GPT-4o mini entreprise",
        },
      ],
      benches,
      { "copilot-gpt-4o-mini-enterprise": "not-in-catalog" },
      0.72
    );
    expect(out[0].benchmark).toBeNull();
    expect(out[0].badges).toContain("weak");
    expect(out[0].badges).not.toContain("matched");
    expect(out[0].badges).toContain("enterprise");
    expect(out[0].score).toBe(0);
  });

  it("matches via alias", () => {
    const session = [
      { id: "copilot-gpt-4o-mini-enterprise", name: "GPT-4o mini entreprise" },
    ];
    const out = matchModels(
      session,
      benches,
      { "copilot-gpt-4o-mini-enterprise": "gpt-4o-mini" },
      0.72
    );
    expect(out[0].benchmark?.slug).toBe("gpt-4o-mini");
    expect(out[0].badges).toContain("matched");
    expect(out[0].badges).toContain("enterprise");
  });

  it("fuzzy-matches display name", () => {
    const out = matchModels(
      [{ id: "x", name: "Claude 3.5 Sonnet" }],
      benches,
      {},
      0.72
    );
    expect(out[0].benchmark?.slug).toBe("claude-3-5-sonnet");
    expect(out[0].badges).toEqual(["matched"]);
  });

  it("returns null benchmark when below threshold", () => {
    const out = matchModels(
      [{ id: "custom-corp-llm", name: "Corp Internal LLM v9" }],
      benches,
      {},
      0.72
    );
    expect(out[0].benchmark).toBeNull();
    expect(out[0].badges).toContain("weak");
  });

  it("matches via alias on display name key", () => {
    const out = matchModels(
      [{ id: "unknown-id", name: "My Custom Label" }],
      benches,
      { "My Custom Label": "gpt-4o" },
      0.72
    );
    expect(out[0].benchmark?.slug).toBe("gpt-4o");
    expect(out[0].badges).toEqual(["matched"]);
  });

  it("fuzzy-matches session id to benchmark slug", () => {
    const out = matchModels(
      [{ id: "gpt_4o_mini", name: "something else" }],
      benches,
      {},
      0.72
    );
    expect(out[0].benchmark?.slug).toBe("gpt-4o-mini");
    expect(out[0].badges).toContain("matched");
  });

  it("adds enterprise badge on fuzzy match when id contains enterprise", () => {
    const out = matchModels(
      [{ id: "gpt-4o-enterprise", name: "GPT-4o" }],
      benches,
      {},
      0.72
    );
    expect(out[0].benchmark?.slug).toBe("gpt-4o");
    expect(out[0].badges).toContain("matched");
    expect(out[0].badges).toContain("enterprise");
  });

  it("fuzzy-matches spaced Claude Sonnet 4 display name", () => {
    const out = matchModels(
      [{ id: "x", name: "Claude Sonnet 4" }],
      benches,
      {},
      0.72
    );
    expect(out[0].benchmark?.slug).toBe("claude-sonnet-4");
    expect(out[0].score).toBeGreaterThan(0.72);
    expect(out[0].badges).toContain("matched");
  });

  it("does not match GPT-4o mini to gpt-4o slug above threshold", () => {
    const out = matchModels(
      [{ id: "y", name: "GPT-4o mini" }],
      benches,
      {},
      0.72
    );
    expect(out[0].benchmark?.slug).toBe("gpt-4o-mini");
    const wrong = matchModels(
      [{ id: "y", name: "GPT-4o mini" }],
      [{ slug: "gpt-4o", name: "GPT-4o", evaluations: {} }],
      {},
      0.72
    );
    expect(wrong[0].benchmark).toBeNull();
    expect(wrong[0].badges).toContain("weak");
  });

  it("keeps enterprise badge on fuzzy miss below threshold", () => {
    const out = matchModels(
      [{ id: "corp-enterprise", name: "Corp Internal LLM v9" }],
      benches,
      {},
      0.72
    );
    expect(out[0].benchmark).toBeNull();
    expect(out[0].badges).toContain("weak");
    expect(out[0].badges).toContain("enterprise");
  });

  it("returns one result per session model preserving order", () => {
    const session = [
      { id: "a", name: "GPT-4o" },
      { id: "b", name: "Claude 3.5 Sonnet" },
    ];
    const out = matchModels(session, benches, {}, 0.72);
    expect(out).toHaveLength(2);
    expect(out[0].benchmark?.slug).toBe("gpt-4o");
    expect(out[1].benchmark?.slug).toBe("claude-3-5-sonnet");
  });
});
