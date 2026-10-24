import { describe, expect, it } from "vitest";
import { HABITS, MOVES } from "@gr/shared";
import { generalPlanTask, type PlanInput } from "../src/prompts/general_plan";
import { taskHash } from "../src/mubit/client";

const input: PlanInput = {
  boss: 1, bossStreak: 0,
  fight: 2, bossLevel: 3,
  stats: { fightSeconds: 60, deflects: 2, lateDeflects: 0, blocks: 14, hitsTaken: 4, dodged: 1, playerHits: 5, sweepsJumped: 0, grabbed: 0, grabsEvaded: 0, heals: 0, firstHealAtSeconds: null, medianDeflectTiming: null, victory: false, deaths: 1, hitsByMove: { combo: 3 } },
  habits: [{ habit: "block_holder", strength: 0.9, evidence: "blocked 14 times, deflected 2" }],
  playerMemory: {}, globalMemory: {}, unlocked: [...MOVES], designerRules: [],
  limits: { maxStrings: 1, maxStringLen: 2, maxTempoStep: 1, maxGapStep: 0 },
};

describe("general_plan task", () => {
  it("system prompt names every move and every habit and says JSON only", () => {
    for (const m of MOVES) expect(generalPlanTask.system).toContain(m);
    for (const h of HABITS) expect(generalPlanTask.system).toContain(h);
    expect(generalPlanTask.system).toMatch(/JSON only/);
  });
  it("system prompt carries no per-player or per-fight data (it is frozen)", () => {
    expect(generalPlanTask.system).not.toMatch(/\d{3,}/);
    expect(generalPlanTask.system).not.toContain("14 times");
  });
  it("task hash is stable across calls", () => {
    expect(taskHash(generalPlanTask)).toBe(taskHash(generalPlanTask));
  });
  it("fallback returns a valid rules plan for the input", () => {
    const p = generalPlanTask.fallback(input);
    expect(p.focus_habit).toBe("block_holder");
  });
  it("validate accepts a plan-shaped object and rejects junk", () => {
    expect(generalPlanTask.validate(generalPlanTask.fallback(input))).toBe(true);
    expect(generalPlanTask.validate({})).toBe(false);
    expect(generalPlanTask.validate(null)).toBe(false);
  });
});

