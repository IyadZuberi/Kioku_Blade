import { describe, expect, it } from "vitest";
import { BOSS_MOVES } from "@gr/shared";
import { LIBRARY, UNLOCKS, arsenalMoves, tacticOf, usableCombos } from "../src/learn/arsenal";
import { FRESH, behaviourOf, type Brain } from "../src/learn/brain";
import { ATTACKS, VARIANT } from "../src/game/Boss";

const PERIL = new Set(["thrust", "sweep", "grab", "lunge"]);

describe("the arsenal library", () => {
  it("every combo is made of real moves, never repeats one back to back, and says why it is hard", () => {
    const real = new Set([...Object.keys(ATTACKS), ...Object.keys(VARIANT), "spin", "kick", "stance"]);
    for (const c of LIBRARY) {
      expect(c.moves.length).toBeGreaterThanOrEqual(3);
      for (const m of c.moves) expect(real.has(m)).toBe(true);
      for (let i = 1; i < c.moves.length; i++) expect(c.moves[i]).not.toBe(c.moves[i - 1]);
      expect(c.why.length).toBeGreaterThan(20);
      expect(c.answer.length).toBeGreaterThan(10);
    }
  });
  it("each general can already play some of them, and more as he learns moves", () => {
    for (const id of [1, 2, 3] as const) expect(usableCombos(BOSS_MOVES[id]).length).toBeGreaterThanOrEqual(2);
    const lo = usableCombos(arsenalMoves(BOSS_MOVES[1], 0)).length;
    const hi = usableCombos(arsenalMoves(BOSS_MOVES[1], 30)).length;
    expect(hi).toBeGreaterThan(lo);
  });
  it("moves are learned in order as the level rises, and nothing is lost", () => {
    let prev = arsenalMoves(BOSS_MOVES[1], 0);
    for (const [need] of UNLOCKS) {
      const now = arsenalMoves(BOSS_MOVES[1], need);
      expect(now.length).toBeGreaterThanOrEqual(prev.length);
      for (const m of prev) expect(now).toContain(m);
      prev = now;
    }
    expect(arsenalMoves(BOSS_MOVES[1], 0)).not.toContain("windSlash");
    expect(arsenalMoves(BOSS_MOVES[1], 5)).toContain("windSlash");
  });
});

describe("range tactic", () => {
  it("no read until enough time has been seen", () => {
    expect(tacticOf({ nearT: 5, farT: 3, hitNear: 3, hitFar: 0 })).toBe("mixed");
  });
  it("a close fighter is made to chase; a kiter is crowded (the other distance is tried first)", () => {
    expect(tacticOf({ nearT: 40, farT: 2, hitNear: 5, hitFar: 0 })).toBe("kite");
    expect(tacticOf({ nearT: 2, farT: 40, hitNear: 0, hitFar: 5 })).toBe("crowd");
  });
  it("once both have been tried, the distance that hurt them more per second wins", () => {
    expect(tacticOf({ nearT: 30, farT: 30, hitNear: 10, hitFar: 2 })).toBe("crowd");
    expect(tacticOf({ nearT: 30, farT: 30, hitNear: 2, hitFar: 10 })).toBe("kite");
  });
});

describe("the behaviour uses them", () => {
  const at = (level: number, range = FRESH.range, duels = 0): Brain => ({ ...FRESH, level, range, duels });
  it("a high-level general plays named combos first, a different few each duel", () => {
    const a = behaviourOf(at(12, FRESH.range, 0), BOSS_MOVES[2]);
    const b = behaviourOf(at(12, FRESH.range, 1), BOSS_MOVES[2]);
    expect(a.named.length).toBeGreaterThan(0);
    expect(a.chains[0]).toEqual(a.named[0].moves);
    expect(a.named.map((c) => c.id)).not.toEqual(b.named.map((c) => c.id));
  });
  it("against a close fighter he keeps his distance and prefers far combos and ranged moves", () => {
    const beh = behaviourOf(at(12, { nearT: 40, farT: 2, hitNear: 4, hitFar: 0 }), BOSS_MOVES[2]);
    expect(beh.tactic).toBe("kite");
    expect(beh.weights.windSlash).toBeGreaterThan(beh.weights.combo);
    expect(beh.named.some((c) => c.range === "far")).toBe(true);
  });
  it("a plain first-duel general learns nothing new and plays no named combos", () => {
    const beh = behaviourOf(FRESH, BOSS_MOVES[1]);
    expect(beh.named).toEqual([]);
    expect(beh.extras).toEqual([]);
  });
  it("named combos never chain two perils beyond what the library already allows", () => {
    for (const c of LIBRARY) {
      let run = 0;
      for (const m of c.moves) {
        run = PERIL.has(m) ? run + 1 : 0;
        expect(run).toBeLessThanOrEqual(2); // Ashina Cross and Dragon Flash are the deliberate double perils
      }
    }
  });
});
