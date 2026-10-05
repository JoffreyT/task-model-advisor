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
  SessionModel,
  TaskProfileId,
} from "../types";
import { showRecommendations } from "../ui/recommendation-ui";
import { pickFallbackSessionModels } from "../ui/session-model-picker";
import { pickTask } from "../ui/task-picker";

function loadAdvisorConfig(): AdvisorConfig {
  const section = vscode.workspace.getConfiguration("taskModelAdvisor");
  return resolveConfig({
    enabled: section.get<boolean>("enabled"),
    artificialAnalysis: {
      apiKey: section.get<string>("artificialAnalysis.apiKey"),
    },
    arena: {
      source: section.get<string>("arena.source"),
      categories: section.get<Record<string, string>>("arena.categories"),
    },
    ranking: {
      weights: section.get<AdvisorConfig["ranking"]["weights"]>("ranking.weights"),
    },
    modelAliases: section.get<Record<string, string>>("modelAliases"),
    matching: {
      fuzzyThreshold: section.get<number>("matching.fuzzyThreshold"),
    },
    applyStrategy: section.get<AdvisorConfig["applyStrategy"]>("applyStrategy"),
    fetch: {
      timeoutMs: section.get<number>("fetch.timeoutMs"),
    },
    reasoningModelPatterns: section.get<string[]>("reasoningModelPatterns"),
    fallbackModels: section.get<string[]>("fallbackModels"),
    cursor: {
      apiKey: section.get<string>("cursor.apiKey"),
    },
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
  profileId: TaskProfileId
): Promise<FetchBundle> {
  const warnings: string[] = [];
  const arenaCategory = config.arena.categories[profileId];

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

  if (!config.enabled) {
    void vscode.window.showWarningMessage(
      "Task Model Advisor is disabled. Enable taskModelAdvisor.enabled in settings."
    );
    return;
  }

  const task = await pickTask();
  if (!task) return;

  const { profileId, customText } = task;

  while (true) {
    let bundle: FetchBundle;

    try {
      bundle = await vscode.window.withProgress(
        {
          location: vscode.ProgressLocation.Notification,
          title: "Task Model Advisor",
          cancellable: false,
        },
        async () => fetchBenchmarksAndSession(config, profileId)
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

    const { benchmarks, arena, sessionModels: discovered, warnings } = bundle;

    let sessionModels = discovered;
    if (sessionModels.length === 0) {
      void vscode.window.showInformationMessage(
        "Could not auto-discover Cursor models. Select models from your Agent picker (or set taskModelAdvisor.cursor.apiKey / run `agent login`)."
      );
      const picked = await pickFallbackSessionModels(config.fallbackModels);
      if (!picked || picked.length === 0) {
        void vscode.window.showErrorMessage("No session models selected. Cancelled.");
        return;
      }
      sessionModels = picked;
      warnings.push("Session models were selected manually (auto-discovery failed).");
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
      profileId,
      weights: config.ranking.weights,
      reasoningModelPatterns: config.reasoningModelPatterns,
      customText,
    });

    const choice = await showRecommendations(recommendations, warnings);
    if (!choice) return;

    const rec = recommendations[choice.index];
    if (!rec) return;

    const rank = choice.index + 1;

    if (choice.action === "refresh") {
      continue;
    }

    if (choice.action === "copy") {
      await copyRecommendationToClipboard(rec, profileId, rank);
      return;
    }

    try {
      await applyRecommendation(rec, config.applyStrategy, profileId, rank);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      void vscode.window.showErrorMessage(`Task Model Advisor: validation a échoué (${message}).`);
    }
    return;
  }
}
