/**
 * Log-price anchors for absolute cost score ($/1M).
 */
const COST_PRICE_FLOOR = 0.1;
const COST_PRICE_CEILING = 15;

/**
 * Absolute cost efficiency in [0, 1] from blended $/1M.
 */
export function absoluteCostScore(pricePer1M: number): number {
  if (!Number.isFinite(pricePer1M) || pricePer1M <= 0) return 0.5;
  const lo = Math.log(COST_PRICE_FLOOR);
  const hi = Math.log(COST_PRICE_CEILING);
  const t = (Math.log(pricePer1M) - lo) / (hi - lo);
  const clamped = Math.min(1, Math.max(0, t));
  return 1 - clamped;
}
