/** Cost of 1,000 calls: provider tokens at published per-1M prices, plus Mubit's run fee ($5 per 1,000 runs). */
export function costPer1k(a: { inTok: number; outTok: number; inPricePerM: number; outPricePerM: number; mubitRunFee?: number }): number {
  return (1000 * (a.inTok * a.inPricePerM + a.outTok * a.outPricePerM)) / 1e6 + (a.mubitRunFee ?? 5);
}

/** Published prices per 1M tokens (in, out). Source: provider pricing pages, Oct 2026 handover; re-check before quoting. */
export const PRICES: Record<string, [number, number]> = {
  "claude-sonnet-4-6": [3, 15],
  "claude-haiku-4-5": [1, 5],
  "gpt-6-sol": [2, 10],
  "gpt-6-luna": [0.1, 0.5],
  // Groq list price seen for gpt-oss-120b; RE-CHECK on groq.com/pricing before quoting.
  "openai/gpt-oss-120b": [0.15, 0.75],
};
