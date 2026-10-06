import type { TaskProfileId } from "../types";

export const TASK_PRESETS: Array<{ id: TaskProfileId }> = [
  { id: "spec" },
  { id: "userStory" },
  { id: "testScenario" },
  { id: "pythonScript" },
  { id: "other" },
];
