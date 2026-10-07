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
    expect(en.task.presets.writeCode).toBe("Write / edit code");
    expect(en.task.presets.debug).toBe("Debug / explain a bug");
    expect(en.task.presets.refactor).toBe("Refactor / restructure");
    expect(en.task.presets.codeReview).toBe("Review code / find issues");
    expect(en.task.presets.spec).toBe("Write a spec / technical doc");
    expect(en.task.presets.userStory).toBe("Write a user story");
    expect(en.task.presets.tests).toBe("Write tests / scenarios");
    expect(en.task.presets.cheap).toBe("Quick task / cheaper model");
    expect(en.task.presets.other).toBe("Other…");

    expect(fr.task.presets.writeCode).toBe("Écrire / modifier du code");
    expect(fr.task.presets.debug).toBe("Déboguer / expliquer un bug");
    expect(fr.task.presets.refactor).toBe("Refactorer / restructurer");
    expect(fr.task.presets.codeReview).toBe("Revue de code / trouver des problèmes");
    expect(fr.task.presets.spec).toBe("Écrire une spec / doc technique");
    expect(fr.task.presets.userStory).toBe("Écrire une user story");
    expect(fr.task.presets.tests).toBe("Écrire des tests / scénarios");
    expect(fr.task.presets.cheap).toBe("Tâche rapide / modèle pas cher");
    expect(fr.task.presets.other).toBe("Autre…");
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
