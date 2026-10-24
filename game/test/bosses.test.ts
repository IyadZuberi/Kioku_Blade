import { describe, expect, it } from "vitest";
import { BOSS_IDS, BOSS_MOVES } from "@gr/shared";
import { DIFFICULTY_PRESETS } from "../src/game/difficulty";
import { BOSSES, bossKnobs } from "../src/game/bosses";
import { afterFight, fresh, select, type Progress } from "../src/game/progress";

const sum = (r: Record<string, number>) => Object.values(r).reduce((a, b) => a + b, 0);

describe("boss registry", () => {
  it("has three bosses in order with their own arena and the shared move sets", () => {
    expect(BOSS_IDS.map((i) => BOSSES[i].arena)).toEqual([1, 2, 3]);
    for (const id of BOSS_IDS) expect(BOSSES[id].moves).toEqual(BOSS_MOVES[id]);
  });
  it("gates are 3 wins, then 6, then none", () => {
    expect([BOSSES[1].gate, BOSSES[2].gate, BOSSES[3].gate]).toEqual([3, 6, 0]);
  });
  it("names are distinct", () => {
    expect(new Set(BOSS_IDS.map((i) => BOSSES[i].latin)).size).toBe(3);
    expect(new Set(BOSS_IDS.map((i) => BOSSES[i].epithet)).size).toBe(3);
  });
});

describe("bossKnobs", () => {
  it("boss 1 leaves the preset untouched", () => {
    for (const name of ["easy", "medium", "hard"] as const) {
      const base = structuredClone(DIFFICULTY_PRESETS[name]);
      expect(bossKnobs(BOSSES[1], base)).toEqual(base);
    }
  });
  it("never touches the deflect windows or the player's damage, for any boss or preset", () => {
    for (const id of BOSS_IDS)
      for (const name of ["easy", "medium", "hard"] as const) {
        const base = structuredClone(DIFFICULTY_PRESETS[name]);
        const k = bossKnobs(BOSSES[id], base);
        expect(k.deflectEarly).toBe(base.deflectEarly);
        expect(k.deflectLate).toBe(base.deflectLate);
        expect(k.deflectSteps).toEqual(base.deflectSteps);
        expect(k.playerDamage).toBe(base.playerDamage);
        expect(k.tempo[0]).toBe(base.tempo[0]);
      }
  });
  it("pick weights only name moves the boss has (plus idle) and sum to 1", () => {
    for (const id of BOSS_IDS) {
      const k = bossKnobs(BOSSES[id], structuredClone(DIFFICULTY_PRESETS.medium));
      for (const ph of ["p1", "p2"] as const) {
        expect(sum(k.picks[ph])).toBeCloseTo(1, 9);
        for (const key of Object.keys(k.picks[ph])) if (key !== "idle") expect(BOSS_MOVES[id]).toContain(key);
      }
    }
  });
  it("later bosses are never easier: phase-2 tempo not lower, gaps not longer, never past the HARD floor", () => {
    const hard = DIFFICULTY_PRESETS.hard;
    for (const id of [2, 3] as const) {
      const base = structuredClone(DIFFICULTY_PRESETS.medium);
      const k = bossKnobs(BOSSES[id], base);
      expect(k.tempo[1]).toBeGreaterThanOrEqual(base.tempo[1]);
      expect(k.tempo[1]).toBeLessThanOrEqual(1.12);
      for (const ph of ["p1", "p2"] as const)
        for (const i of [0, 1] as const) {
          expect(k.gap[ph][i]).toBeLessThanOrEqual(base.gap[ph][i]);
          expect(k.gap[ph][i]).toBeGreaterThanOrEqual(hard.gap[ph][i]);
        }
    }
  });
  it("each later general is harder on the style knobs, and never past the HARD preset", () => {
    const base = structuredClone(DIFFICULTY_PRESETS.medium);
    const hard = DIFFICULTY_PRESETS.hard;
    const [k1, k2, k3] = BOSS_IDS.map((id) => bossKnobs(BOSSES[id], structuredClone(base)));
    // lower is harder for these (fewer openings, faster answers, less of his posture per cut)
    const lowerHarder = (k: typeof base) => [k.recoverAfterAttack[0], k.recoverAfterAttack[1], k.counterDelay, k.guardSlip[0], k.healReact, k.cutPostureArmoured];
    // higher is harder for these
    const higherHarder = (k: typeof base) => [k.bossDeflect[3], k.counterFlurry, k.bossRegen, k.blockPosture];
    const a = [lowerHarder(k1), lowerHarder(k2), lowerHarder(k3)];
    const b = [higherHarder(k1), higherHarder(k2), higherHarder(k3)];
    for (let i = 0; i < a[0].length; i++) {
      expect(a[1][i]).toBeLessThanOrEqual(a[0][i]);
      expect(a[2][i]).toBeLessThanOrEqual(a[1][i]);
      expect(a[2][i]).toBeGreaterThanOrEqual(lowerHarder(hard)[i]);
    }
    for (let i = 0; i < b[0].length; i++) {
      expect(b[1][i]).toBeGreaterThanOrEqual(b[0][i]);
      expect(b[2][i]).toBeGreaterThanOrEqual(b[1][i]);
      expect(b[2][i]).toBeLessThanOrEqual(higherHarder(hard)[i]);
    }
    // and strictly harder somewhere: a real step up each chapter
    expect(a[1].some((v, i) => v < a[0][i]) || b[1].some((v, i) => v > b[0][i])).toBe(true);
    expect(a[2].some((v, i) => v < a[1][i]) || b[2].some((v, i) => v > b[1][i])).toBe(true);
  });
  it("does not mutate its input", () => {
    const base = structuredClone(DIFFICULTY_PRESETS.medium);
    const copy = structuredClone(base);
    bossKnobs(BOSSES[3], base);
    expect(base).toEqual(copy);
  });
});

describe("progress", () => {
  const win = (p: Progress) => afterFight(p, true);
  const lose = (p: Progress) => afterFight(p, false);
  it("starts on boss 1 with nothing unlocked beyond it", () => {
    expect(fresh()).toEqual({ boss: 1, streak: 0, unlocked: 1, cleared: false });
  });
  it("three wins in a row on boss 1 open boss 2", () => {
    let p = fresh();
    let r = win(p);
    expect(r.advanced).toBe(false);
    r = win(r.next);
    expect(r.next.streak).toBe(2);
    r = win(r.next);
    expect(r.advanced).toBe(true);
    expect(r.next).toMatchObject({ boss: 2, streak: 0, unlocked: 2 });
  });
  it("a loss resets the streak and keeps the boss", () => {
    let p: Progress = { boss: 1, streak: 2, unlocked: 1, cleared: false };
    const r = lose(p);
    expect(r.next).toMatchObject({ boss: 1, streak: 0 });
    expect(r.advanced).toBe(false);
    p = { boss: 2, streak: 5, unlocked: 2, cleared: false };
    expect(lose(p).next).toMatchObject({ boss: 2, streak: 0 });
  });
  it("six in a row on boss 2 open boss 3, and five do not", () => {
    let p: Progress = { boss: 2, streak: 0, unlocked: 2, cleared: false };
    for (let i = 0; i < 5; i++) p = win(p).next;
    expect(p).toMatchObject({ boss: 2, streak: 5 });
    const r = win(p);
    expect(r.advanced).toBe(true);
    expect(r.next).toMatchObject({ boss: 3, streak: 0, unlocked: 3 });
  });
  it("beating boss 3 clears the game and keeps counting", () => {
    const r = win({ boss: 3, streak: 0, unlocked: 3, cleared: false });
    expect(r.next).toMatchObject({ boss: 3, streak: 1, cleared: true });
    expect(r.advanced).toBe(false);
  });
  it("select only allows unlocked bosses and resets the streak", () => {
    const p: Progress = { boss: 2, streak: 4, unlocked: 2, cleared: false };
    expect(select(p, 1)).toMatchObject({ boss: 1, streak: 0, unlocked: 2 });
    expect(select(p, 3)).toEqual(p);
    expect(select(p, 2)).toMatchObject({ boss: 2, streak: 4 });
  });
  it("replaying an earlier boss keeps what was unlocked", () => {
    let p = select({ boss: 3, streak: 0, unlocked: 3, cleared: true }, 1);
    for (let i = 0; i < 3; i++) p = win(p).next;
    expect(p.boss).toBe(2);
    expect(p.unlocked).toBe(3);
  });
});