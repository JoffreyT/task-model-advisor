import { describe, expect, it } from "vitest";
import { dedupeSessionModels } from "../host/dedupe-session-models";
import type { SessionModel } from "../types";

function model(partial: SessionModel): SessionModel {
  return partial;
}

describe("dedupeSessionModels", () => {
  it("keeps the slug id when the same display name has a spaced id", () => {
    const models = dedupeSessionModels([
      model({
        id: "Claude Sonnet 4.5",
        name: "Claude Sonnet 4.5",
        family: "display",
        vendor: "a",
      }),
      model({ id: "other", name: "Other", vendor: "b" }),
      model({
        id: "claude-4.5-sonnet",
        name: "Claude Sonnet 4.5",
        family: "slug",
        vendor: "cursor",
      }),
    ]);

    expect(models).toEqual([
      {
        id: "claude-4.5-sonnet",
        name: "Claude Sonnet 4.5",
        family: "slug",
        vendor: "cursor",
      },
      { id: "other", name: "Other", vendor: "b" },
    ]);
  });

  it("keeps the earliest slug when several ids have no whitespace", () => {
    const models = dedupeSessionModels([
      model({ id: "claude-4.5-sonnet", name: "Claude Sonnet 4.5", vendor: "first" }),
      model({ id: "anthropic/claude-4.5-sonnet", name: "Claude Sonnet 4.5", vendor: "second" }),
    ]);

    expect(models).toEqual([
      { id: "claude-4.5-sonnet", name: "Claude Sonnet 4.5", vendor: "first" },
    ]);
  });

  it("keeps the earliest entry when every id contains whitespace", () => {
    const models = dedupeSessionModels([
      model({ id: "Display One", name: "Claude Sonnet 4.5", vendor: "first" }),
      model({ id: "Display Two", name: "claude sonnet 4.5", vendor: "second" }),
    ]);

    expect(models).toEqual([{ id: "Display One", name: "Claude Sonnet 4.5", vendor: "first" }]);
  });

  it("leaves variants with different display names separate", () => {
    const models = dedupeSessionModels([
      model({ id: "grok-4.7", name: "Grok 4.7" }),
      model({ id: "grok-4.7-high-fast", name: "Grok 4.7 High Fast" }),
    ]);

    expect(models.map((m) => m.name)).toEqual(["Grok 4.7", "Grok 4.7 High Fast"]);
  });

  it("treats internal double spaces as a different name", () => {
    const models = dedupeSessionModels([
      model({ id: "a", name: "Claude  Sonnet" }),
      model({ id: "b", name: "Claude Sonnet" }),
    ]);

    expect(models.map((m) => m.id)).toEqual(["a", "b"]);
  });

  it("keys a blank name by id and drops an entry with no name and no id", () => {
    const models = dedupeSessionModels([
      model({ id: "alpha-id", name: "   " }),
      model({ id: "beta-id", name: "" }),
      model({ id: "   ", name: "  " }),
    ]);

    expect(models).toEqual([
      { id: "alpha-id", name: "   " },
      { id: "beta-id", name: "" },
    ]);
  });

  it("preserves the relative order of distinct names", () => {
    const models = dedupeSessionModels([
      model({ id: "b", name: "Beta" }),
      model({ id: "a", name: "Alpha" }),
      model({ id: "c", name: "Gamma" }),
    ]);

    expect(models.map((m) => m.name)).toEqual(["Beta", "Alpha", "Gamma"]);
  });

  it("returns an empty list unchanged", () => {
    expect(dedupeSessionModels([])).toEqual([]);
  });
});
