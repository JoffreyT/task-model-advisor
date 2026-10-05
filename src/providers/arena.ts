import type { ArenaEntry } from "../types";

export type ArenaErrorCode =
  | "unsupported_source"
  | "http_error"
  | "timeout"
  | "parse_error"
  | "empty";

export interface ArenaLeaderboardResult {
  entries: ArenaEntry[];
  degraded: boolean;
}

export class ArenaError extends Error {
  readonly code: ArenaErrorCode;
  readonly status?: number;

  constructor(code: ArenaErrorCode, message: string, status?: number) {
    super(message);
    this.name = "ArenaError";
    this.code = code;
    this.status = status;
  }
}

/**
 * Community mirror for Chatbot Arena leaderboards (JSON).
 * GET https://api.wulong.dev/arena-ai-leaderboards/v1/leaderboard?name=<category>
 * Response: `{ models: [{ model, rank, score }] }` (score may be null).
 */
const WULONG_LEADERBOARD_BASE =
  "https://api.wulong.dev/arena-ai-leaderboards/v1/leaderboard";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readNumber(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "") {
    const n = Number(value);
    if (Number.isFinite(n)) return n;
  }
  return undefined;
}

function buildLeaderboardUrl(categoryName: string): string {
  const url = new URL(WULONG_LEADERBOARD_BASE);
  url.searchParams.set("name", categoryName);
  return url.toString();
}

/** Ordered leaderboard names to try for a logical category. */
export function resolveArenaCategoryNames(category: string): string[] {
  const c = category.trim();
  if (c === "hard_prompts") return ["hard_prompts", "text"];
  if (c === "coding") return ["coding", "code"];
  if (c === "text") return ["text"];
  if (!c) return ["text"];
  return [c, "text"];
}

function mapArenaModels(payload: unknown): ArenaEntry[] {
  if (!isRecord(payload)) {
    throw new ArenaError(
      "parse_error",
      "Arena leaderboard response is not an object"
    );
  }
  const list = payload.models;
  if (!Array.isArray(list)) {
    throw new ArenaError(
      "parse_error",
      "Arena leaderboard response has no models array"
    );
  }

  const entries: ArenaEntry[] = [];
  for (const item of list) {
    if (!isRecord(item)) continue;
    const model = typeof item.model === "string" ? item.model.trim() : "";
    const rank = readNumber(item.rank);
    if (!model || rank === undefined) continue;
    const scoreRaw = item.score;
    const score =
      scoreRaw === null || scoreRaw === undefined
        ? null
        : (readNumber(scoreRaw) ?? null);
    entries.push({ model, rank, score });
  }
  return entries;
}

async function fetchLeaderboardOnce(opts: {
  url: string;
  timeoutMs: number;
  fetchImpl: typeof fetch;
}): Promise<{ entries: ArenaEntry[]; notFound: boolean }> {
  let response: Response;
  try {
    response = await opts.fetchImpl(opts.url, {
      method: "GET",
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(opts.timeoutMs),
    });
  } catch (err) {
    if (isTimeoutError(err)) {
      throw new ArenaError(
        "timeout",
        `Arena leaderboard request timed out after ${opts.timeoutMs}ms`
      );
    }
    throw err;
  }

  if (response.status === 404) {
    return { entries: [], notFound: true };
  }

  if (!response.ok) {
    throw new ArenaError(
      "http_error",
      `Arena leaderboard HTTP ${response.status}`,
      response.status
    );
  }

  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    throw new ArenaError(
      "parse_error",
      "Arena leaderboard response is not valid JSON"
    );
  }

  const entries = mapArenaModels(payload);
  return { entries, notFound: false };
}

export async function fetchArenaLeaderboard(opts: {
  category: string;
  source: string;
  timeoutMs: number;
  fetchImpl?: typeof fetch;
}): Promise<ArenaLeaderboardResult> {
  if (opts.source !== "wulong-mirror") {
    throw new ArenaError(
      "unsupported_source",
      `Unsupported arena source: ${opts.source}`
    );
  }

  const fetchFn = opts.fetchImpl ?? fetch;
  const names = resolveArenaCategoryNames(opts.category);

  for (let i = 0; i < names.length; i++) {
    const name = names[i]!;
    const url = buildLeaderboardUrl(name);
    const { entries, notFound } = await fetchLeaderboardOnce({
      url,
      timeoutMs: opts.timeoutMs,
      fetchImpl: fetchFn,
    });

    if (entries.length > 0) return { entries, degraded: false };

    const hasMoreFallback = i < names.length - 1;
    if (notFound || hasMoreFallback) continue;

    return { entries: [], degraded: true };
  }

  return { entries: [], degraded: true };
}

function isTimeoutError(err: unknown): boolean {
  if (err instanceof DOMException && err.name === "TimeoutError") return true;
  if (err instanceof Error && err.name === "TimeoutError") return true;
  return false;
}
