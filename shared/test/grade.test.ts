import { describe, expect, it } from "vitest";
import { ACCEPTED_COUNTERS } from "../src/habits";
import { HABITS, MOVES, type Level3, type Move, type Plan } from "../src/types";
import { agrees, gradePlan } from "../src/grade";
import { rulesPlan } from "../src/plan";

const flat = (): Record<Move, Level3> => Object.fromEntries(MOVES.map((m) => [m, "normal"])) as Record<Move, Level3>;
const P = (o: Partial<Plan>): Plan => ({ focus_habit: "none", opening_strings: [], emphasis: flat(), tempo_step: 0, gap_step: 0, intel: "i", taunt: "t", ...o });

describe("gradePlan", () => {
  it("is targetOk when focus matches and an accepted counter is high or opens a string", () => {
    const item = { label: { primary: "dodge_spammer" as const, accepted: ACCEPTED_COUNTERS.dodge_spammer } };
    expect(gradePlan(item, P({ focus_habit: "dodge_spammer", emphasis: { ...flat(), sweep: "high" } }), true).targetOk).toBe(true);
    expect(gradePlan(item, P({ focus_habit: "dodge_spammer", opening_strings: [["flurry"]] }), true).targetOk).toBe(true);
  });
  it("is not targetOk for the wrong focus, or the right focus with no counter", () => {
    const item = { label: { primary: "dodge_spammer" as const, accepted: ACCEPTED_COUNTERS.dodge_spammer } };
    expect(gradePlan(item, P({ focus_habit: "passive", emphasis: { ...flat(), sweep: "high" } }), true).targetOk).toBe(false);
    expect(gradePlan(item, P({ focus_habit: "dodge_spammer" }), true).targetOk).toBe(false);
  });
  it('label "none" is ok only when the plan also says none', () => {
    const item = { label: { primary: "none" as const, accepted: [] } };
    expect(gradePlan(item, P({}), true).targetOk).toBe(true);
    expect(gradePlan(item, P({ focus_habit: "passive" }), true).targetOk).toBe(false);
  });
  it("passes valid through", () => {
    expect(gradePlan({ label: { primary: "none", accepted: [] } }, P({}), false).valid).toBe(false);
  });
  it("the rules plan is targetOk for its own habit at every level", () => {
    for (const h of HABITS)
      for (let l = 1; l <= 10; l++)
        expect(gradePlan({ label: { primary: h, accepted: ACCEPTED_COUNTERS[h] } }, rulesPlan([{ habit: h, strength: 0.7, evidence: "x" }], l), true).targetOk, `${h} L${l}`).toBe(true);
  });
});

describe("agrees", () => {
  it("is symmetric and compares focus plus the set of high moves", () => {
    const a = P({ focus_habit: "passive", emphasis: { ...flat(), flurry: "high", leap: "high" } });
    const b = P({ focus_habit: "passive", emphasis: { ...flat(), leap: "high", flurry: "high" }, intel: "different words" });
    const c = P({ focus_habit: "passive", emphasis: { ...flat(), flurry: "high" } });
    expect(agrees(a, b)).toBe(true);
    expect(agrees(b, a)).toBe(true);
    expect(agrees(a, c)).toBe(false);
    expect(agrees(c, a)).toBe(false);
  });
});