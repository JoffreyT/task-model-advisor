import type { Messages } from "./types";

export const fr: Messages = {
  task: {
    placeholder: "Quel type de tâche ?",
    presets: {
      spec: "Écrire une spec",
      userStory: "Écrire une user story",
      testScenario: "Écrire un scénario de test",
      pythonScript: "Écrire un script Python pour automatiser une action",
      other: "Autre",
    },
    otherPrompt: "Décrivez la tâche",
    otherPlaceholder: "Ex. refactorer le module auth",
  },
  recommendations: {
    placeholder: "Choisissez une recommandation",
    context: {
      standard: "contexte standard",
      medium: "contexte moyen",
      high: "contexte élevé",
    },
    thinking: {
      off: "réflexion désactivée",
      low: "réflexion faible",
      medium: "réflexion moyenne",
      high: "réflexion élevée",
    },
    unknownPrice: "prix inconnu",
    sentence: {
      bestFit: "Le plus adapté à cette tâche",
      strongFit: "Très adapté",
      weakerFit: "Moins adapté à cette tâche",
      comparisons: "bien classé dans les comparatifs",
      cheapest: "Le moins cher",
      pricier: "Plus cher",
      reasonablePrice: "à un prix raisonnable",
      fitComparisonsJoiner: ", et ",
      limitedData: "Données de benchmark insuffisantes.",
      weak: "Sans benchmark fiable.",
    },
  },
  actions: {
    placeholder: "Action",
    apply: "Valider (copier la config)",
    copy: "Copier seulement",
    refresh: "Actualiser les benchmarks",
  },
  notifications: {
    unknownPrice: "prix inconnu",
    toastPrice: (amount) =>
      amount !== null && Number.isFinite(amount) ? `~$${amount.toFixed(2)}/1M` : "prix inconnu",
    copySuccess: (name, price) => `Task Model Advisor: config copiée pour "${name}" (${price}).`,
    copyFailed: (message) => `Task Model Advisor: impossible de copier (${message}).`,
    validationFailed: (message) => `Task Model Advisor: la validation a échoué (${message}).`,
    manualApply: (name, price, context, thinking) =>
      `Task Model Advisor: modèle "${name}" (${price}), contexte "${context}", thinking "${thinking}". Config copiée — applique-les manuellement dans le sélecteur Agent.`,
    cursorSuccess: (input) => {
      const via = input.kind === "new-agent" ? "nouvel Agent" : "modèle du composer courant";
      const parts = [`modèle "${input.name}" (${input.price})`];
      if (input.thinkingApplied) {
        parts.push(`thinking "${input.thinking}" (effort)`);
      } else {
        parts.push(`thinking "${input.thinking}"`);
      }
      if (input.maxModeApplied) {
        parts.push(`Max Mode ${input.maxModeOn ? "ON" : "OFF"} (contexte ${input.context})`);
      } else {
        parts.push(`contexte "${input.context}" à régler manuellement (Max Mode)`);
      }
      return `Task Model Advisor: ${via} → ${parts.join(" · ")} via ${input.commandId}. Config aussi copiée.`;
    },
    probesFailed: (errors) => `probes échouées (${errors})`,
    noRunnableProbe: "aucune sonde exécutable",
  },
};
