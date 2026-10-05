export function normalizeModelKey(s: string): string {
  let result = s.toLowerCase();
  result = result.replace(/[\s/:,]+/g, "-");
  result = result.replace(/_/g, "-").replace(/\./g, "-");
  result = result.replace(/\([^)]*\)/g, "");
  result = result.replace(/enterprise/gi, "").replace(/entreprise/gi, "");
  result = result.replace(/-20\d{2}-\d{2}-\d{2}/g, "");
  result = result.replace(/-+/g, "-");
  result = result.replace(/^-|-$/g, "");
  return result.trim();
}

function tokensFromKey(s: string): Set<string> {
  return new Set(normalizeModelKey(s).split("-").filter(Boolean));
}

export function similarity(a: string, b: string): number {
  const ta = tokensFromKey(a);
  const tb = tokensFromKey(b);
  if (ta.size === 0 && tb.size === 0) return 1;
  if (ta.size === 0 || tb.size === 0) return 0;

  let intersection = 0;
  for (const t of ta) {
    if (tb.has(t)) intersection++;
  }
  const union = ta.size + tb.size - intersection;
  return union === 0 ? 0 : intersection / union;
}
