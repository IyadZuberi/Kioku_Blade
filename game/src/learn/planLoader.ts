import { GAP_BY_STEP, TEMPO_P2_BY_STEP, applyEmphasis, type Move, type Plan } from "@gr/shared";
import { DIFFICULTY, overrideDifficulty, type DifficultyValues } from "../game/difficulty";

type Range = [number, number];
const harder = (base: Range, plan: Range | undefined): Range => (plan ? [Math.min(base[0], plan[0]), Math.min(base[1], plan[1])] : base);

/**
 * Pure: map a plan's enums onto the base's knobs. Step 0 means "no change"; a plan can only make
 * him faster and give fewer openings (never slower), and it never touches the deflect windows,
 * the player's damage, or phase-1 tempo (the base's combo lunges are tuned to 1).
 */
export function planToKnobs(plan: Plan, base: DifficultyValues): { knobs: DifficultyValues; strings: Move[][] } {
  const k = structuredClone(base);
  k.picks.p1 = applyEmphasis(base.picks.p1, plan.emphasis);
  k.picks.p2 = applyEmphasis(base.picks.p2, plan.emphasis);
  if (plan.tempo_step > 0) k.tempo = [base.tempo[0], Math.max(base.tempo[1], TEMPO_P2_BY_STEP[plan.tempo_step] ?? base.tempo[1])];
  if (plan.gap_step > 0) {
    const g = GAP_BY_STEP[plan.gap_step];
    k.gap = { p1: harder(base.gap.p1, g?.p1), p2: harder(base.gap.p2, g?.p2) };
  }
  return { knobs: k, strings: plan.opening_strings };
}

/** Load a plan into the live DIFFICULTY (in place) and give the boss its opening script. */
export function applyPlan(plan: Plan, boss: { setOpening(strings: Move[][]): void }): void {
  const { knobs, strings } = planToKnobs(plan, structuredClone(DIFFICULTY));
  overrideDifficulty(knobs);
  boss.setOpening(strings);
}
