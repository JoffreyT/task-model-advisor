import { describe, it, expect, vi } from "vitest";
import { fetchArenaLeaderboard } from "../providers/arena";
import codingFixture from "./fixtures/arena-coding.json";

const WULONG_CODING_URL =
  "https://api.wulong.dev/arena-ai-leaderboards/v1/leaderboard?name=coding";

describe("fetchArenaLeaderboard", () => {
  it("maps models[] to ArenaEntry[]", async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => codingFixture,
    });
    const { entries, degraded } = await fetchArenaLeaderboard({
      category: "coding",
      source: "wulong-mirror",
      timeoutMs: 5000,
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    expect(degraded).toBe(false);
    expect(entries).toEqual([
      { model: "gpt-4o-2024-08-06", rank: 1, score: 1250 },
      { model: "claude-3-5-sonnet-20241022", rank: 2, score: 1244 },
      { model: "gemini-2.0-flash-001", rank: 3, score: null },
    ]);
  });

  it("uses the wulong mirror URL for coding", async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => codingFixture,
    });
    await fetchArenaLeaderboard({
      category: "coding",
      source: "wulong-mirror",
      timeoutMs: 5000,
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    expect(fetchImpl).toHaveBeenCalledWith(
      WULONG_CODING_URL,
      expect.objectContaining({ method: "GET" })
    );
  });

  it("surfaces http 503", async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: false,
      status: 503,
      json: async () => ({}),
    });
    await expect(
      fetchArenaLeaderboard({
        category: "text",
        source: "wulong-mirror",
        timeoutMs: 5000,
        fetchImpl: fetchImpl as unknown as typeof fetch,
      })
    ).rejects.toMatchObject({ code: "http_error", status: 503 });
  });

  it("throws on timeout", async () => {
    const fetchImpl = vi.fn().mockRejectedValue(
      new DOMException("Timed out", "TimeoutError")
    );
    await expect(
      fetchArenaLeaderboard({
        category: "text",
        source: "wulong-mirror",
        timeoutMs: 50,
        fetchImpl: fetchImpl as unknown as typeof fetch,
      })
    ).rejects.toMatchObject({ code: "timeout" });
  });

  it("falls back from hard_prompts to text when the first response is empty", async () => {
    const textFixture = {
      models: [{ model: "gpt-4o", rank: 1, score: 1300 }],
    };
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ models: [] }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => textFixture,
      });
    const { entries } = await fetchArenaLeaderboard({
      category: "hard_prompts",
      source: "wulong-mirror",
      timeoutMs: 5000,
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    expect(entries).toEqual([{ model: "gpt-4o", rank: 1, score: 1300 }]);
    expect(fetchImpl).toHaveBeenNthCalledWith(
      1,
      "https://api.wulong.dev/arena-ai-leaderboards/v1/leaderboard?name=hard_prompts",
      expect.any(Object)
    );
    expect(fetchImpl).toHaveBeenNthCalledWith(
      2,
      "https://api.wulong.dev/arena-ai-leaderboards/v1/leaderboard?name=text",
      expect.any(Object)
    );
  });

  it("returns [] when category and text fallback are both empty", async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ models: [] }),
    });
    const { entries, degraded } = await fetchArenaLeaderboard({
      category: "unknown-board",
      source: "wulong-mirror",
      timeoutMs: 5000,
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    expect(entries).toEqual([]);
    expect(degraded).toBe(true);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it("marks degraded when all candidate URLs return 404", async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: false,
      status: 404,
      json: async () => ({}),
    });
    const { entries, degraded } = await fetchArenaLeaderboard({
      category: "text",
      source: "wulong-mirror",
      timeoutMs: 5000,
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    expect(entries).toEqual([]);
    expect(degraded).toBe(true);
  });

  it("rejects unsupported arena source", async () => {
    await expect(
      fetchArenaLeaderboard({
        category: "text",
        source: "other",
        timeoutMs: 5000,
      })
    ).rejects.toMatchObject({ code: "unsupported_source" });
  });
});
