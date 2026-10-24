import type { HabitId, HabitScore, Move, StatsSummary } from "./types";

/** Moves that count as a correct answer to each habit (used by the grader and the rules plan). */
export const ACCEPTED_COUNTERS: Record<HabitId, Move[]> = {
  block_holder: ["thrust", "grab", "flurry"],
  deflect_expert: ["comboDelay", "flurry", "windSlash"],
  dodge_spammer: ["sweep", "flurry", "waterfowl"],
  jump_dependent: ["overhead", "thrust"],
  heal_greedy: ["leap", "combo", "windSlash"],
  passive: ["flurry", "leap", "windSlash"],
  aggressive: ["comboDelay", "thrust"],
};

// Thresholds are design values, tuned in playtests. One place on purpose.
const T = {
  blockMinCount: 4,
  blockShare: 0.6,
  deflectMinCount: 5,
  deflectShare: 0.4,
  dodgeMin: 5,
  jumpMin: 2,
  healMin: 2,
  passiveMinSeconds: 20,
  passiveHitsPerSec: 0.15,
  aggressiveMinHits: 8,
  aggressiveMinTaken: 3,
  aggressiveShare: 0.6,
};

const clip01 = (x: number) => (Number.isFinite(x) ? Math.min(1, Math.max(0, x)) : 0);
const nz = (x: number) => (Number.isFinite(x) && x > 0 ? x : 0);

export function computeHabits(raw: StatsSummary): HabitScore[] {
  const blocks = nz(raw.blocks);
  const deflects = nz(raw.deflects);
  const hitsTaken = nz(raw.hitsTaken);
  const dodged = nz(raw.dodged);
  const playerHits = nz(raw.playerHits);
  const jumped = nz(raw.sweepsJumped);
  const heals = nz(raw.heals);
  const secs = nz(raw.fightSeconds);

  const out: HabitScore[] = [];
  const add = (habit: HabitId, strength: number, evidence: string) => {
    const s = clip01(strength);
    if (s > 0) out.push({ habit, strength: s, evidence });
  };

  const guards = blocks + deflects;
  if (blocks >= T.blockMinCount && guards > 0)
    add("block_holder", (blocks / guards - T.blockShare) / (1 - T.blockShare), `blocked ${blocks} times, deflected ${deflects}`);

  const defl = deflects + blocks + hitsTaken;
  if (deflects >= T.deflectMinCount && defl > 0)
    add("deflect_expert", (deflects / defl - T.deflectShare) / (1 - T.deflectShare), `deflected ${deflects} blows, blocked ${blocks}`);

  if (dodged >= T.dodgeMin) add("dodge_spammer", (dodged - (T.dodgeMin - 1)) / 8, `dodged ${dodged} times`);

  if (jumped >= T.jumpMin) add("jump_dependent", (jumped - (T.jumpMin - 1)) / 4, `jumped ${jumped} sweeps`);

  if (heals >= T.healMin) add("heal_greedy", (heals - (T.healMin - 1)) / 3, `drank the gourd ${heals} times`);

  if (secs >= T.passiveMinSeconds) {
    const rate = playerHits / secs;
    add("passive", (T.passiveHitsPerSec - rate) / T.passiveHitsPerSec, `landed only ${playerHits} cuts in ${Math.round(secs)} s`);
  }

  const offence = playerHits + blocks + deflects;
  if (playerHits >= T.aggressiveMinHits && hitsTaken >= T.aggressiveMinTaken && offence > 0)
    add("aggressive", (playerHits / offence - T.aggressiveShare) / (1 - T.aggressiveShare), `landed ${playerHits} cuts but took ${hitsTaken} hits`);

  return out.sort((a, b) => b.strength - a.strength).slice(0, 3);
}
