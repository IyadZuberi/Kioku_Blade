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
  /** Display name (English only; Japanese appears on the loading screen alone). */
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
  /**
   * His finisher: the clip the shinobi plays, whether it is a plunge (the blade driven into his chest)
   * or a cut, and how he falls (a segment plan for his "finished" move; none = the default kneel and fall).
   */
  finisher: { name: string; clip: string; plunge: boolean; fall?: { clip: string; from?: number; to?: number; speed?: number }[] };
  /**
   * Sekiro-style tricks he may pick on his own (not in the war council's move list: see Boss.ts VARIANT).
   * Masatora: stance. Kazemaru: lunge, backflip. Kurogane: vanish.
   */
  extra: readonly string[];
  /** How he opens a fight when the war council has no plan yet: his signature, straight away. */
  opening: readonly string[];
  look: BossLook;
  /**
   * Which body he fights in: "armoured" is the code-built o-yoroi general (lamellar armour, mask,
   * its own key-framed swordplay); "skinned" is the motion-captured body (spear and great-sword styles).
   */
  body: "armoured" | "skinned";
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
    latin: "Masatora",
    epithet: "The Garden Duelist",
    arena: 1,
    gate: 3,
    moves: BOSS_MOVES[1],
    extra: ["stance"],
    picks: {
      p1: { combo: 0.24, comboDelay: 0.1, overhead: 0.18, thrust: 0.12, sweep: 0.08, grab: 0.05, stance: 0.18, idle: 0.05 },
      p2: { flurry: 0.12, combo: 0.16, comboDelay: 0.1, overhead: 0.12, thrust: 0.12, sweep: 0.08, grab: 0.08, stance: 0.2, idle: 0.02 },
    },
    opening: ["leap", "combo", "thrust", "stance", "comboDelay", "overhead", "sweep"],
    finisher: { name: "Through the Heart", clip: "finisher", plunge: true },
    look: "ronin",
    body: "armoured",
    line: "Win three duels in a row to meet the next general.",
  },
  2: {
    id: 2,
    chapter: "II",
    latin: "Kazemaru",
    epithet: "The Spear of the Wind",
    arena: 2,
    gate: 6,
    moves: BOSS_MOVES[2],
    extra: ["lunge", "backflip"],
    opening: ["lunge", "spin", "windSlash", "backflip", "comboDelay", "spin", "waterfowl"],
    // she spins past his spear and opens him with one turning cut; he falls back into the grass
    finisher: { name: "Wind's End", clip: "attack_charged", plunge: false, fall: [{ clip: "hit_heavy", to: 0.5 }, { clip: "death", from: 0.15 }] },
    picks: {
      p1: { combo: 0.1, comboDelay: 0.12, overhead: 0.05, thrust: 0.1, sweep: 0.06, grab: 0.02, windSlash: 0.14, waterfowl: 0.08, spin: 0.12, lunge: 0.1, backflip: 0.09, idle: 0.02 },
      p2: { flurry: 0.1, combo: 0.06, comboDelay: 0.1, overhead: 0.03, thrust: 0.1, sweep: 0.06, grab: 0.03, windSlash: 0.12, waterfowl: 0.1, spin: 0.1, lunge: 0.12, backflip: 0.1, idle: 0 },
    },
    tempoP2: 1.08,
    gapStep: 2,
    lean: { amount: 0.35, knobs: READS_YOU },
    look: "reed",
    body: "skinned",
    line: "Win six duels in a row to face Kurogane, the Hollow Shogun.",
  },
  3: {
    id: 3,
    chapter: "III",
    latin: "Kurogane",
    epithet: "The Hollow Shogun",
    arena: 3,
    gate: 0,
    moves: BOSS_MOVES[3],
    extra: ["vanish"],
    opening: ["windSlash", "vanish", "kick", "combo", "grab", "shockwave", "vanish"],
    // she leaps and cleaves down through the great helm; the shogun staggers and falls among the petals
    finisher: { name: "The Last Blossom", clip: "jump_attack", plunge: false, fall: [{ clip: "stumble", to: 0.55 }, { clip: "knockdown", from: 0.1 }] },
    picks: {
      p1: { combo: 0.08, comboDelay: 0.1, overhead: 0.16, thrust: 0.04, sweep: 0.08, grab: 0.08, shockwave: 0.1, windSlash: 0.1, kick: 0.1, vanish: 0.14, idle: 0.02 },
      p2: { flurry: 0.05, combo: 0.05, comboDelay: 0.09, overhead: 0.12, thrust: 0.04, sweep: 0.08, grab: 0.1, shockwave: 0.12, windSlash: 0.1, kick: 0.1, vanish: 0.15, idle: 0 },
    },
    tempoP2: 1.12,
    gapStep: 3,
    lean: { amount: 0.6, knobs: IRON },
    look: "hollow",
    body: "skinned",
    line: "No one has seen the end of this fight.",
  },
};

const normalise = (w: Record<string, number>): Record<string, number> => {
  const total = Object.values(w).reduce((a, b) => a + b, 0);
  return Object.fromEntries(Object.entries(w).map(([k, v]) => [k, v / total]));
};

type Range = [number, number];
const harder = (base: Range, to: Range): Range => [Math.min(base[0], to[0]), Math.min(base[1], to[1])];

/**
 * Pure: the boss's own tuning on top of the chosen difficulty preset, plus what he has LEARNED of this
 * player: `level` (0 = never fought, up to 10; see learn/remembers.ts) pulls more of his guard-and-answer
 * knobs toward the HARD preset after every duel, won or lost, and raises his tempo and shortens his gaps.
 * Only ever harder, and never past HARD (the tested, fair ceiling); deflect windows and the player's
 * damage are never touched.
 */
export function bossKnobs(def: BossDef, base: DifficultyValues, level = 0, ceiling = 1): DifficultyValues {
  const k = structuredClone(base);
  if (def.picks) {
    k.picks.p1 = normalise(def.picks.p1);
    k.picks.p2 = normalise(def.picks.p2);
  }
  const L = Math.max(0, Math.min(10, level));
  const tempoP2 = Math.max(def.tempoP2 ?? 0, L > 0 ? 1.02 + 0.01 * L : 0);
  if (tempoP2) k.tempo = [base.tempo[0], Math.min(1.12, Math.max(base.tempo[1], tempoP2))];
  const gapStep = Math.max(def.gapStep ?? 0, Math.floor(L / 3.4)) as 0 | 1 | 2 | 3;
  if (gapStep) {
    const g = GAP_BY_STEP[Math.min(3, gapStep)];
    k.gap = { p1: harder(base.gap.p1, g.p1), p2: harder(base.gap.p2, g.p2) };
  }
  // By level 10 he is at the ceiling: HARD on Hard, most of the way on Medium, about half on Easy
  const amount = Math.min(ceiling, (def.lean?.amount ?? 0) + (L / 10) * ceiling);
  if (amount > 0) {
    const knobs = new Set<LeanKnob>([...(def.lean?.knobs ?? []), ...(L > 0 ? READS_YOU : []), ...(L >= 7 ? IRON : [])]);
    const hard = DIFFICULTY_PRESETS.hard as Record<string, unknown>;
    const out = k as unknown as Record<string, unknown>;
    const mix = (a: number, b: number) => a + (b - a) * amount;
    for (const knob of knobs) {
      const a = out[knob], b = hard[knob];
      out[knob] = Array.isArray(a) ? a.map((v: number, i: number) => mix(v, (b as number[])[i])) : mix(a as number, b as number);
    }
  }
  return k;
}

/** How far learning may take him on each difficulty (1 = all the way to the HARD preset). */
export const LEARN_CEILING = { easy: 0.45, medium: 0.85, hard: 1 } as const;

/** What the General has learned, in words the player can feel (council screen, title). */
export function learnedSummary(def: BossDef, base: DifficultyValues, level: number, ceiling = 1): { parryPct: number; speedPct: number } {
  const k = bossKnobs(def, base, level, ceiling);
  return { parryPct: Math.round(k.bossDeflect[3] * 100), speedPct: Math.round((k.tempo[1] - 1) * 100) };
}
