import type { RankingEngineId } from "../types";

const RULES: Array<{ id: RankingEngineId; patterns: RegExp[] }> = [
  {
    id: "cheap",
    patterns: [/quick/i, /rapide/i, /cheap/i, /pas cher/i, /\bsimple\b/i, /draft/i, /brouillon/i],
  },
  {
    id: "reasoning",
    patterns: [
      /debug/i,
      /\bbug\b/i,
      /explain/i,
      /pourquoi/i,
      /\bwhy\b/i,
      /review/i,
      /revue/i,
      /\btests?\b/i,
      /gherkin/i,
      /sc[eé]nario/i,
    ],
  },
  {
    id: "writing",
    patterns: [
      /sp[eé]c/i,
      /specification/i,
      /documentation/i,
      /\bdocs?\b/i,
      /user story/i,
      /histoire utilisateur/i,
      /cahier des charges/i,
      /\bADR\b/i,
    ],
  },
  {
    id: "coding",
    patterns: [
      /\bcode\b/i,
      /implement/i,
      /implément/i,
      /python/i,
      /script/i,
      /refactor/i,
      /\bAPI\b/i,
      /function/i,
      /fonction/i,
    ],
  },
];

export function classifyOther(text: string): RankingEngineId {
  const t = text.trim();
  if (!t) return "balanced";
  for (const rule of RULES) {
    if (rule.patterns.some((p) => p.test(t))) return rule.id;
  }
  return "balanced";
}
