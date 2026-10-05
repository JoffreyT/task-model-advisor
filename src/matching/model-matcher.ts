import type { BenchmarkModel, MatchQuality, SessionModel } from "../types";
import { normalizeModelKey, similarity } from "./normalize";

export interface MatchedModel {
  session: SessionModel;
  benchmark: BenchmarkModel | null;
  score: number;
  badges: Array<MatchQuality>;
}

function isEnterprise(session: SessionModel): boolean {
  return (
    /enterprise|entreprise/i.test(session.id) ||
    /enterprise|entreprise/i.test(session.name)
  );
}

function benchmarkScore(
  session: SessionModel,
  benchmark: BenchmarkModel
): number {
  const nameNorm = normalizeModelKey(session.name);
  const idNorm = normalizeModelKey(session.id);
  const benchNameNorm = normalizeModelKey(benchmark.name);
  return Math.max(
    similarity(nameNorm, benchNameNorm),
    similarity(nameNorm, benchmark.slug),
    similarity(idNorm, benchmark.slug),
    similarity(session.name, benchmark.name),
    similarity(session.id, benchmark.slug)
  );
}

function matchOne(
  session: SessionModel,
  benchmarks: BenchmarkModel[],
  aliases: Record<string, string>,
  threshold: number
): MatchedModel {
  const enterprise = isEnterprise(session);
  const aliasSlug = aliases[session.id] ?? aliases[session.name];

  if (aliasSlug) {
    const benchmark =
      benchmarks.find((b) => b.slug === aliasSlug) ?? null;
    if (benchmark) {
      const badges: MatchQuality[] = ["matched"];
      if (enterprise) badges.push("enterprise");
      return { session, benchmark, score: 1, badges };
    }
    const badges: MatchQuality[] = ["weak"];
    if (enterprise) badges.push("enterprise");
    return { session, benchmark: null, score: 0, badges };
  }

  let bestBenchmark: BenchmarkModel | null = null;
  let bestScore = 0;

  for (const benchmark of benchmarks) {
    const score = benchmarkScore(session, benchmark);
    if (score > bestScore) {
      bestScore = score;
      bestBenchmark = benchmark;
    }
  }

  if (bestScore >= threshold && bestBenchmark) {
    const badges: MatchQuality[] = ["matched"];
    if (enterprise) badges.push("enterprise");
    return { session, benchmark: bestBenchmark, score: bestScore, badges };
  }

  const badges: MatchQuality[] = ["weak"];
  if (enterprise) badges.push("enterprise");
  return {
    session,
    benchmark: null,
    score: bestScore,
    badges,
  };
}

export function matchModels(
  session: SessionModel[],
  benchmarks: BenchmarkModel[],
  aliases: Record<string, string>,
  threshold: number
): MatchedModel[] {
  return session.map((s) => matchOne(s, benchmarks, aliases, threshold));
}
