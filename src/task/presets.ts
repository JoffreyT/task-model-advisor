import type { TaskProfileId } from "../types";

export const TASK_PRESETS: Array<{ id: TaskProfileId; label: string }> = [
  { id: "spec", label: "Écrire une spec" },
  { id: "userStory", label: "Écrire une user story" },
  { id: "testScenario", label: "Écrire un scénario de test" },
  {
    id: "pythonScript",
    label: "Écrire un script Python pour automatiser une action",
  },
  { id: "other", label: "Autre" },
];
