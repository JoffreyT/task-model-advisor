import { RANKING_WEIGHTS } from "../constants";
import type { Messages } from "../i18n/types";
import type { RankingWeights, Recommendation } from "../types";

type FactorId = "taskFit" | "arena" | "cost";

function capitalize(text: string): string {
  if (!text) return text;
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function topFactors(rec: Recommendation, weights: RankingWeights): FactorId[] {
  const factors: Array<{ id: FactorId; contribution: number; order: number }> = [
    { id: "taskFit", contribution: weights.taskFit * rec.breakdown.taskFit, order: 0 },
    { id: "arena", contribution: weights.arena * rec.breakdown.arena, order: 1 },
    { id: "cost", contribution: weights.cost * rec.breakdown.cost, order: 2 },
  ];
  return factors
    .filter((factor) => factor.contribution > 0)
    .sort((a, b) => b.contribution - a.contribution || a.order - b.order)
    .slice(0, 2)
    .map((factor) => factor.id);
}

function knownPrice(rec: Recommendation): number | undefined {
  const price = rec.blendedPricePer1M;
  if (price == null || !Number.isFinite(price)) return undefined;
  return price;
}

function priceRole(
  rec: Recommendation,
  visible: Recommendation[]
): "cheapest" | "priciest" | "neither" {
  const price = knownPrice(rec);
  if (price === undefined) return "neither";
  const prices = visible.map(knownPrice).filter((value): value is number => value !== undefined);
  if (prices.length < 2) return "neither";
  const cheapest = Math.min(...prices);
  const priciest = Math.max(...prices);
  if (price === cheapest && prices.filter((value) => value === cheapest).length === 1) {
    return "cheapest";
  }
  if (price === priciest && prices.filter((value) => value === priciest).length === 1) {
    return "priciest";
  }
  return "neither";
}

function isBestFit(rec: Recommendation, visible: Recommendation[]): boolean {
  const peers = visible.filter((row) => !row.badges.includes("weak"));
  return peers.every((row) => row === rec || rec.breakdown.taskFit > row.breakdown.taskFit);
}

/** Compact score line for QuickPick (fit / arena / cost / total). */
export function formatScoreBreakdown(rec: Recommendation): string {
  const { taskFit, arena, cost } = rec.breakdown;
  return `score ${rec.score.toFixed(2)} · fit ${taskFit.toFixed(2)} · arena ${arena.toFixed(2)} · cost ${cost.toFixed(2)}`;
}

export function formatRecommendationDescription(rec: Recommendation, messages: Messages): string {
  const price = knownPrice(rec);
  const priceLabel =
    price === undefined ? messages.recommendations.unknownPrice : `$${price.toFixed(2)}/1M`;
  return `${messages.recommendations.context[rec.contextWindow]} · ${messages.recommendations.thinking[rec.thinkingEffort]} · ${priceLabel}`;
}

export function formatRecommendationDetail(
  rec: Recommendation,
  visible: Recommendation[],
  messages: Messages
): string {
  const sentence = messages.recommendations.sentence;
  if (rec.badges.includes("weak")) return sentence.weak;

  const factors = topFactors(rec, RANKING_WEIGHTS);
  const clauses: string[] = [];
  if (factors.includes("taskFit")) {
    if (isBestFit(rec, visible)) clauses.push(sentence.bestFit);
    else if (rec.breakdown.taskFit >= 0.5) clauses.push(sentence.strongFit);
    else clauses.push(sentence.weakerFit);
  }
  if (factors.includes("arena")) clauses.push(sentence.comparisons);

  let body = "";
  if (clauses.length === 2) body = `${clauses[0]}${sentence.fitComparisonsJoiner}${clauses[1]}`;
  else if (clauses.length === 1) body = clauses[0] ?? "";

  const role = priceRole(rec, visible);
  if (role === "cheapest") {
    const lead = `${capitalize(sentence.cheapest)}.`;
    if (!body) return lead;
    return `${lead} ${capitalize(body)}.`;
  }

  if (factors.includes("cost") && role !== "priciest") {
    body = body ? `${body}, ${sentence.reasonablePrice}` : sentence.reasonablePrice;
  }

  if (!body && role !== "priciest") return sentence.limitedData;

  let detail = body ? `${capitalize(body)}.` : "";
  if (role === "priciest") {
    const tail = `${capitalize(sentence.pricier)}.`;
    detail = detail ? `${detail} ${tail}` : tail;
  }
  return detail;
}
