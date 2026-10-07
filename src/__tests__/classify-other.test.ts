import { describe, it, expect } from "vitest";
import { classifyOther } from "../task/classify-other";
import { engineForPreset, PRESET_ENGINE, TASK_PRESETS } from "../task/presets";
import type { RankingEngineId, TaskPresetId } from "../types";

describe("TASK_PRESETS", () => {
  it("has nine entries ending with other", () => {
    expect(TASK_PRESETS.map((p) => p.id)).toEqual([
      "writeCode",
      "debug",
      "refactor",
      "codeReview",
      "spec",
      "userStory",
      "tests",
      "cheap",
      "other",
    ]);
  });

  it("maps every non-other preset to an engine", () => {
    const expected: Record<Exclude<TaskPresetId, "other">, RankingEngineId> = {
      writeCode: "coding",
      debug: "reasoning",
      refactor: "coding",
      codeReview: "reasoning",
      spec: "writing",
      userStory: "writing",
      tests: "reasoning",
      cheap: "cheap",
    };
    expect(PRESET_ENGINE).toEqual(expected);
    for (const id of Object.keys(expected) as Array<Exclude<TaskPresetId, "other">>) {
      expect(engineForPreset(id)).toBe(expected[id]);
    }
  });
});

describe("classifyOther", () => {
  it("maps python automation to coding", () => {
    expect(classifyOther("écrire un script python pour scraper")).toBe("coding");
  });
  it("maps implement/code keywords to coding", () => {
    expect(classifyOther("implement the auth API")).toBe("coding");
  });
  it("maps user story keywords to writing", () => {
    expect(classifyOther("rédiger une user story Jira")).toBe("writing");
  });
  it("maps spec keywords to writing", () => {
    expect(classifyOther("write a functional specification")).toBe("writing");
  });
  it("maps test scenario keywords to reasoning", () => {
    expect(classifyOther("scénario de test gherkin")).toBe("reasoning");
  });
  it("maps debug keywords to reasoning", () => {
    expect(classifyOther("debug this bug and explain why")).toBe("reasoning");
  });
  it("maps review keywords to reasoning", () => {
    expect(classifyOther("revue de code du PR")).toBe("reasoning");
  });
  it("maps cheap/quick keywords to cheap", () => {
    expect(classifyOther("tâche rapide pas cher")).toBe("cheap");
    expect(classifyOther("quick draft")).toBe("cheap");
  });
  it("prefers cheap when both cheap and coding match", () => {
    expect(classifyOther("quick python script")).toBe("cheap");
  });
  it("defaults to balanced when unclear", () => {
    expect(classifyOther("bonjour")).toBe("balanced");
  });
  it("defaults empty input to balanced", () => {
    expect(classifyOther("   ")).toBe("balanced");
  });
});
