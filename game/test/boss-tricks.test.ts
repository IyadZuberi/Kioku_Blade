import * as THREE from "three";
import { describe, expect, it } from "vitest";
import { Boss } from "../src/game/Boss";
import { applyDifficulty } from "../src/game/difficulty";

/** A body with no animation: the brain only needs a timeline and somewhere to send clip names. */
function fake(): any {
  const timeline = (name: string) => ({
    hits: name === "leap" || name === "thrust" || name === "overhead" ? [{ start: 1.0, end: 1.2, contact: 1.1 }] : [],
    windupPeak: [0.3],
    whoosh: [1.0],
    lunge: [[0.5, 0.9]],
    track: [[0, 0.8]],
    leapOff: 0.3,
    slam: 1.0,
    plunge: -1,
    withdraw: -1,
    cue: {},
    end: 2,
    chain: -1,
  });
  const rig = { onStep: null as unknown, chestW: new THREE.Vector3(0, 1.4, 0), tipW: new THREE.Vector3(), hiltW: new THREE.Vector3() };
  return new Proxy({ rig, timeline, play() {}, step() {} }, { get: (t: any, k) => (k in t ? t[k] : () => {}) });
}

const mk = () => {
  applyDifficulty("medium");
  const b = new Boss(fake());
  b.reset();
  b.pos.set(0, 0, -4.5);
  b.enter("idle");
  return b;
};
const run = (b: Boss, seconds: number, player = new THREE.Vector3(0, 0, 0)) => {
  const evs: string[] = [];
  for (let i = 0; i < seconds * 120; i++) {
    b.update(1 / 120, player, false);
    evs.push(...b.events.splice(0));
  }
  return evs;
};

describe("Masatora's riposte stance", () => {
  it("parries every cut into it, glows at full, and steps in with an attack when nothing comes", () => {
    const b = mk();
    b.startAttack("stance");
    expect(b.state).toBe("stance");
    expect(b.parryReady).toBe(1);
    for (let i = 0; i < 6; i++) expect(b.guard()).toBe("deflect");
    expect(b.state).toBe("stance");
    const evs = run(b, 1.6);
    expect(evs).toContain("stanceEnd");
    expect(b.state).toBe("attack");
  });
});

describe("Kurogane's smoke bomb", () => {
  it("vanishes (cannot be hit), reappears behind the player, and the cut still comes", () => {
    const b = mk();
    b.startAttack("vanish");
    const seen: string[] = [];
    let wasHittable = true;
    for (let i = 0; i < 2.4 * 120; i++) {
      b.update(1 / 120, new THREE.Vector3(0, 0, 0), false);
      seen.push(...b.events.splice(0));
      if (b.vanished && b.hittable) wasHittable = false;
    }
    expect(seen).toContain("vanishOut");
    expect(seen).toContain("vanishIn");
    expect(seen.indexOf("vanishOut")).toBeLessThan(seen.indexOf("vanishIn"));
    expect(wasHittable).toBe(true);
    expect(b.vanished).toBe(false);
    // he was at z = -4.5; "behind" the player is the far side of him: z > 0
    expect(b.pos.z).toBeGreaterThan(0.5);
    expect(Math.hypot(b.pos.x, b.pos.z)).toBeLessThan(3);
  });
  it("a new fight never starts with him hidden", () => {
    const b = mk();
    b.startAttack("vanish");
    run(b, 0.3);
    expect(b.vanished).toBe(true);
    b.reset();
    expect(b.vanished).toBe(false);
    expect(b.hittable).toBe(true);
  });
});

describe("Kazemaru's backflip and lunge", () => {
  it("the backflip springs away without a blow, then hands over to the lunge", () => {
    const b = mk();
    b.pos.set(0, 0, -3.5);
    b.startAttack("backflip");
    expect(b.attack?.hits.length).toBe(0);
    const evs = run(b, 1.6);
    expect(evs).not.toContain("slam");
    expect(Math.hypot(b.pos.x, b.pos.z)).toBeGreaterThan(6.2); // started 3.5 m out; ~3.4 m further
    expect(b.moveName).toBe("lunge");
  });
  it("the lunge is a perilous thrust that closes from across the room", () => {
    const b = mk();
    b.pos.set(0, 0, -8);
    b.startAttack("lunge");
    expect(b.peril).toBe("thrust");
    expect(b.attack?.moves[0].d).toBe(7.5);
  });
  it("his tricks do not break the base moves (the thrust is still the short one)", () => {
    const b = mk();
    b.startAttack("thrust");
    expect(b.attack?.moves[0].d).toBe(4.8);
  });
});

describe("the remembered form (rage)", () => {
  const beh = (level: number) => ({ level, moves: [], extras: [], tactic: "mixed" as const, named: [], forgeNote: "", weights: {}, chains: [["combo", "thrust", "overhead"], ["leap", "flurry", "sweep"]], chainP: 0.5, feintP: 0, jitter: 0, counterStep: false, cond: "none" as const, window: 2, skills: [] });
  const hurt = (level: number) => {
    const b = mk();
    b.brain = beh(level);
    b.phase = 2;
    b.health = 20;
    return b;
  };
  it("a general who has learned enough turns on a nearly beaten player, once, with a fresh string of attacks", () => {
    const b = hurt(8);
    const evs = run(b, 0.5);
    expect(evs.filter((e) => e === "rage")).toHaveLength(1);
    expect(b.rage).toBe(true);
    expect(run(b, 3).filter((e) => e === "rage")).toHaveLength(0);
  });
  it("not in phase 1, not at full health, not for a general who has learned little", () => {
    const low = hurt(3);
    expect(run(low, 1)).not.toContain("rage");
    const healthy = hurt(9);
    healthy.health = 80;
    expect(run(healthy, 1)).not.toContain("rage");
    const p1 = hurt(9);
    p1.phase = 1;
    expect(run(p1, 1)).not.toContain("rage");
  });
});
