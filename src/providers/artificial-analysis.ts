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
 * Artificial Analysis Data API — language model list (documented V2 Free contract).
 *
 * GET https://artificialanalysis.ai/api/v2/language/models/free?page=N
 * Auth: `x-api-key: <key>` (https://artificialanalysis.ai/data-api/docs).
 * Accepts any valid key. Paginate with `pagination.has_more`.
 *
 * Mapping (defensive):
 * - List: `data[]`, top-level array, or `models[]`
 * - slug, name → BenchmarkModel
 * - creator_slug | model_creator.slug → creatorSlug
 * - evaluations.* → evaluations record; intelligence/coding from AA index keys
 * - pricing.price_1m_blended_3_to_1, else (3×input + output) / 4 → blendedPricePer1M
 *   (Free omits blended; Pro may include it)
 * - context_window_tokens → contextWindowTokens (Pro-only; omitted on Free)
 */
const MODELS_URL = "https://artificialanalysis.ai/api/v2/language/models/free";
const MAX_PAGES = 20;

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

function blendedFromPricing(
  pricing: Record<string, unknown> | undefined,
  item: Record<string, unknown>
): number | undefined {
  const explicit =
    readNumber(pricing?.price_1m_blended_3_to_1) ?? readNumber(item.price_1m_blended_3_to_1);
  if (explicit !== undefined) return explicit;

  const input =
    readNumber(pricing?.price_1m_input_tokens) ?? readNumber(item.price_1m_input_tokens);
  const output =
    readNumber(pricing?.price_1m_output_tokens) ?? readNumber(item.price_1m_output_tokens);
  if (input === undefined || output === undefined) return undefined;
  return (3 * input + output) / 4;
}

function hasMorePages(payload: unknown, page: number): boolean {
  if (!isRecord(payload) || !isRecord(payload.pagination)) return false;
  if (payload.pagination.has_more === true) return true;
  const totalPages = readNumber(payload.pagination.total_pages);
  return totalPages !== undefined && page < totalPages;
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

  const blendedPricePer1M = blendedFromPricing(pricing, item);

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

async function fetchModelsPage(
  fetchFn: typeof fetch,
  apiKey: string,
  timeoutMs: number,
  page: number
): Promise<unknown> {
  let response: Response;
  try {
    response = await fetchFn(`${MODELS_URL}?page=${page}`, {
      method: "GET",
      headers: {
        Accept: "application/json",
        "x-api-key": apiKey,
      },
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (err) {
    if (isTimeoutError(err)) {
      throw new ArtificialAnalysisError(
        "timeout",
        `Artificial Analysis request timed out after ${timeoutMs}ms`
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

  try {
    return await response.json();
  } catch {
    throw new ArtificialAnalysisError(
      "parse_error",
      "Artificial Analysis response is not valid JSON"
    );
  }
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
  const items: Record<string, unknown>[] = [];

  for (let page = 1; page <= MAX_PAGES; page++) {
    const payload = await fetchModelsPage(fetchFn, apiKey, opts.timeoutMs, page);
    items.push(...extractModelList(payload));
    if (!hasMorePages(payload, page)) break;
  }

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
