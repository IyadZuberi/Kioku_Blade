import { describe, expect, it } from "vitest";
import { RING, WAVE, makeWave, ringHalfWidth, ringHits, ringRadius, stepWave, waveHits } from "../src/game/hazards";

describe("wind cut", () => {
  it("travels toward the target at its speed and expires", () => {
    const w = makeWave(0, 0, 0, 10);
    stepWave(w, 0.5);
    expect(w.z).toBeCloseTo(WAVE.speed * 0.5, 6);
    expect(w.x).toBeCloseTo(0, 6);
    expect(w.age).toBeCloseTo(0.5, 6);
    stepWave(w, WAVE.life);
    expect(w.dead).toBe(true);
  });
  it("has a unit direction even when spawned on top of the target", () => {
    const w = makeWave(2, 2, 2, 2);
    expect(Math.hypot(w.dx, w.dz)).toBeCloseTo(1, 6);
  });
  it("hits a grounded player in reach and misses one in the air or beside it", () => {
    const w = makeWave(0, 0, 0, 10);
    stepWave(w, 0.5);
    expect(waveHits(w, 0, w.z, 0)).toBe(true);
    expect(waveHits(w, 0, w.z, 1.2)).toBe(false);
    expect(waveHits(w, 3, w.z, 0)).toBe(false);
  });
  it("a hit wave is spent", () => {
    const w = makeWave(0, 0, 0, 10);
    w.hit = true;
    expect(waveHits(w, 0, 0, 0)).toBe(false);
  });
});

describe("ground ring", () => {
  it("grows at its speed, from its starting radius", () => {
    expect(ringRadius(0)).toBeCloseTo(RING.r0, 6);
    expect(ringRadius(1)).toBeCloseTo(RING.r0 + RING.speed, 6);
  });
  it("hits a grounded player standing on the front, not inside or outside it", () => {
    const t = 0.5;
    const r = ringRadius(t);
    expect(ringHits({ x: 0, z: 0, t, hit: false }, r, 0, 0)).toBe(true);
    expect(ringHits({ x: 0, z: 0, t, hit: false }, r - 2.5, 0, 0)).toBe(false);
    expect(ringHits({ x: 0, z: 0, t, hit: false }, r + 2.5, 0, 0)).toBe(false);
  });
  it("is jumped over (feet clear of the ground) and hits only once", () => {
    const t = 0.5;
    const r = ringRadius(t);
    expect(ringHits({ x: 0, z: 0, t, hit: false }, r, 0, 0.5)).toBe(false);
    expect(ringHits({ x: 0, z: 0, t, hit: true }, r, 0, 0)).toBe(false);
  });
  it("the band widens a little with the radius and stays under a metre half-width", () => {
    expect(ringHalfWidth(10)).toBeGreaterThan(ringHalfWidth(2));
    expect(ringHalfWidth(RING.rMax)).toBeLessThan(1);
  });
});