import { describe, expect, it } from "vitest";
import { GAP_BY_STEP, MOVES, TEMPO_P2_BY_STEP, rulesPlan, type Plan } from "@gr/shared";
import { DIFFICULTY_PRESETS } from "../src/game/difficulty";
import { applyPlan, planToKnobs } from "../src/learn/planLoader";

const plan = (o: Partial<Plan> = {}): Plan => ({ ...rulesPlan([{ habit: "block_holder", strength: 1, evidence: "x" }], 10), ...o });
const sum = (r: Record<string, number>) => Object.values(r).reduce((a, b) => a + b, 0);

describe("planToKnobs", () => {
  it("never changes the deflect knobs", () => {
    for (const name of ["easy", "medium", "hard"] as const)
      for (let t = 0; t <= 4; t++) {
        const base = structuredClone(DIFFICULTY_PRESETS[name]);
        const { knobs } = planToKnobs(plan({ tempo_step: t as Plan["tempo_step"], gap_step: Math.min(t, 3) as Plan["gap_step"] }), base);
        expect(knobs.deflectEarly).toBe(base.deflectEarly);
        expect(knobs.deflectLate).toBe(base.deflectLate);
        expect(knobs.deflectSteps).toEqual(base.deflectSteps);
        expect(knobs.playerDamage).toBe(base.playerDamage);
      }
  });
  it("tempo[0] stays the base value; tempo[1] is never lowered and never above 1.12", () => {
    for (const name of ["easy", "medium", "hard"] as const)
      for (let t = 0; t <= 4; t++) {
        const base = structuredClone(DIFFICULTY_PRESETS[name]);
        const { knobs } = planToKnobs(plan({ tempo_step: t as Plan["tempo_step"] }), base);
        expect(knobs.tempo[0]).toBe(base.tempo[0]);
        expect(knobs.tempo[1]).toBeGreaterThanOrEqual(base.tempo[1]);
        expect(knobs.tempo[1]).toBeLessThanOrEqual(1.12);
      }
  });
  it("gaps are never longer than the base and never shorter than HARD", () => {
    const hard = DIFFICULTY_PRESETS.hard.gap;
    for (const name of ["easy", "medium", "hard"] as const)
      for (let g = 0; g <= 3; g++) {
        const base = structuredClone(DIFFICULTY_PRESETS[name]);
        const { knobs } = planToKnobs(plan({ gap_step: g as Plan["gap_step"] }), base);
        for (const ph of ["p1", "p2"] as const)
          for (const i of [0, 1] as const) {
            expect(knobs.gap[ph][i]).toBeLessThanOrEqual(base.gap[ph][i]);
            expect(knobs.gap[ph][i]).toBeGreaterThanOrEqual(hard[ph][i]);
          }
      }
  });
  it("shared knob tables match the base MEDIUM and HARD presets", () => {
    expect(GAP_BY_STEP[0]).toEqual(DIFFICULTY_PRESETS.medium.gap);
    expect(GAP_BY_STEP[3]).toEqual(DIFFICULTY_PRESETS.hard.gap);
    expect(Math.max(...TEMPO_P2_BY_STEP)).toBe(DIFFICULTY_PRESETS.hard.tempo[1]);
  });
  it("pick weights sum to 1 after emphasis and keep the base keys", () => {
    const base = structuredClone(DIFFICULTY_PRESETS.medium);
    const { knobs } = planToKnobs(plan(), base);
    for (const ph of ["p1", "p2"] as const) {
      expect(sum(knobs.picks[ph])).toBeCloseTo(1, 9);
      expect(Object.keys(knobs.picks[ph]).sort()).toEqual(Object.keys(base.picks[ph]).sort());
    }
  });
  it("does not mutate the base it was given", () => {
    const base = structuredClone(DIFFICULTY_PRESETS.medium);
    const copy = structuredClone(base);
    planToKnobs(plan({ tempo_step: 4, gap_step: 3 }), base);
    expect(base).toEqual(copy);
  });
  it("returns the plan's opening strings", () => {
    const { strings } = planToKnobs(plan({ opening_strings: [["sweep", "flurry"]] }), structuredClone(DIFFICULTY_PRESETS.medium));
    expect(strings).toEqual([["sweep", "flurry"]]);
  });
});

describe("applyPlan", () => {
  it("writes into the live DIFFICULTY object in place and hands the strings to the boss", async () => {
    const { DIFFICULTY } = await import("../src/game/difficulty");
    const picksRef = DIFFICULTY.picks;
    const deflectRef = DIFFICULTY.deflectSteps;
    let got: unknown = null;
    applyPlan(plan({ opening_strings: [["thrust", "grab"]], tempo_step: 4 }), { setOpening: (s) => (got = s) });
    expect(DIFFICULTY.picks).toBe(picksRef);
    expect(DIFFICULTY.deflectSteps).toBe(deflectRef);
    expect(got).toEqual([["thrust", "grab"]]);
    expect(MOVES.length).toBe(8);
  });
});