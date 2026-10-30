import { describe, it, expect, vi } from "vitest";
import { fetchArtificialAnalysisModels } from "../providers/artificial-analysis";
import fixture from "./fixtures/aa-models.json";

const INTELLIGENCE_KEY = "artificial_analysis_intelligence_index";
const MODELS_URL = "https://artificialanalysis.ai/api/v2/language/models/free";

function jsonOk(body: unknown) {
  return {
    ok: true,
    status: 200,
    json: async () => body,
  };
}

describe("fetchArtificialAnalysisModels", () => {
  it("rejects empty api key", async () => {
    await expect(
      fetchArtificialAnalysisModels({ apiKey: "", timeoutMs: 1000 })
    ).rejects.toMatchObject({ code: "missing_api_key" });
  });

  it("maps list response to BenchmarkModel[]", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonOk(fixture));
    const models = await fetchArtificialAnalysisModels({
      apiKey: "test",
      timeoutMs: 5000,
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    expect(models.length).toBeGreaterThan(0);
    expect(models[0].slug).toBeTruthy();
    expect(models[0].evaluations[INTELLIGENCE_KEY]).toBe(24.5);
    expect(models[0].creatorSlug).toBe("openai");
    expect(models[0].blendedPricePer1M).toBe(0.09);
    expect(models[1].creatorSlug).toBe("anthropic");
    expect(models[1].blendedPricePer1M).toBe(3.0);
    expect(models[1].contextWindowTokens).toBe(200000);
    expect(models[3].evaluations.artificial_analysis_coding_index).toBe(10);
  });

  it("surfaces http 429", async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: false,
      status: 429,
      json: async () => ({}),
    });
    await expect(
      fetchArtificialAnalysisModels({
        apiKey: "test",
        timeoutMs: 5000,
        fetchImpl: fetchImpl as unknown as typeof fetch,
      })
    ).rejects.toMatchObject({ code: "http_error", status: 429 });
  });

  it("passes x-api-key and uses the documented free models URL", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonOk(fixture));
    await fetchArtificialAnalysisModels({
      apiKey: "secret-key",
      timeoutMs: 5000,
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    expect(fetchImpl).toHaveBeenCalledWith(
      `${MODELS_URL}?page=1`,
      expect.objectContaining({
        headers: expect.objectContaining({ "x-api-key": "secret-key" }),
      })
    );
  });

  it("follows pagination until has_more is false", async () => {
    const page1 = {
      pagination: { page: 1, page_size: 1, total_pages: 2, has_more: true },
      data: [fixture.data[0]],
    };
    const page2 = {
      pagination: { page: 2, page_size: 1, total_pages: 2, has_more: false },
      data: [fixture.data[1]],
    };
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(jsonOk(page1))
      .mockResolvedValueOnce(jsonOk(page2));

    const models = await fetchArtificialAnalysisModels({
      apiKey: "test",
      timeoutMs: 5000,
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    expect(fetchImpl).toHaveBeenNthCalledWith(1, `${MODELS_URL}?page=1`, expect.anything());
    expect(fetchImpl).toHaveBeenNthCalledWith(2, `${MODELS_URL}?page=2`, expect.anything());
    expect(models.map((m) => m.slug)).toEqual(["gpt-oss-20b", "claude-sonnet-4"]);
  });
});
