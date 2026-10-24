import { describe, expect, it } from "vitest";
import { computeHabits } from "../src/habits";
import type { StatsSummary } from "../src/types";

const base: StatsSummary = {
  fightSeconds: 0, deflects: 0, lateDeflects: 0, blocks: 0, hitsTaken: 0, dodged: 0, playerHits: 0,
  sweepsJumped: 0, grabbed: 0, grabsEvaded: 0, heals: 0, firstHealAtSeconds: null,
  medianDeflectTiming: null, victory: false, deaths: 0, hitsByMove: {},
};
const s = (o: Partial<StatsSummary>): StatsSummary => ({ ...base, ...o });

describe("computeHabits", () => {
  it("idle player returns [] without NaN", () => {
    expect(computeHabits(base)).toEqual([]);
  });
  it("block-heavy stats put block_holder first with strength in (0,1]", () => {
    const h = computeHabits(s({ fightSeconds: 60, blocks: 14, deflects: 2, hitsTaken: 4, playerHits: 5 }));
    expect(h[0].habit).toBe("block_holder");
    expect(h[0].strength).toBeGreaterThan(0);
    expect(h[0].strength).toBeLessThanOrEqual(1);
  });
  it("dodge-heavy stats rank dodge_spammer first", () => {
    expect(computeHabits(s({ fightSeconds: 60, dodged: 12, playerHits: 6, blocks: 2, deflects: 2 }))[0].habit).toBe("dodge_spammer");
  });
  it("jump-heavy stats rank jump_dependent first", () => {
    expect(computeHabits(s({ fightSeconds: 60, sweepsJumped: 6, playerHits: 6, blocks: 2, deflects: 2 }))[0].habit).toBe("jump_dependent");
  });
  it("strengths never exceed 1 for huge inputs and never go NaN", () => {
    const h = computeHabits(s({ fightSeconds: 1e9, blocks: 1e9, deflects: 1e9, dodged: 1e9, sweepsJumped: 1e9, heals: 1e9, playerHits: 1e9, hitsTaken: 1e9 }));
    for (const x of h) {
      expect(Number.isFinite(x.strength)).toBe(true);
      expect(x.strength).toBeLessThanOrEqual(1);
    }
    expect(h.length).toBeLessThanOrEqual(3);
  });
  it("deflect_expert needs a high deflect share", () => {
    const h = computeHabits(s({ fightSeconds: 70, deflects: 14, blocks: 1, hitsTaken: 2, playerHits: 10, medianDeflectTiming: 0.08 }));
    expect(h[0].habit).toBe("deflect_expert");
  });
  it("passive: a long fight with almost no player hits", () => {
    expect(computeHabits(s({ fightSeconds: 80, playerHits: 2, blocks: 3, deflects: 1 }))[0].habit).toBe("passive");
  });
  it("evidence strings contain the real numbers", () => {
    const h = computeHabits(s({ fightSeconds: 60, blocks: 14, deflects: 2, hitsTaken: 4, playerHits: 5 }));
    expect(h[0].evidence).toContain("14");
    expect(h[0].evidence).toContain("2");
  });
  it("negative or missing values are treated as zero", () => {
    expect(() => computeHabits(s({ blocks: -5, deflects: -1, fightSeconds: -3 }))).not.toThrow();
  });
});

