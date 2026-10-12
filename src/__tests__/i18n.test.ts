import { describe, expect, it } from "vitest";
import { en } from "../i18n/en";
import { fr } from "../i18n/fr";
import { COMPLEXITY_LEVELS, TASK_CATEGORIES } from "../task/categories";

describe("i18n task taxonomy", () => {
  it("covers every category and complexity id in en and fr", () => {
    for (const { id } of TASK_CATEGORIES) {
      expect(en.task.categories[id]).toBeTruthy();
      expect(fr.task.categories[id]).toBeTruthy();
    }
    for (const { id } of COMPLEXITY_LEVELS) {
      expect(en.task.complexity[id]).toBeTruthy();
      expect(fr.task.complexity[id]).toBeTruthy();
    }
  });

  it("uses spec emoji labels in English", () => {
    expect(en.task.categories.quickCheap).toBe("⚡ Quick / Cheap");
    expect(en.task.categories.development).toBe("💻 Development");
    expect(en.task.categories.autonomousAgent).toBe("🤖 Autonomous Agent");
    expect(en.task.complexity.basic).toBe("○ Basic");
    expect(en.task.complexity.expert).toBe("○ Expert");
  });

  it("builds a combined task label", () => {
    const label = en.task.taskLabel(
      en.task.categories.development,
      en.task.complexity.intermediate
    );
    expect(label).toContain("Development");
    expect(label).toContain("Intermediate");
  });
});
