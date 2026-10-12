import type { Messages } from "./types";

export const en: Messages = {
  task: {
    categoryPlaceholder: "What kind of work?",
    complexityPlaceholder: "How complex is the task?",
    categories: {
      quickCheap: "⚡ Quick / Cheap",
      analysisDoc: "📋 Analysis & Documentation",
      development: "💻 Development",
      testingReview: "🧪 Testing & Review",
      debugging: "🐞 Debugging",
      architectureDesign: "🏗️ Architecture & Design",
      autonomousAgent: "🤖 Autonomous Agent",
    },
    complexity: {
      basic: "○ Basic",
      intermediate: "○ Intermediate",
      advanced: "○ Advanced",
      expert: "○ Expert",
    },
    taskLabel: (category, complexity) => `${category} · ${complexity}`,
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
    refresh: "Refresh",
  },
  notifications: {
    unknownPrice: "unknown price",
    toastPrice: (amount) =>
      amount != null && Number.isFinite(amount) ? `~$${amount.toFixed(2)}/1M` : "unknown price",
    copySuccess: (name, price) => `Copied config for ${name} (${price}).`,
    copyFailed: (message) => `Copy failed: ${message}`,
    validationFailed: (message) => `Could not apply recommendation: ${message}`,
    manualApply: (name, price, context, thinking) =>
      `Task Model Advisor: model "${name}" (${price}), context "${context}", thinking "${thinking}". Config copied — set these manually in the Agent picker.`,
    cursorSuccess: (input) => {
      const via = input.kind === "new-agent" ? "new Agent" : "current composer model";
      const thinkingPart = input.thinkingApplied
        ? `thinking "${input.thinking}" (effort)`
        : `thinking "${input.thinking}"`;
      const maxPart = input.maxModeApplied
        ? `Max Mode ${input.maxModeOn ? "ON" : "OFF"} (context ${input.context})`
        : `context "${input.context}" must be set manually (Max Mode)`;
      return `Task Model Advisor: ${via} → model "${input.name}" (${input.price}) · ${thinkingPart} · ${maxPart} via ${input.commandId}. Config copied too.`;
    },
    probesFailed: (errors) => `Cursor apply probes failed:\n${errors}`,
    noRunnableProbe: "No Cursor command accepted the model switch; config copied to clipboard.",
  },
};
