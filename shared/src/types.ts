export const MOVES = ["leap", "combo", "comboDelay", "overhead", "thrust", "sweep", "grab", "flurry"] as const;
export type Move = (typeof MOVES)[number];

export const HABITS = ["block_holder", "deflect_expert", "dodge_spammer", "jump_dependent", "heal_greedy", "passive", "aggressive"] as const;
export type HabitId = (typeof HABITS)[number];

export type Level3 = "low" | "normal" | "high";

/** One fight, as numbers. Built in the browser from the game's DuelStats (see game/src/learn/summary.ts). */
export interface StatsSummary {
  fightSeconds: number;
  deflects: number;
  lateDeflects: number;
  blocks: number;
  hitsTaken: number;
  dodged: number;
  playerHits: number;
  sweepsJumped: number;
  grabbed: number;
  grabsEvaded: number;
  heals: number;
  firstHealAtSeconds: number | null;
  /** Median seconds between guard press and blade contact on perfect deflects (+ = early). */
  medianDeflectTiming: number | null;
  victory: boolean;
  deaths: number;
  hitsByMove: Partial<Record<Move, number>>;
}

export interface HabitScore {
  habit: HabitId;
  /** 0..1, how far past the habit's threshold. */
  strength: number;
  evidence: string;
}

export interface Plan {
  focus_habit: HabitId | "none";
  opening_strings: Move[][];
  emphasis: Record<Move, Level3>;
  tempo_step: 0 | 1 | 2 | 3 | 4;
  gap_step: 0 | 1 | 2 | 3;
  intel: string;
  taunt: string;
}

