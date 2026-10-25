import { describe, expect, it } from "vitest";
import { DIFFICULTY_PRESETS } from "../src/game/difficulty";
import { BOSSES, bossKnobs, learnedSummary } from "../src/game/bosses";
import { NOTHING, levelOf, loadMemory, remember, saveMemory } from "../src/learn/remembers";

const mem = () => {
  const m = new Map<string, string>();
  return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v) };
};

describe("remembers", () => {
  it("counts every duel, won or lost, and the level rises with each", () => {
    let m = NOTHING;
    expect(levelOf(m)).toBe(0);
    const lv: number[] = [];
    for (const v of [false, true, false, false]) {
      m = remember(m, v);
      lv.push(levelOf(m));
    }
    expect(lv).toEqual([4, 6, 8, 10]);
  });
  it("holds the level after three losses in a row and never lowers it", () => {
    let m = NOTHING;
    const lv: number[] = [];
    for (let i = 0; i < 5; i++) {
      m = remember(m, false);
      lv.push(levelOf(m));
    }
    expect(lv).toEqual([4, 6, 6, 6, 6]);
    expect(lv.every((x, i) => i === 0 || x >= lv[i - 1])).toBe(true);
  });
  it("survives a reload and ignores junk in storage", () => {
    const s = mem();
    saveMemory("Kenji", { fights: 3, wins: 1, losses: 2, consecutive_losses: 2 }, s);
    expect(loadMemory("Kenji", s)).toEqual({ fights: 3, wins: 1, losses: 2, consecutive_losses: 2 });
    s.setItem("kioku.memory.X", "{not json");
    expect(loadMemory("X", s)).toEqual(NOTHING);
    s.setItem("kioku.memory.Y", JSON.stringify({ fights: -4, wins: "a" }));
    expect(loadMemory("Y", s)).toEqual(NOTHING);
  });
});

describe("what he has learned", () => {
  const base = DIFFICULTY_PRESETS.medium;
  it("level 0 changes nothing for the first general", () => {
    expect(bossKnobs(BOSSES[1], structuredClone(base), 0)).toEqual(bossKnobs(BOSSES[1], structuredClone(base)));
  });
  it("every general parries more, answers faster, recovers less and moves faster at each level, never past HARD", () => {
    const hard = DIFFICULTY_PRESETS.hard;
    for (const id of [1, 2, 3] as const) {
      let prev = bossKnobs(BOSSES[id], structuredClone(base), 0);
      for (const level of [4, 6, 8, 10]) {
        const k = bossKnobs(BOSSES[id], structuredClone(base), level);
        expect(k.bossDeflect[3]).toBeGreaterThanOrEqual(prev.bossDeflect[3]);
        expect(k.counterDelay).toBeLessThanOrEqual(prev.counterDelay);
        expect(k.recoverAfterAttack[0]).toBeLessThanOrEqual(prev.recoverAfterAttack[0]);
        expect(k.tempo[1]).toBeGreaterThanOrEqual(prev.tempo[1]);
        expect(k.gap.p2[0]).toBeLessThanOrEqual(prev.gap.p2[0]);
        // bounds: HARD is the fair ceiling; the player's windows and damage never move
        expect(k.bossDeflect[3]).toBeLessThanOrEqual(hard.bossDeflect[3]);
        expect(k.tempo[1]).toBeLessThanOrEqual(1.12);
        expect(k.gap.p2[0]).toBeGreaterThanOrEqual(hard.gap.p2[0]);
        expect(k.deflectEarly).toBe(base.deflectEarly);
        expect(k.deflectSteps).toEqual(base.deflectSteps);
        expect(k.playerDamage).toBe(base.playerDamage);
        prev = k;
      }
    }
  });
  it("by level 10 the first general parries and moves like the HARD preset's, and it is visible in numbers", () => {
    const a = learnedSummary(BOSSES[1], base, 0);
    const b = learnedSummary(BOSSES[1], base, 10);
    expect(b.parryPct).toBeGreaterThan(a.parryPct + 15);
    expect(b.speedPct).toBeGreaterThan(a.speedPct);
  });
  it("a plan from the server can only add pressure on top of what he learned (planToKnobs is monotonic)", async () => {
    const { planToKnobs } = await import("../src/learn/planLoader");
    const { rulesPlan } = await import("@gr/shared");
    const learned = bossKnobs(BOSSES[3], structuredClone(base), 8);
    const { knobs } = planToKnobs({ ...rulesPlan([], 8), tempo_step: 2, gap_step: 1 }, learned);
    expect(knobs.tempo[1]).toBeGreaterThanOrEqual(learned.tempo[1]);
    expect(knobs.gap.p1[0]).toBeLessThanOrEqual(learned.gap.p1[0]);
  });
});
