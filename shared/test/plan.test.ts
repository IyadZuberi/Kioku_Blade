import { describe, expect, it } from "vitest";
import { HABITS, MOVES, type HabitScore, type Plan } from "../src/types";
import { limitsForLevel, PLAN_SCHEMA, rulesPlan, validatePlan } from "../src/plan";

const habit = (h: (typeof HABITS)[number], strength = 0.8): HabitScore => ({ habit: h, strength, evidence: `evidence for ${h}` });
const good = (over: Partial<Plan> = {}): Plan => ({
  focus_habit: "dodge_spammer",
  opening_strings: [["sweep", "flurry"]],
  emphasis: Object.fromEntries(MOVES.map((m) => [m, "normal"])) as Plan["emphasis"],
  tempo_step: 0,
  gap_step: 0,
  intel: "You dodge a lot.",
  taunt: "Run faster.",
  ...over,
});
const L = limitsForLevel(10);

describe("limitsForLevel", () => {
  it("is monotonic and matches the spec endpoints", () => {
    expect(limitsForLevel(1)).toEqual({ maxStrings: 1, maxStringLen: 2, maxTempoStep: 0, maxGapStep: 0 });
    expect(limitsForLevel(10)).toEqual({ maxStrings: 3, maxStringLen: 4, maxTempoStep: 4, maxGapStep: 3 });
    for (let l = 1; l < 10; l++) {
      const a = limitsForLevel(l), b = limitsForLevel(l + 1);
      expect(b.maxStrings).toBeGreaterThanOrEqual(a.maxStrings);
      expect(b.maxStringLen).toBeGreaterThanOrEqual(a.maxStringLen);
      expect(b.maxTempoStep).toBeGreaterThanOrEqual(a.maxTempoStep);
      expect(b.maxGapStep).toBeGreaterThanOrEqual(a.maxGapStep);
    }
  });
  it("clamps out-of-range levels", () => {
    expect(limitsForLevel(-5)).toEqual(limitsForLevel(1));
    expect(limitsForLevel(999)).toEqual(limitsForLevel(10));
    expect(limitsForLevel(NaN)).toEqual(limitsForLevel(1));
  });
});

describe("PLAN_SCHEMA", () => {
  it("is strict and lists every field", () => {
    expect((PLAN_SCHEMA as any).additionalProperties).toBe(false);
    expect((PLAN_SCHEMA as any).required).toEqual(["focus_habit", "opening_strings", "emphasis", "tempo_step", "gap_step", "intel", "taunt"]);
  });
});

describe("validatePlan", () => {
  it("accepts the rules plan for every habit and level 1..10", () => {
    for (const h of HABITS)
      for (let lvl = 1; lvl <= 10; lvl++) {
        const p = rulesPlan([habit(h)], lvl);
        const r = validatePlan(p, limitsForLevel(lvl));
        expect(r.failures, `${h} L${lvl}`).toEqual([]);
        expect(r.valid).toBe(true);
      }
  });
  it("accepts a good plan unchanged", () => {
    const p = good();
    const r = validatePlan(p, L);
    expect(r.valid).toBe(true);
    expect(r.plan).toEqual(p);
  });
  it("rejects an illegal move with bad_move and drops it", () => {
    const r = validatePlan(good({ opening_strings: [["combo", "fireball" as any, "thrust"]] }), L);
    expect(r.failures).toContain("bad_move");
    expect(r.plan.opening_strings).toEqual([["combo", "thrust"]]);
    expect(r.valid).toBe(false);
  });
  it("50 strings clamp to maxStrings and report too_many_strings", () => {
    const r = validatePlan(good({ opening_strings: Array.from({ length: 50 }, () => ["combo"] as Plan["opening_strings"][0]) }), L);
    expect(r.failures).toContain("too_many_strings");
    expect(r.plan.opening_strings.length).toBe(L.maxStrings);
  });
  it("a string of 30 attacks clamps to maxStringLen", () => {
    const r = validatePlan(good({ opening_strings: [Array.from({ length: 30 }, () => "combo" as const)] }), L);
    expect(r.failures).toContain("string_too_long");
    expect(r.plan.opening_strings[0].length).toBe(L.maxStringLen);
  });
  it("tempo_step above the level ceiling clamps and reports step_over_limit", () => {
    const r = validatePlan(good({ tempo_step: 4, gap_step: 3 }), limitsForLevel(1));
    expect(r.failures).toContain("step_over_limit");
    expect(r.plan.tempo_step).toBe(0);
    expect(r.plan.gap_step).toBe(0);
  });
  it.each([null, "x", [], {}, 42, undefined])("never throws on %j and returns a usable plan", (bad) => {
    const fb = rulesPlan([habit("passive")], 3);
    const r = validatePlan(bad, limitsForLevel(3), fb);
    expect(r.valid).toBe(false);
    expect(r.failures.length).toBeGreaterThan(0);
    expect(r.plan.focus_habit).toBe(fb.focus_habit);
    expect(validatePlan(r.plan, limitsForLevel(3)).valid).toBe(true);
  });
  it("missing emphasis keys default to normal and report missing_emphasis", () => {
    const r = validatePlan({ ...good(), emphasis: { combo: "high" } }, L);
    expect(r.failures).toContain("missing_emphasis");
    expect(r.plan.emphasis.combo).toBe("high");
    expect(r.plan.emphasis.thrust).toBe("normal");
  });
  it("intel over 25 words truncates and reports bad_text; taunt over 12 truncates", () => {
    const long = Array.from({ length: 40 }, (_, i) => `w${i}`).join(" ");
    const r = validatePlan(good({ intel: long, taunt: long }), L);
    expect(r.failures).toContain("bad_text");
    expect(r.plan.intel.split(" ").length).toBe(25);
    expect(r.plan.taunt.split(" ").length).toBe(12);
  });
  it("wrong types for text and focus_habit are repaired", () => {
    const r = validatePlan({ ...good(), intel: 5, focus_habit: "wizard" }, L);
    expect(r.valid).toBe(false);
    expect(r.plan.focus_habit).toBe("none");
    expect(typeof r.plan.intel).toBe("string");
  });
  it("profane text is replaced and flagged", () => {
    const r = validatePlan(good({ taunt: "you fucking fool" }), L);
    expect(r.failures).toContain("bad_text");
    expect(r.plan.taunt).not.toMatch(/fuck/i);
  });
});

describe("rulesPlan", () => {
  it("with no habits is neutral and valid at every level", () => {
    for (let l = 1; l <= 10; l++) {
      const p = rulesPlan([], l);
      expect(p.focus_habit).toBe("none");
      expect(validatePlan(p, limitsForLevel(l)).valid).toBe(true);
    }
  });
  it("puts the counters of the top habit at high emphasis", () => {
    const p = rulesPlan([habit("dodge_spammer")], 5);
    expect(p.focus_habit).toBe("dodge_spammer");
    expect(p.emphasis.sweep).toBe("high");
    expect(p.emphasis.flurry).toBe("high");
  });
  it("intel mentions the real evidence and respects word limits", () => {
    const p = rulesPlan([{ habit: "block_holder", strength: 1, evidence: "blocked 14 times, deflected 2" }], 4);
    expect(p.intel).toContain("14");
    expect(p.intel.split(" ").length).toBeLessThanOrEqual(25);
    expect(p.taunt.split(" ").length).toBeLessThanOrEqual(12);
  });
});

