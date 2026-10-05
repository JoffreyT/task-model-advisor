import { describe, it, expect, vi } from "vitest";
import { fetchArtificialAnalysisModels } from "../providers/artificial-analysis";
import fixture from "./fixtures/aa-models.json";

const INTELLIGENCE_KEY = "artificial_analysis_intelligence_index";

describe("fetchArtificialAnalysisModels", () => {
  it("rejects empty api key", async () => {
    await expect(
      fetchArtificialAnalysisModels({ apiKey: "", timeoutMs: 1000 })
    ).rejects.toMatchObject({ code: "missing_api_key" });
  });

  it("maps list response to BenchmarkModel[]", async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => fixture,
    });
    const models = await fetchArtificialAnalysisModels({
      apiKey: "test",
      timeoutMs: 5000,
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    expect(models.length).toBeGreaterThan(0);
    expect(models[0].slug).toBeTruthy();
    expect(models[0].evaluations[INTELLIGENCE_KEY]).toBe(24.5);
    expect(models[0].blendedPricePer1M).toBe(0.09);
    expect(models[1].creatorSlug).toBe("anthropic");
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

  it("passes x-api-key and uses the documented models URL", async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => fixture,
    });
    await fetchArtificialAnalysisModels({
      apiKey: "secret-key",
      timeoutMs: 5000,
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    expect(fetchImpl).toHaveBeenCalledWith(
      "https://artificialanalysis.ai/api/v2/data/llms/models",
      expect.objectContaining({
        headers: expect.objectContaining({ "x-api-key": "secret-key" }),
      })
    );
  });
});
