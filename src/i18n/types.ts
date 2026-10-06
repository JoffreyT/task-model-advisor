import type { TaskProfileId } from "../types";

export type ContextTier = "standard" | "medium" | "high";
export type ThinkingTier = "off" | "low" | "medium" | "high";

export interface CursorSuccessInput {
  kind: "new-agent" | "composer";
  name: string;
  price: string;
  thinking: string;
  thinkingApplied: boolean;
  maxModeApplied: boolean;
  maxModeOn: boolean;
  context: string;
  commandId: string;
}

export interface SentenceFragments {
  bestFit: string;
  strongFit: string;
  weakerFit: string;
  comparisons: string;
  cheapest: string;
  pricier: string;
  reasonablePrice: string;
  /** Includes the leading comma: ", and " or ", et ". */
  fitComparisonsJoiner: string;
  /** Full sentence, including the period. */
  limitedData: string;
  /** Full sentence, including the period. */
  weak: string;
}

export interface Messages {
  task: {
    placeholder: string;
    presets: Record<TaskProfileId, string>;
    otherPrompt: string;
    otherPlaceholder: string;
  };
  recommendations: {
    placeholder: string;
    context: Record<ContextTier, string>;
    thinking: Record<ThinkingTier, string>;
    unknownPrice: string;
    sentence: SentenceFragments;
  };
  actions: {
    placeholder: string;
    apply: string;
    copy: string;
    refresh: string;
  };
  notifications: {
    unknownPrice: string;
    toastPrice: (amount: number | null) => string;
    copySuccess: (name: string, price: string) => string;
    copyFailed: (message: string) => string;
    validationFailed: (message: string) => string;
    manualApply: (name: string, price: string, context: string, thinking: string) => string;
    cursorSuccess: (input: CursorSuccessInput) => string;
    probesFailed: (errors: string) => string;
    noRunnableProbe: string;
  };
}
