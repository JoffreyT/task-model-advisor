import type { RankingEngineId, TaskPresetId } from "../types";

export const TASK_PRESETS: Array<{ id: TaskPresetId }> = [
  { id: "writeCode" },
  { id: "debug" },
  { id: "refactor" },
  { id: "codeReview" },
  { id: "spec" },
  { id: "userStory" },
  { id: "tests" },
  { id: "cheap" },
  { id: "other" },
];

export const PRESET_ENGINE: Record<Exclude<TaskPresetId, "other">, RankingEngineId> = {
  writeCode: "coding",
  debug: "reasoning",
  refactor: "coding",
  codeReview: "reasoning",
  spec: "writing",
  userStory: "writing",
  tests: "reasoning",
  cheap: "cheap",
};

export function engineForPreset(id: Exclude<TaskPresetId, "other">): RankingEngineId {
  return PRESET_ENGINE[id];
}
