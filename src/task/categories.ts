import type { ComplexityLevel, TaskCategoryId } from "../types";

export const TASK_CATEGORIES: Array<{ id: TaskCategoryId }> = [
  { id: "quickCheap" },
  { id: "analysisDoc" },
  { id: "development" },
  { id: "testingReview" },
  { id: "debugging" },
  { id: "architectureDesign" },
  { id: "autonomousAgent" },
];

export const COMPLEXITY_LEVELS: Array<{ id: ComplexityLevel }> = [
  { id: "basic" },
  { id: "intermediate" },
  { id: "advanced" },
  { id: "expert" },
];
