/**
 * The three generals. Boss 1 is the base game's duelist untouched; 2 and 3 get their own picks
 * (which moves they favour), tempo and rhythm, arena and look. The LLM plan is applied on top of
 * this, and every boss stays inside the base's tested bounds (phase-2 tempo <= 1.12, gaps never
 * shorter than the HARD preset, the player's deflect windows never touched).
 */
import { BOSS_MOVES, GAP_BY_STEP, type BossId, type Move } from "@gr/shared";
import type { ThemeId } from "../world/themes";
import { DIFFICULTY_PRESETS, type DifficultyValues } from "./difficulty";

export type BossLook = "ronin" | "reed" | "hollow";

export interface BossDef {
  id: BossId;
  chapter: string;
  jp: string;
  latin: string;
  epithet: string;
  arena: ThemeId;
  /** Wins in a row needed to reach the next boss (0 = last boss). */
  gate: number;
  moves: readonly Move[];
  /** Replaces the pick weights when set (moves the boss favours at mid range). */
  picks?: { p1: Record<string, number>; p2: Record<string, number> };
  /** Phase-2 attack tempo (never above the HARD preset's 1.12). */
  tempoP2?: number;
  /** Rhythm: gaps shorten to this step of GAP_BY_STEP (never past HARD). */
  gapStep?: 0 | 1 | 2 | 3;
  /**
   * Fighting style: these knobs move this far (0..1) from the chosen preset toward the HARD preset.
   * Never past HARD, and never the deflect windows or the player's damage.
   */
  lean?: { amount: number; knobs: readonly LeanKnob[] };
  look: BossLook;
  /** Line on the chapter card. */
  line: string;
}

export type LeanKnob = "bossDeflect" | "counterDelay" | "counterFlurry" | "recoverAfterAttack" | "guardSlip" | "healReact" | "bossRegen" | "blockPosture" | "cutPostureArmoured" | "cutPostureOpen";

/** Swift and watchful: parries strings, answers fast, rarely stands open. */
const READS_YOU: readonly LeanKnob[] = ["bossDeflect", "counterDelay", "counterFlurry", "recoverAfterAttack", "guardSlip", "healReact"];
/** Armoured and relentless: all of that, plus his posture holds and his blows crush a held guard. */
const IRON: readonly LeanKnob[] = [...READS_YOU, "bossRegen", "blockPosture", "cutPostureArmoured", "cutPostureOpen"];

export const BOSSES: Record<BossId, BossDef> = {
  1: {
    id: 1,
    chapter: "I",
    jp: "鬼影 正虎",
    latin: "Onikage Masatora",
    epithet: "The Garden Duelist",
    arena: 1,
    gate: 3,
    moves: BOSS_MOVES[1],
    look: "ronin",
    line: "Win three duels in a row to meet the next general.",
  },
  2: {
    id: 2,
    chapter: "II",
    jp: "風の巴",
    latin: "Kaze-no-Tomoe",
    epithet: "The Reed Duelist",
    arena: 2,
    gate: 6,
    moves: BOSS_MOVES[2],
    picks: {
      p1: { combo: 0.16, comboDelay: 0.2, overhead: 0.08, thrust: 0.1, sweep: 0.06, grab: 0.04, windSlash: 0.22, waterfowl: 0.1, idle: 0.04 },
      p2: { flurry: 0.14, combo: 0.1, comboDelay: 0.16, overhead: 0.06, thrust: 0.1, sweep: 0.06, grab: 0.06, windSlash: 0.16, waterfowl: 0.14, idle: 0.02 },
    },
    tempoP2: 1.08,
    gapStep: 2,
    lean: { amount: 0.35, knobs: READS_YOU },
    look: "reed",
    line: "Win six duels in a row to face the Hollow Shogun.",
  },
  3: {
    id: 3,
    chapter: "III",
    jp: "空洞の将軍",
    latin: "The Hollow Shogun",
    epithet: "The Last Duel",
    arena: 3,
    gate: 0,
    moves: BOSS_MOVES[3],
    picks: {
      p1: { combo: 0.12, comboDelay: 0.2, overhead: 0.2, thrust: 0.08, sweep: 0.12, grab: 0.08, shockwave: 0.14, windSlash: 0.04, idle: 0.02 },
      p2: { flurry: 0.08, combo: 0.08, comboDelay: 0.16, overhead: 0.14, thrust: 0.08, sweep: 0.12, grab: 0.1, shockwave: 0.16, windSlash: 0.06, idle: 0.02 },
    },
    tempoP2: 1.12,
    gapStep: 3,
    lean: { amount: 0.6, knobs: IRON },
    look: "hollow",
    line: "No one has seen the end of this fight.",
  },
};

const normalise = (w: Record<string, number>): Record<string, number> => {
  const total = Object.values(w).reduce((a, b) => a + b, 0);
  return Object.fromEntries(Object.entries(w).map(([k, v]) => [k, v / total]));
};

type Range = [number, number];
const harder = (base: Range, to: Range): Range => [Math.min(base[0], to[0]), Math.min(base[1], to[1])];

/** Pure: the boss's own tuning on top of the chosen difficulty preset. Only ever harder, never past the tested bounds. */
export function bossKnobs(def: BossDef, base: DifficultyValues): DifficultyValues {
  const k = structuredClone(base);
  if (def.picks) {
    k.picks.p1 = normalise(def.picks.p1);
    k.picks.p2 = normalise(def.picks.p2);
  }
  if (def.tempoP2) k.tempo = [base.tempo[0], Math.min(1.12, Math.max(base.tempo[1], def.tempoP2))];
  if (def.gapStep) {
    const g = GAP_BY_STEP[def.gapStep];
    k.gap = { p1: harder(base.gap.p1, g.p1), p2: harder(base.gap.p2, g.p2) };
  }
  if (def.lean) {
    const hard = DIFFICULTY_PRESETS.hard as Record<string, unknown>;
    const out = k as unknown as Record<string, unknown>;
    const mix = (a: number, b: number) => a + (b - a) * def.lean!.amount;
    for (const knob of def.lean.knobs) {
      const a = out[knob], b = hard[knob];
      out[knob] = Array.isArray(a) ? a.map((v: number, i: number) => mix(v, (b as number[])[i])) : mix(a as number, b as number);
    }
  }
  return k;
}