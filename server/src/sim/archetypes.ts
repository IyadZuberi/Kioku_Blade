/** Synthetic players: parameterised fight stats for seeding and evaluating the war council (no real data). */
import { BOSS_IDS, HABITS, MOVES, computeHabits, limitsForLevel, movesFor, type HabitId, type Move, type StatsSummary } from "@gr/shared";
import type { PlanInput } from "../prompts/general_plan";

export type Archetype = HabitId | "mixed" | "none";
type Rng = () => number;

const ri = (r: Rng, a: number, b: number) => a + Math.floor(r() * (b - a + 1));
const pick = <T,>(r: Rng, xs: readonly T[]): T => xs[Math.floor(r() * xs.length)];

function baseStats(r: Rng): StatsSummary {
  const secs = ri(r, 25, 120);
  const hitsTaken = ri(r, 1, 6);
  const hitsByMove: Partial<Record<Move, number>> = {};
  for (let i = 0; i < hitsTaken; i++) {
    const m = pick(r, MOVES);
    hitsByMove[m] = (hitsByMove[m] ?? 0) + 1;
  }
  return {
    fightSeconds: secs,
    deflects: ri(r, 0, 3),
    lateDeflects: ri(r, 0, 1),
    blocks: ri(r, 0, 3),
    hitsTaken,
    dodged: ri(r, 0, 3),
    playerHits: ri(r, Math.round(secs * 0.2), Math.round(secs * 0.35)),
    sweepsJumped: ri(r, 0, 1),
    grabbed: ri(r, 0, 2),
    grabsEvaded: ri(r, 0, 2),
    heals: ri(r, 0, 1),
    firstHealAtSeconds: null,
    medianDeflectTiming: null,
    victory: r() < 0.3,
    deaths: ri(r, 0, 1),
    hitsByMove,
  };
}

const TWEAK: Record<HabitId, (s: StatsSummary, r: Rng) => void> = {
  block_holder: (s, r) => ((s.blocks = ri(r, 8, 24)), (s.deflects = ri(r, 0, 3))),
  deflect_expert: (s, r) => ((s.deflects = ri(r, 8, 20)), (s.blocks = ri(r, 0, 2)), (s.hitsTaken = ri(r, 0, 3)), (s.medianDeflectTiming = ri(r, 5, 12) / 100)),
  dodge_spammer: (s, r) => (s.dodged = ri(r, 9, 18)),
  jump_dependent: (s, r) => (s.sweepsJumped = ri(r, 4, 8)),
  heal_greedy: (s, r) => ((s.heals = ri(r, 3, 5)), (s.firstHealAtSeconds = ri(r, 3, 25))),
  passive: (s, r) => ((s.fightSeconds = ri(r, 40, 120)), (s.playerHits = ri(r, 0, Math.round(s.fightSeconds * 0.06)))),
  aggressive: (s, r) => ((s.fightSeconds = ri(r, 40, 70)), (s.playerHits = ri(r, 24, 40)), (s.hitsTaken = ri(r, 5, 10)), (s.blocks = ri(r, 0, 2)), (s.deflects = ri(r, 0, 2))),
};

function noneStats(r: Rng): StatsSummary {
  const s = baseStats(r);
  s.fightSeconds = ri(r, 8, 19);
  s.deflects = ri(r, 0, 4);
  s.blocks = ri(r, 0, 3);
  s.dodged = ri(r, 0, 4);
  s.sweepsJumped = ri(r, 0, 1);
  s.heals = ri(r, 0, 1);
  s.playerHits = ri(r, 0, 7);
  s.hitsTaken = ri(r, 0, 2);
  s.hitsByMove = {};
  return s;
}

/** One fight for an archetype. Rejection-sampled so the archetype really is the top habit ("none": no habit). */
export function genStats(a: Archetype, r: Rng): StatsSummary {
  let s = baseStats(r);
  for (let tries = 0; tries < 60; tries++) {
    if (a === "none") s = noneStats(r);
    else {
      s = baseStats(r);
      if (a === "mixed") {
        const two = [pick(r, HABITS), pick(r, HABITS)];
        for (const h of two) TWEAK[h](s, r);
      } else TWEAK[a](s, r);
    }
    const top = computeHabits(s)[0]?.habit;
    if (a === "mixed" || (a === "none" ? top === undefined : top === a)) return s;
  }
  return s;
}

const RULE_POOL = [
  "Never exceed the string limits in limits.",
  "When the player blocks often, favour thrust or grab.",
  "Do not repeat the same opening string twice in a row.",
  "If the player won easily, raise tempo_step by one within the limits.",
];

export function genInput(a: Archetype, r: Rng, i: number): PlanInput {
  const stats = genStats(a, r);
  const habits = computeHabits(stats);
  const level = ri(r, 1, 10);
  const fight = ri(r, 1, 6);
  const losses = ri(r, 0, fight);
  const rules = RULE_POOL.filter(() => r() < 0.3).slice(0, 3);
  void i;
  const boss = BOSS_IDS[ri(r, 0, BOSS_IDS.length - 1)];
  return {
    boss,
    bossStreak: ri(r, 0, boss === 1 ? 2 : boss === 2 ? 5 : 3),
    fight,
    bossLevel: level,
    stats,
    habits,
    playerMemory: {
      fights: fight - 1,
      wins: Math.max(0, fight - 1 - losses),
      losses,
      consecutive_losses: Math.min(losses, ri(r, 0, 3)),
      habit_avgs: Object.fromEntries(habits.map((h) => [h.habit, +(h.strength * (0.6 + r() * 0.4)).toFixed(2)])),
    },
    globalMemory: {
      totalFights: ri(r, 0, 80),
      habitPrevalence: Object.fromEntries(HABITS.map((h) => [h, +(r() * 0.4).toFixed(2)])),
      moveHits: Object.fromEntries(MOVES.map((m) => [m, ri(r, 0, 60)])),
    },
    unlocked: movesFor(boss),
    designerRules: rules,
    limits: limitsForLevel(level),
  };
}