import type { Move } from "./types";

export const BOSS_IDS = [1, 2, 3] as const;
export type BossId = (typeof BOSS_IDS)[number];

const BASE: readonly Move[] = ["leap", "combo", "comboDelay", "overhead", "thrust", "sweep", "grab", "flurry"];

/** What each boss can do. Boss 1 is the base game's general; 2 and 3 add variants of the same clips. */
export const BOSS_MOVES: Record<BossId, readonly Move[]> = {
  1: BASE,
  2: [...BASE, "windSlash", "waterfowl", "spin"],
  3: [...BASE, "windSlash", "shockwave", "kick"],
};

export const bossOf = (v: unknown): BossId => (v === 2 || v === 3 ? v : 1);
export const movesFor = (id: BossId): Move[] => [...BOSS_MOVES[id]];