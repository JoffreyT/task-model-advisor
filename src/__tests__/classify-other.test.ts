import { describe, it, expect } from "vitest";
import { classifyOther } from "../task/classify-other";
import { TASK_PRESETS } from "../task/presets";

describe("TASK_PRESETS", () => {
  it("has five entries ending with other", () => {
    expect(TASK_PRESETS).toHaveLength(5);
    expect(TASK_PRESETS.map((p) => p.id)).toEqual([
      "spec",
      "userStory",
      "testScenario",
      "pythonScript",
      "other",
    ]);
  });
});

describe("classifyOther", () => {
  it("maps python automation keywords to pythonScript", () => {
    expect(classifyOther("écrire un script python pour scraper")).toBe("pythonScript");
  });
  it("maps user story keywords", () => {
    expect(classifyOther("rédiger une user story Jira")).toBe("userStory");
  });
  it("maps test scenario keywords", () => {
    expect(classifyOther("scénario de test gherkin")).toBe("testScenario");
  });
  it("maps spec keywords", () => {
    expect(classifyOther("write a functional specification")).toBe("spec");
  });
  it("defaults to other when unclear", () => {
    expect(classifyOther("bonjour")).toBe("other");
  });
});
