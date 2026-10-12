import * as vscode from "vscode";
import type { Messages } from "../i18n/types";
import { COMPLEXITY_LEVELS, TASK_CATEGORIES } from "../task/categories";
import type { ComplexityLevel, TaskCategoryId } from "../types";

type CategoryQuickPickItem = vscode.QuickPickItem & { categoryId: TaskCategoryId };
type ComplexityQuickPickItem = vscode.QuickPickItem & { complexity: ComplexityLevel };

export async function pickTask(
  messages: Messages
): Promise<{ categoryId: TaskCategoryId; complexity: ComplexityLevel } | undefined> {
  const category = await vscode.window.showQuickPick<CategoryQuickPickItem>(
    TASK_CATEGORIES.map((c) => ({
      label: messages.task.categories[c.id],
      categoryId: c.id,
    })),
    { placeHolder: messages.task.categoryPlaceholder }
  );
  if (!category) return undefined;

  const complexityPick = await vscode.window.showQuickPick<ComplexityQuickPickItem>(
    COMPLEXITY_LEVELS.map((c) => ({
      label: messages.task.complexity[c.id],
      complexity: c.id,
    })),
    { placeHolder: messages.task.complexityPlaceholder }
  );
  if (!complexityPick) return undefined;

  return { categoryId: category.categoryId, complexity: complexityPick.complexity };
}
