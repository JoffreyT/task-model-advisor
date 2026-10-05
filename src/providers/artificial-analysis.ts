import type { BenchmarkModel } from "../types";

export type ArtificialAnalysisErrorCode =
  "missing_api_key" | "http_error" | "timeout" | "parse_error";

export class ArtificialAnalysisError extends Error {
  readonly code: ArtificialAnalysisErrorCode;
  readonly status?: number;

  constructor(code: ArtificialAnalysisErrorCode, message: string, status?: number) {
    super(message);
    this.name = "ArtificialAnalysisError";
    this.code = code;
    this.status = status;
  }
}

/**
 * Artificial Analysis Data API — LLM model list.
 *
 * GET https://artificialanalysis.ai/api/v2/data/llms/models
 * Auth: `x-api-key: <key>` (documented at https://artificialanalysis.ai/data-api/docs).
 * Free-tier list shape is also documented for GET /api/v2/language/models/free; field names align.
 *
 * Mapping (defensive):
 * - List: `data[]`, top-level array, or `models[]`
 * - slug, name → BenchmarkModel
 * - creator_slug | model_creator.slug → creatorSlug
 * - evaluations.* → evaluations record; intelligence/coding from AA index keys
 * - pricing.price_1m_blended_3_to_1 → blendedPricePer1M
 * - context_window_tokens → contextWindowTokens
 */
const MODELS_URL = "https://artificialanalysis.ai/api/v2/data/llms/models";

const INTELLIGENCE_KEY = "artificial_analysis_intelligence_index";
const CODING_KEY = "artificial_analysis_coding_index";

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

function normalizeEvaluations(raw: unknown): Record<string, number | null> {
  if (!isRecord(raw)) return {};
  const out: Record<string, number | null> = {};
  for (const [key, val] of Object.entries(raw)) {
    if (val === null) {
      out[key] = null;
      continue;
    }
    const n = readNumber(val);
    if (n !== undefined) out[key] = n;
  }
  return out;
}

function mapAaItem(item: Record<string, unknown>): BenchmarkModel | null {
  const slug = typeof item.slug === "string" ? item.slug.trim() : "";
  const name = typeof item.name === "string" ? item.name.trim() : "";
  if (!slug || !name) return null;

  const evaluations = normalizeEvaluations(item.evaluations);
  const pricing = isRecord(item.pricing) ? item.pricing : undefined;

  let creatorSlug: string | undefined;
  if (typeof item.creator_slug === "string" && item.creator_slug.trim()) {
    creatorSlug = item.creator_slug.trim();
  } else if (isRecord(item.model_creator)) {
    const cs = item.model_creator.slug;
    if (typeof cs === "string" && cs.trim()) creatorSlug = cs.trim();
  }

  const intelligence =
    evaluations[INTELLIGENCE_KEY] ??
    readNumber(item[INTELLIGENCE_KEY]) ??
    readNumber(item.intelligence_index);

  const coding =
    evaluations[CODING_KEY] ?? readNumber(item[CODING_KEY]) ?? readNumber(item.coding_index);

  const blendedPricePer1M =
    readNumber(pricing?.price_1m_blended_3_to_1) ?? readNumber(item.price_1m_blended_3_to_1);

  const contextWindowTokens =
    readNumber(item.context_window_tokens) ?? readNumber(item.contextWindowTokens);

  return {
    slug,
    name,
    ...(creatorSlug ? { creatorSlug } : {}),
    ...(intelligence !== undefined && intelligence !== null ? { intelligence } : {}),
    ...(coding !== undefined && coding !== null ? { coding } : {}),
    ...(blendedPricePer1M !== undefined ? { blendedPricePer1M } : {}),
    ...(contextWindowTokens !== undefined ? { contextWindowTokens } : {}),
    evaluations,
  };
}

function extractModelList(payload: unknown): Record<string, unknown>[] {
  if (Array.isArray(payload)) {
    return payload.filter(isRecord);
  }
  if (!isRecord(payload)) {
    throw new ArtificialAnalysisError(
      "parse_error",
      "Artificial Analysis response is not an object or array"
    );
  }
  for (const key of ["data", "models", "results"] as const) {
    const list = payload[key];
    if (Array.isArray(list)) {
      return list.filter(isRecord);
    }
  }
  throw new ArtificialAnalysisError(
    "parse_error",
    "Artificial Analysis response has no model list"
  );
}

export async function fetchArtificialAnalysisModels(opts: {
  apiKey: string;
  timeoutMs: number;
  fetchImpl?: typeof fetch;
}): Promise<BenchmarkModel[]> {
  const apiKey = opts.apiKey.trim();
  if (!apiKey) {
    throw new ArtificialAnalysisError("missing_api_key", "Artificial Analysis API key is required");
  }

  const fetchFn = opts.fetchImpl ?? fetch;

  let response: Response;
  try {
    response = await fetchFn(MODELS_URL, {
      method: "GET",
      headers: {
        Accept: "application/json",
        "x-api-key": apiKey,
      },
      signal: AbortSignal.timeout(opts.timeoutMs),
    });
  } catch (err) {
    if (isTimeoutError(err)) {
      throw new ArtificialAnalysisError(
        "timeout",
        `Artificial Analysis request timed out after ${opts.timeoutMs}ms`
      );
    }
    throw err;
  }

  if (!response.ok) {
    throw new ArtificialAnalysisError(
      "http_error",
      `Artificial Analysis HTTP ${response.status}`,
      response.status
    );
  }

  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    throw new ArtificialAnalysisError(
      "parse_error",
      "Artificial Analysis response is not valid JSON"
    );
  }

  const items = extractModelList(payload);
  const models = items.map(mapAaItem).filter((m): m is BenchmarkModel => m !== null);

  if (models.length === 0 && items.length > 0) {
    throw new ArtificialAnalysisError(
      "parse_error",
      "Artificial Analysis models could not be mapped"
    );
  }

  return models;
}

function isTimeoutError(err: unknown): boolean {
  if (err instanceof DOMException && err.name === "TimeoutError") return true;
  if (err instanceof Error && err.name === "TimeoutError") return true;
  return false;
}
