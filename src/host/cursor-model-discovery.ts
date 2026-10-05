import { spawn } from "node:child_process";
import type { SessionModel } from "../types";

export interface CursorModelsResult {
  models: SessionModel[];
  source: "agent-cli" | "cursor-api" | "none";
  detail?: string;
}

/**
 * Parse `agent models` / `agent --list-models` text output.
 * Lines look like:
 *   Auto
 *   grok-4.7 - Grok 4.7 High Fast
 *   composer-2.5 - Composer 2.5
 */
export function parseAgentModelsOutput(stdout: string): SessionModel[] {
  const models: SessionModel[] = [];
  const seen = new Set<string>();

  // Strip ANSI CSI sequences from CLI output (ESC = \u001b).
  const ansiCsi = new RegExp(`${String.fromCharCode(0x1b)}\\[[0-9;]*[a-zA-Z]`, "g");
  for (const rawLine of stdout.split(/\r?\n/)) {
    const line = rawLine.replace(ansiCsi, "").trim();
    if (!line) continue;
    const lower = line.toLowerCase();
    if (
      lower.startsWith("loading") ||
      lower.startsWith("usage:") ||
      lower.startsWith("options:") ||
      lower.includes("no models available") ||
      lower.includes("authentication required") ||
      lower.includes("not logged in") ||
      lower.startsWith("available models:")
    ) {
      continue;
    }

    let id: string;
    let name: string;
    const dash = line.indexOf(" - ");
    if (dash > 0) {
      id = line.slice(0, dash).trim();
      name = line.slice(dash + 3).trim() || id;
    } else {
      id = line;
      name = line;
    }

    const key = id.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    models.push({ id, name, vendor: "cursor" });
  }

  return models;
}

function runCommand(
  command: string,
  args: string[],
  env: NodeJS.ProcessEnv,
  timeoutMs: number
): Promise<{ code: number | null; stdout: string; stderr: string }> {
  return new Promise((resolve) => {
    const child = spawn(command, args, {
      env,
      shell: false,
    });
    let stdout = "";
    let stderr = "";
    const timer = setTimeout(() => {
      child.kill("SIGTERM");
      resolve({ code: null, stdout, stderr: stderr || "timeout" });
    }, timeoutMs);

    child.stdout.on("data", (chunk: Buffer) => {
      stdout += chunk.toString("utf8");
    });
    child.stderr.on("data", (chunk: Buffer) => {
      stderr += chunk.toString("utf8");
    });
    child.on("error", (err) => {
      clearTimeout(timer);
      resolve({ code: 1, stdout, stderr: err.message });
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      resolve({ code, stdout, stderr });
    });
  });
}

/**
 * Discover Cursor account models via CLI (`agent --list-models`).
 * Uses optional API key so IDE login alone is not required when a key is set.
 */
export async function fetchCursorModelsViaAgentCli(opts: {
  apiKey?: string;
  timeoutMs: number;
}): Promise<CursorModelsResult> {
  const env = { ...process.env };
  if (opts.apiKey?.trim()) {
    env.CURSOR_API_KEY = opts.apiKey.trim();
  }

  const attempts: Array<{ cmd: string; args: string[] }> = [
    { cmd: "agent", args: ["--list-models"] },
    { cmd: "agent", args: ["models"] },
  ];

  if (opts.apiKey?.trim()) {
    attempts.unshift({
      cmd: "agent",
      args: ["--api-key", opts.apiKey.trim(), "--list-models"],
    });
  }

  let lastDetail = "agent CLI unavailable";

  for (const attempt of attempts) {
    const result = await runCommand(attempt.cmd, attempt.args, env, opts.timeoutMs);
    const combined = `${result.stdout}\n${result.stderr}`;
    if (/authentication required|not logged in/i.test(combined) && !opts.apiKey?.trim()) {
      lastDetail =
        "Cursor CLI not logged in. Run `agent login` or set taskModelAdvisor.cursor.apiKey.";
      continue;
    }
    const models = parseAgentModelsOutput(combined);
    if (models.length > 0) {
      return { models, source: "agent-cli" };
    }
    if (/no models available/i.test(combined)) {
      lastDetail = "Cursor CLI reported no models for this account.";
    } else if (result.stderr.includes("ENOENT") || /not found/i.test(result.stderr)) {
      lastDetail = "`agent` CLI not found on PATH.";
    } else {
      lastDetail = `agent CLI returned no parseable models (${attempt.args.join(" ")}).`;
    }
  }

  return { models: [], source: "none", detail: lastDetail };
}

interface CursorApiModelItem {
  id?: string;
  name?: string;
  displayName?: string;
  display_name?: string;
}

/**
 * Discover models via official Cloud Agents API:
 * GET https://api.cursor.com/v1/models
 */
export async function fetchCursorModelsViaApi(opts: {
  apiKey: string;
  timeoutMs: number;
  fetchImpl?: typeof fetch;
}): Promise<CursorModelsResult> {
  const apiKey = opts.apiKey.trim();
  if (!apiKey) {
    return {
      models: [],
      source: "none",
      detail: "Missing taskModelAdvisor.cursor.apiKey",
    };
  }

  const fetchImpl = opts.fetchImpl ?? fetch;
  try {
    const response = await fetchImpl("https://api.cursor.com/v1/models", {
      method: "GET",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        Accept: "application/json",
      },
      signal: AbortSignal.timeout(opts.timeoutMs),
    });

    if (!response.ok) {
      return {
        models: [],
        source: "none",
        detail: `Cursor API /v1/models HTTP ${response.status}`,
      };
    }

    const body = (await response.json()) as {
      items?: CursorApiModelItem[];
      models?: CursorApiModelItem[];
    };
    const items = body.items ?? body.models ?? [];
    const models: SessionModel[] = [];
    const seen = new Set<string>();

    for (const item of items) {
      const id = typeof item.id === "string" ? item.id.trim() : "";
      if (!id || seen.has(id.toLowerCase())) continue;
      seen.add(id.toLowerCase());
      const name = item.displayName?.trim() || item.display_name?.trim() || item.name?.trim() || id;
      models.push({ id, name, vendor: "cursor" });
    }

    if (models.length === 0) {
      return {
        models: [],
        source: "none",
        detail: "Cursor API returned an empty model list.",
      };
    }

    return { models, source: "cursor-api" };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { models: [], source: "none", detail: message };
  }
}

export async function discoverCursorSessionModels(opts: {
  apiKey?: string;
  timeoutMs: number;
  fetchImpl?: typeof fetch;
}): Promise<CursorModelsResult> {
  const viaCli = await fetchCursorModelsViaAgentCli({
    apiKey: opts.apiKey,
    timeoutMs: opts.timeoutMs,
  });
  if (viaCli.models.length > 0) return viaCli;

  if (opts.apiKey?.trim()) {
    const viaApi = await fetchCursorModelsViaApi({
      apiKey: opts.apiKey,
      timeoutMs: opts.timeoutMs,
      fetchImpl: opts.fetchImpl,
    });
    if (viaApi.models.length > 0) return viaApi;
    return {
      models: [],
      source: "none",
      detail: [viaCli.detail, viaApi.detail].filter(Boolean).join(" | "),
    };
  }

  return viaCli;
}
