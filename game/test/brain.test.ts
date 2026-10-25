import { describe, expect, it } from "vitest";
import type { StatsSummary } from "@gr/shared";
import { FRESH, behaviourOf, chainsOf, chooseCond, learn, loadBrain, saveBrain, styleOf, vulnerable, weightsOf, type Brain } from "../src/learn/brain";

const stats = (o: Partial<StatsSummary> = {}): StatsSummary => ({
  fightSeconds: 60, deflects: 0, lateDeflects: 0, blocks: 0, hitsTaken: 3, dodged: 0, playerHits: 10, sweepsJumped: 0, grabbed: 0, grabsEvaded: 0, heals: 0, firstHealAtSeconds: null, medianDeflectTiming: null, victory: false, deaths: 1, hitsByMove: {}, ...o,
});
const MOVES = ["combo", "comboDelay", "overhead", "thrust", "sweep", "grab", "flurry"];

describe("reading the player", () => {
  it("a deflector, a turtle and a dodger look different", () => {
    expect(styleOf(stats({ deflects: 20 })).deflect).toBeGreaterThan(0.6);
    expect(styleOf(stats({ blocks: 20 })).guard).toBeGreaterThan(0.6);
    expect(styleOf(stats({ dodged: 20 })).dodge).toBeGreaterThan(0.6);
  });
  it("the condition is aimed at what the player leans on, and changes after they beat it", () => {
    const deflector = styleOf(stats({ deflects: 20 }));
    expect(chooseCond(deflector, "none", false)).toBe("afterDodge");
    expect(chooseCond(styleOf(stats({ blocks: 20 })), "none", false)).toBe("afterDeflect");
    expect(chooseCond(styleOf(stats({ dodged: 20 })), "none", false)).toBe("guardBroken");
    expect(chooseCond(deflector, "afterDodge", true)).not.toBe("afterDodge");
  });
});

describe("learning", () => {
  it("the level only goes up, with no ceiling, win or lose, and grows faster on a clean win", () => {
    let b: Brain = FRESH;
    let prev = 0;
    for (let i = 0; i < 40; i++) {
      b = learn(b, stats({ victory: i % 3 === 0, deflects: 8 }), {});
      expect(b.level).toBeGreaterThan(prev);
      prev = b.level;
    }
    expect(b.level).toBeGreaterThan(40);
    const lose = learn(FRESH, stats({ victory: false, hitsTaken: 9 }), {});
    const stomp = learn(FRESH, stats({ victory: true, hitsTaken: 0, fightSeconds: 30 }), {});
    expect(stomp.level).toBeGreaterThan(lose.level + 1);
  });
  it("the first duel is free of a condition; after that he hides behind one", () => {
    const one = learn(FRESH, stats({ deflects: 20 }), {});
    expect(one.cond === "none" || one.level >= 2).toBe(true);
    const two = learn(one, stats({ deflects: 20, victory: true }), {});
    expect(two.cond).not.toBe("none");
  });
  it("moves that land on this player are chosen more, moves that never land less", () => {
    let b: Brain = FRESH;
    b = learn(b, stats({ hitsByMove: { thrust: 5, combo: 0 } }), { thrust: 6, combo: 6, sweep: 6 });
    const w = weightsOf(b, MOVES);
    expect(w.thrust).toBeGreaterThan(w.combo);
    expect(w.combo).toBeLessThan(1);
    expect(w.thrust).toBeGreaterThan(1.5);
  });
  it("combos get longer and more numerous with level, never repeat a move back to back or chain two perils", () => {
    const at = (level: number): Brain => ({ ...FRESH, level, seed: 5 });
    const small = chainsOf(at(1), MOVES, weightsOf(at(1), MOVES));
    const big = chainsOf(at(20), MOVES, weightsOf(at(20), MOVES));
    expect(big.length).toBeGreaterThan(small.length);
    expect(big[0].length).toBeGreaterThan(small[0].length);
    for (const c of big)
      for (let i = 1; i < c.length; i++) {
        expect(c[i]).not.toBe(c[i - 1]);
        expect(["thrust", "sweep", "grab"].includes(c[i]) && ["thrust", "sweep", "grab"].includes(c[i - 1])).toBe(false);
      }
  });
  it("combos are new each duel (the seed moves), and the same brain always makes the same ones", () => {
    const b: Brain = { ...FRESH, level: 12, seed: 3 };
    expect(chainsOf(b, MOVES, weightsOf(b, MOVES))).toEqual(chainsOf(b, MOVES, weightsOf(b, MOVES)));
    const c = learn(b, stats(), {});
    expect(chainsOf(c, MOVES, weightsOf(c, MOVES))).not.toEqual(chainsOf(b, MOVES, weightsOf(b, MOVES)));
  });
  it("skills unlock with level and feints and uneven swings grow with it", () => {
    const lo = behaviourOf({ ...FRESH, level: 1 }, MOVES);
    const hi = behaviourOf({ ...FRESH, level: 25 }, MOVES);
    expect(hi.skills.length).toBeGreaterThan(lo.skills.length);
    expect(hi.feintP).toBeGreaterThan(lo.feintP);
    expect(hi.jitter).toBeGreaterThan(lo.jitter);
    expect(hi.counterStep).toBe(true);
    expect(behaviourOf(FRESH, MOVES).chains).toEqual([]);
  });
});

describe("the condition he hides behind", () => {
  const ctx = (o: object = {}) => ({ sinceDeflect: 99, sinceDodge: 99, open: false, posture: 0, window: 2, ...o });
  it("none is always hurt; the others only on their condition", () => {
    expect(vulnerable("none", ctx())).toBe(true);
    expect(vulnerable("afterDeflect", ctx())).toBe(false);
    expect(vulnerable("afterDeflect", ctx({ sinceDeflect: 1 }))).toBe(true);
    expect(vulnerable("afterDodge", ctx({ sinceDeflect: 1 }))).toBe(false);
    expect(vulnerable("afterDodge", ctx({ sinceDodge: 1.9 }))).toBe(true);
    expect(vulnerable("afterDodge", ctx({ sinceDodge: 2.1 }))).toBe(false);
    expect(vulnerable("guardBroken", ctx({ posture: 60 }))).toBe(true);
    expect(vulnerable("guardBroken", ctx({ posture: 20 }))).toBe(false);
  });
  it("an opening always counts, whatever the condition (he is never invulnerable for good)", () => {
    for (const c of ["afterDeflect", "afterDodge", "whenOpen", "guardBroken"] as const) expect(vulnerable(c, ctx({ open: true }))).toBe(true);
  });
});

describe("storage", () => {
  const mem = () => {
    const m = new Map<string, string>();
    return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v) };
  };
  it("a brain survives a reload; junk gives a fresh one", () => {
    const st = mem();
    const b = learn(FRESH, stats({ deflects: 5 }), { combo: 3 });
    saveBrain("p", 2, b, st);
    expect(loadBrain("p", 2, st)).toEqual(b);
    st.setItem("kioku.brain.p.1", "{nope");
    expect(loadBrain("p", 1, st)).toEqual(FRESH);
    expect(loadBrain("p", 3, st)).toEqual(FRESH);
  });
});

import { applyForge, digestOf } from "../src/learn/brain";
import { parseDigest } from "@gr/shared";

describe("the language model's design", () => {
  const base = (): Brain => ({ ...FRESH, level: 6, duels: 3, cond: "afterDodge", range: { nearT: 40, farT: 4, hitNear: 5, hitFar: 0 } });
  const forge = { combos: [{ name: "Broken Rhythm", moves: ["comboDelay", "thrust", "combo", "overhead"] }], tactic: "kite" as const, cond: "whenOpen" as const, teach: "windSlash", note: "He keeps away now." };
  const MV = ["leap", "combo", "comboDelay", "overhead", "thrust", "sweep", "grab", "flurry"];
  it("its combos are played first and named as its own, the move it teaches joins his arsenal for good, and its note is kept", () => {
    const b = applyForge(base(), forge);
    expect(b.taught).toEqual(["windSlash"]);
    expect(b.cond).toBe("whenOpen");
    const beh = behaviourOf(b, MV);
    expect(beh.moves).toContain("windSlash");
    expect(beh.named[0]).toMatchObject({ name: "Broken Rhythm", from: "designed by the language model" });
    expect(beh.chains[0]).toEqual(forge.combos[0].moves);
    expect(beh.tactic).toBe("kite");
    expect(beh.forgeNote).toBe("He keeps away now.");
    // teaching twice does not duplicate, and it survives the next duel
    expect(applyForge(b, forge).taught).toEqual(["windSlash"]);
    expect(learn(b, stats(), {}).taught).toEqual(["windSlash"]);
  });
  it("a designed combo he cannot play is skipped, and no design leaves the deterministic arsenal in place", () => {
    const beh = behaviourOf(applyForge(base(), { ...forge, teach: "none", combos: [{ name: "Ghost", moves: ["vanish", "leap", "combo"] }] }), MV);
    expect(beh.named.some((c) => c.name === "Ghost")).toBe(false);
    expect(behaviourOf(base(), MV).forgeNote).toBe("");
  });
  it("the digest is small, numeric and survives the server's parser unchanged", () => {
    let b = learn(FRESH, stats({ hitsByMove: { thrust: 4 }, deflects: 9 }), { thrust: 5, sweep: 4 }, { nearT: 30, farT: 5, hitNear: 3, hitFar: 0 });
    b = { ...b, level: 6 };
    const d = digestOf(b, 2, true, MV);
    expect(d.works).toContain("thrust");
    expect(d.failed).toContain("sweep");
    expect(d.near).toBeGreaterThan(0.8);
    expect(JSON.stringify(d).length).toBeLessThan(600);
    expect(parseDigest(JSON.parse(JSON.stringify(d)))).toEqual(d);
  });
});
