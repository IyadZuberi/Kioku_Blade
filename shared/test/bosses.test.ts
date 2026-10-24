import { describe, expect, it } from "vitest";
import { ACCEPTED_COUNTERS } from "../src/habits";
import { BOSS_IDS, BOSS_MOVES, bossOf, movesFor } from "../src/bosses";
import { MOVES, HABITS } from "../src/types";
import { limitsForLevel, rulesPlan, validatePlan } from "../src/plan";

describe("boss move sets", () => {
  it("boss 1 keeps the base game's eight moves; later bosses add to them", () => {
    expect(BOSS_MOVES[1]).toEqual(["leap", "combo", "comboDelay", "overhead", "thrust", "sweep", "grab", "flurry"]);
    expect(BOSS_MOVES[2]).toEqual(expect.arrayContaining([...BOSS_MOVES[1], "windSlash", "waterfowl"]));
    expect(BOSS_MOVES[3]).toEqual(expect.arrayContaining([...BOSS_MOVES[1], "shockwave"]));
  });
  it("every boss move is a known move and the union covers every move", () => {
    for (const id of BOSS_IDS) for (const m of BOSS_MOVES[id]) expect(MOVES).toContain(m);
    expect(new Set(BOSS_IDS.flatMap((i) => BOSS_MOVES[i]))).toEqual(new Set(MOVES));
  });
  it("bossOf clamps junk to boss 1", () => {
    expect(bossOf(2)).toBe(2);
    expect(bossOf(7)).toBe(1);
    expect(bossOf("x")).toBe(1);
    expect(bossOf(undefined)).toBe(1);
  });
  it("movesFor returns a copy for the boss", () => {
    expect(movesFor(3)).toEqual(BOSS_MOVES[3]);
    expect(movesFor(3)).not.toBe(BOSS_MOVES[3]);
  });
});

describe("counters stay inside the move list", () => {
  it("every accepted counter is a real move", () => {
    for (const h of HABITS) for (const m of ACCEPTED_COUNTERS[h]) expect(MOVES).toContain(m);
  });
});

describe("validatePlan with a boss's move set", () => {
  const habit = (h: (typeof HABITS)[number]) => [{ habit: h, strength: 0.8, evidence: "x" }];
  it("a move the boss does not have is dropped and reported", () => {
    const plan = { ...rulesPlan([], 5), opening_strings: [["combo", "windSlash"]] as any };
    const r = validatePlan(plan, limitsForLevel(5), undefined, movesFor(1));
    expect(r.failures).toContain("bad_move");
    expect(r.plan.opening_strings).toEqual([["combo"]]);
  });
  it("the same plan is fine for boss 2", () => {
    const plan = { ...rulesPlan([], 5), opening_strings: [["combo", "windSlash"]] as any };
    expect(validatePlan(plan, limitsForLevel(5), undefined, movesFor(2)).failures).toEqual([]);
  });
  it("the rules plan only uses the boss's moves", () => {
    for (const id of BOSS_IDS)
      for (const h of HABITS) {
        const p = rulesPlan(habit(h), 8, movesFor(id));
        for (const s of p.opening_strings) for (const m of s) expect(BOSS_MOVES[id]).toContain(m);
        expect(validatePlan(p, limitsForLevel(8), undefined, movesFor(id)).valid).toBe(true);
      }
  });
});