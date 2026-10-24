import type { Level3, Move } from "./types";
import { MOVES } from "./types";

/**
 * Phase-2 attack tempo by step. Phase-1 tempo is never touched (the base's combo lunges are tuned
 * to 1). 1.12 is the base HARD preset's value: the known-fair ceiling.
 */
export const TEMPO_P2_BY_STEP: readonly number[] = [1.02, 1.05, 1.08, 1.1, 1.12];

type Range = [number, number];
export interface Gaps {
  p1: Range;
  p2: Range;
}

// Copied from game/src/game/difficulty.ts (MEDIUM and HARD). game/test/planLoader.test.ts asserts they match.
const MEDIUM_GAP: Gaps = { p1: [0.6, 0.8], p2: [0.35, 0.55] };
const HARD_GAP: Gaps = { p1: [0.35, 0.6], p2: [0.15, 0.35] };

const r3 = (x: number) => Math.round(x * 1000) / 1000;
const lerpRange = (a: Range, b: Range, t: number): Range => [r3(a[0] + (b[0] - a[0]) * t), r3(a[1] + (b[1] - a[1]) * t)];

/** Idle gap between his attacks by step: 0 = MEDIUM, 3 = HARD. Never below HARD. */
export const GAP_BY_STEP: readonly Gaps[] = [0, 1, 2, 3].map((k) => ({
  p1: lerpRange(MEDIUM_GAP.p1, HARD_GAP.p1, k / 3),
  p2: lerpRange(MEDIUM_GAP.p2, HARD_GAP.p2, k / 3),
}));

export const EMPHASIS_FACTOR: Record<Level3, number> = { low: 0.5, normal: 1, high: 1.8 };

const isMove = (k: string): k is Move => (MOVES as readonly string[]).includes(k);

/** Scale each move's pick weight by its emphasis, then normalise to 1. Keys of `base` only; idle is kept. */
export function applyEmphasis(base: Record<string, number>, e: Record<Move, Level3>): Record<string, number> {
  const scaled: Record<string, number> = {};
  let total = 0;
  for (const [k, v] of Object.entries(base)) {
    const f = isMove(k) ? EMPHASIS_FACTOR[e[k] ?? "normal"] : 1;
    scaled[k] = v * f;
    total += scaled[k];
  }
  if (total <= 0) return { ...base };
  for (const k of Object.keys(scaled)) scaled[k] /= total;
  return scaled;
}
