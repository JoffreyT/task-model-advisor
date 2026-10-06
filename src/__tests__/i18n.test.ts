import { describe, expect, it } from "vitest";
import { en } from "../i18n/en";
import { fr } from "../i18n/fr";
import { messagesFor } from "../i18n";

function leafKeys(value: unknown, prefix = ""): string[] {
  if (typeof value === "function" || value === null || typeof value !== "object") {
    return [prefix];
  }
  return Object.entries(value).flatMap(([key, child]) =>
    leafKeys(child, prefix ? `${prefix}.${key}` : key)
  );
}

describe("messages", () => {
  it("gives en and fr the same keys", () => {
    expect(leafKeys(fr).sort()).toEqual(leafKeys(en).sort());
  });

  it("defaults to English", () => {
    expect(messagesFor(undefined)).toBe(en);
    expect(messagesFor("nope")).toBe(en);
    expect(messagesFor("fr")).toBe(fr);
  });

  it("exposes the approved task and weak strings", () => {
    expect(en.task.presets.spec).toBe("Write a spec");
    expect(fr.task.presets.spec).toBe("Écrire une spec");
    expect(en.recommendations.sentence.weak).toBe("No reliable benchmark.");
    expect(fr.recommendations.sentence.weak).toBe("Sans benchmark fiable.");
    expect(en.notifications.copySuccess("Composer 2.5", "~$1.50/1M")).toBe(
      'Task Model Advisor: config copied for "Composer 2.5" (~$1.50/1M).'
    );
    expect(fr.notifications.copySuccess("Composer 2.5", "~$1.50/1M")).toBe(
      'Task Model Advisor: config copiée pour "Composer 2.5" (~$1.50/1M).'
    );
  });
});
