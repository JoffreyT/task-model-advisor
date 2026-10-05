import type { TaskProfileId } from "../types";

const RULES: Array<{
  id: Exclude<TaskProfileId, "other">;
  patterns: RegExp[];
}> = [
  {
    id: "pythonScript",
    patterns: [/python/i, /script/i, /automatis/i, /automat/i],
  },
  {
    id: "testScenario",
    patterns: [/sc[eé]nario/i, /gherkin/i, /cas de test/i, /test case/i],
  },
  {
    id: "userStory",
    patterns: [/user story/i, /histoire utilisateur/i, /jira/i],
  },
  {
    id: "spec",
    patterns: [/sp[eé]c/i, /specification/i, /cahier des charges/i],
  },
];

export function classifyOther(text: string): TaskProfileId {
  const t = text.trim();
  if (!t) return "other";
  for (const rule of RULES) {
    if (rule.patterns.some((p) => p.test(t))) return rule.id;
  }
  return "other";
}
