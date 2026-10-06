import type { Messages } from "./types";

export const en: Messages = {
  task: {
    placeholder: "What kind of task?",
    presets: {
      spec: "Write a spec",
      userStory: "Write a user story",
      testScenario: "Write a test scenario",
      pythonScript: "Write a Python script to automate a task",
      other: "Other",
    },
    otherPrompt: "Describe the task",
    otherPlaceholder: "e.g. refactor the auth module",
  },
  recommendations: {
    placeholder: "Choose a recommendation",
    context: {
      standard: "standard context",
      medium: "medium context",
      high: "high context",
    },
    thinking: {
      off: "thinking off",
      low: "low thinking",
      medium: "medium thinking",
      high: "high thinking",
    },
    unknownPrice: "unknown price",
    sentence: {
      bestFit: "Best fit for this task",
      strongFit: "Strong fit",
      weakerFit: "Weaker fit for this task",
      comparisons: "well ranked in comparisons",
      cheapest: "The cheapest",
      pricier: "Pricier",
      reasonablePrice: "at a reasonable price",
      fitComparisonsJoiner: ", and ",
      limitedData: "Limited benchmark data.",
      weak: "No reliable benchmark.",
    },
  },
  actions: {
    placeholder: "Action",
    apply: "Apply (copy config)",
    copy: "Copy only",
    refresh: "Refresh benchmarks",
  },
  notifications: {
    unknownPrice: "unknown price",
    toastPrice: (amount) =>
      amount !== null && Number.isFinite(amount) ? `~$${amount.toFixed(2)}/1M` : "unknown price",
    copySuccess: (name, price) => `Task Model Advisor: config copied for "${name}" (${price}).`,
    copyFailed: (message) => `Task Model Advisor: could not copy (${message}).`,
    validationFailed: (message) => `Task Model Advisor: validation failed (${message}).`,
    manualApply: (name, price, context, thinking) =>
      `Task Model Advisor: model "${name}" (${price}), context "${context}", thinking "${thinking}". Config copied — set these manually in the Agent picker.`,
    cursorSuccess: (input) => {
      const via = input.kind === "new-agent" ? "new Agent" : "current composer model";
      const parts = [`model "${input.name}" (${input.price})`];
      if (input.thinkingApplied) {
        parts.push(`thinking "${input.thinking}" (effort)`);
      } else {
        parts.push(`thinking "${input.thinking}"`);
      }
      if (input.maxModeApplied) {
        parts.push(`Max Mode ${input.maxModeOn ? "ON" : "OFF"} (context ${input.context})`);
      } else {
        parts.push(`context "${input.context}" must be set manually (Max Mode)`);
      }
      return `Task Model Advisor: ${via} → ${parts.join(" · ")} via ${input.commandId}. Config copied too.`;
    },
    probesFailed: (errors) => `probes failed (${errors})`,
    noRunnableProbe: "no runnable probe",
  },
};
