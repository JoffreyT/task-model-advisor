import * as vscode from "vscode";
import { applyRecommendation, copyRecommendationToClipboard } from "../apply/apply-adapter";
import { resolveConfig } from "../config";
import { discoverSessionModels } from "../host/model-discovery";
import { matchModels } from "../matching/model-matcher";
import {
  ArtificialAnalysisError,
  fetchArtificialAnalysisModels,
} from "../providers/artificial-analysis";
import { ArenaError, fetchArenaLeaderboard } from "../providers/arena";
import { rankRecommendations } from "../ranking/task-ranker";
import type {
  AdvisorConfig,
  ArenaEntry,
  BenchmarkModel,
  RankingEngineId,
  SessionModel,
} from "../types";
import { messagesFor } from "../i18n";
import { showRecommendations } from "../ui/recommendation-ui";
import { pickTask } from "../ui/task-picker";

function loadAdvisorConfig(): AdvisorConfig {
  const section = vscode.workspace.getConfiguration("taskModelAdvisor");
  return resolveConfig({
    artificialAnalysis: {
      apiKey: section.get<string>("artificialAnalysis.apiKey"),
    },
    cursor: {
      apiKey: section.get<string>("cursor.apiKey"),
    },
    language: section.get<string>("language"),
  });
}

interface FetchBundle {
  benchmarks: BenchmarkModel[];
  arena: ArenaEntry[];
  sessionModels: SessionModel[];
  warnings: string[];
}

async function fetchBenchmarksAndSession(
  config: AdvisorConfig,
  engineId: RankingEngineId
): Promise<FetchBundle> {
  const warnings: string[] = [];
  const arenaCategory = config.arena.categories[engineId];

  const aaPromise = fetchArtificialAnalysisModels({
    apiKey: config.artificialAnalysis.apiKey,
    timeoutMs: config.fetch.timeoutMs,
  });

  const arenaPromise = fetchArenaLeaderboard({
    category: arenaCategory,
    source: config.arena.source,
    timeoutMs: config.fetch.timeoutMs,
  })
    .then((result) => {
      if (result.degraded) {
        warnings.push(
          "Arena leaderboard unavailable (empty): rankings use Artificial Analysis only."
        );
      }
      return result.entries;
    })
    .catch((err: unknown) => {
      if (err instanceof ArenaError) {
        warnings.push(
          `Arena leaderboard unavailable (${err.code}): rankings use Artificial Analysis only.`
        );
      } else if (err instanceof Error) {
        warnings.push(
          `Arena leaderboard unavailable: ${err.message}. Rankings use Artificial Analysis only.`
        );
      } else {
        warnings.push("Arena leaderboard unavailable. Rankings use Artificial Analysis only.");
      }
      return [] as ArenaEntry[];
    });

  const sessionPromise = discoverSessionModels({
    cursorApiKey: config.cursor.apiKey,
    timeoutMs: config.fetch.timeoutMs,
  }).then((result) => {
    warnings.push(...result.warnings);
    return result.models;
  });

  const [benchmarks, arena, sessionModels] = await Promise.all([
    aaPromise,
    arenaPromise,
    sessionPromise,
  ]);

  return { benchmarks, arena, sessionModels, warnings };
}

export async function runRecommendCommand(): Promise<void> {
  const config = loadAdvisorConfig();
  const messages = messagesFor(config.language);

  const task = await pickTask(messages);
  if (!task) return;

  const { presetId, engineId, customText } = task;

  while (true) {
    let bundle: FetchBundle;

    try {
      bundle = await vscode.window.withProgress(
        {
          location: vscode.ProgressLocation.Notification,
          title: "Task Model Advisor",
          cancellable: false,
        },
        async () => fetchBenchmarksAndSession(config, engineId)
      );
    } catch (err) {
      if (err instanceof ArtificialAnalysisError) {
        void vscode.window.showErrorMessage(
          `Artificial Analysis fetch failed (${err.code}): ${err.message}`
        );
        return;
      }
      const message = err instanceof Error ? err.message : "Unknown fetch error";
      void vscode.window.showErrorMessage(`Task Model Advisor fetch failed: ${message}`);
      return;
    }

    const { benchmarks, arena, sessionModels, warnings } = bundle;

    if (sessionModels.length === 0) {
      void vscode.window.showErrorMessage(
        "No chat models found in this session. Sign in to your AI provider (e.g. GitHub Copilot). On Cursor, set taskModelAdvisor.cursor.apiKey or run `agent login`."
      );
      return;
    }

    const matched = matchModels(
      sessionModels,
      benchmarks,
      config.modelAliases,
      config.matching.fuzzyThreshold
    );

    const recommendations = rankRecommendations({
      matched,
      arena,
      engineId,
      weights: config.ranking.weights,
      reasoningModelPatterns: config.reasoningModelPatterns,
      customText,
    });

    const taskLabel = customText ? messages.task.presets.other : messages.task.presets[presetId];
    const choice = await showRecommendations(recommendations, warnings, taskLabel, messages);
    if (!choice) return;

    const rec = recommendations[choice.index];
    if (!rec) return;

    const rank = choice.index + 1;

    if (choice.action === "refresh") {
      continue;
    }

    if (choice.action === "copy") {
      await copyRecommendationToClipboard(rec, presetId, engineId, messages, rank);
      return;
    }

    try {
      await applyRecommendation(rec, config.applyStrategy, presetId, engineId, messages, rank);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      void vscode.window.showErrorMessage(messages.notifications.validationFailed(message));
    }
    return;
  }
}
