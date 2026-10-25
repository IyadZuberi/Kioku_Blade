import { describe, expect, it } from "vitest";
import { DIFFICULTY_PRESETS } from "../src/game/difficulty";
import { assistKnobs } from "../src/input/assist";
import { GestureTracker, type Hand } from "../src/input/gestureLogic";

/**
 * A synthetic hand in the MIRRORED view (mx is where it appears on your screen preview: your right
 * hand is on the right, mx > 0.5). Middle MCP (landmark 9) at (mx, y), wrist 0.15 below it.
 */
function hand(mx: number, y: number, fist = false): Hand {
  const x = 1 - mx;
  const pts = Array.from({ length: 21 }, () => ({ x, y, z: 0 }));
  pts[0] = { x, y: y + 0.15, z: 0 };
  pts[9] = { x, y, z: 0 };
  [6, 10, 14, 18].forEach((p, i) => (pts[p] = { x: x + (i - 1.5) * 0.02, y: y - 0.02, z: 0 }));
  [8, 12, 16, 20].forEach((t, i) => (pts[t] = { x: x + (i - 1.5) * 0.02, y: fist ? y + 0.1 : y - 0.12, z: 0 }));
  return pts;
}
const FPS = 30;
type Ev = { action: string; type: string; t: number };
/** One hand moves between two points over `secs`. */
function sweep(tr: GestureTracker, x0: number, y0: number, x1: number, y1: number, secs: number, t0 = 0, fist = false): Ev[] {
  const n = Math.max(2, Math.round(secs * FPS));
  const ev: Ev[] = [];
  for (let i = 0; i <= n; i++) {
    const t = t0 + (i / FPS) * (secs / (n / FPS));
    const f = i / n;
    for (const e of tr.update([hand(x0 + (x1 - x0) * f, y0 + (y1 - y0) * f, fist)], t)) ev.push({ ...e, t });
  }
  return ev;
}
const R = 0.7; // a right-hand x (right half of the view)
const L = 0.3; // a left-hand x

describe("left hand: movement stick", () => {
  it("the first sighting sets the centre: no movement yet", () => {
    const tr = new GestureTracker();
    tr.update([hand(L, 0.5)], 0);
    expect(tr.axis).toEqual({ x: 0, y: 0 });
  });
  it("hand up is forward, down is back, right is right, left is left", () => {
    const run = (dx: number, dy: number) => {
      const tr = new GestureTracker();
      for (let i = 0; i < 6; i++) tr.update([hand(L, 0.5)], i / FPS);
      for (let i = 6; i < 14; i++) tr.update([hand(L + dx, 0.5 + dy)], i / FPS);
      return tr.axis;
    };
    expect(run(0, -0.12).y).toBeGreaterThan(0.6);
    expect(run(0, 0.12).y).toBeLessThan(-0.6);
    expect(run(0.12, 0).x).toBeGreaterThan(0.6);
    expect(run(-0.12, 0).x).toBeLessThan(-0.6);
  });
  it("small jitter around the centre is ignored", () => {
    const tr = new GestureTracker();
    for (let i = 0; i < 20; i++) tr.update([hand(L + (i % 2) * 0.01, 0.5 - (i % 3) * 0.008)], i / FPS);
    expect(tr.axis).toEqual({ x: 0, y: 0 });
  });
  it("never attacks, dodges, jumps or guards, however fast it moves", () => {
    const ev = sweep(new GestureTracker(), 0.05, 0.5, 0.45, 0.5, 0.2);
    expect(ev).toEqual([]);
    expect(sweep(new GestureTracker(), 0.3, 0.2, 0.3, 0.8, 0.2)).toEqual([]);
    expect(sweep(new GestureTracker(), 0.3, 0.5, 0.3, 0.5, 0.5, 0, true)).toEqual([]);
  });
  it("closing the left fist recentres the stick where the hand is", () => {
    const tr = new GestureTracker();
    for (let i = 0; i < 6; i++) tr.update([hand(L, 0.5)], i / FPS);
    for (let i = 6; i < 12; i++) tr.update([hand(L, 0.38)], i / FPS);
    expect(tr.axis.y).toBeGreaterThan(0.5);
    for (let i = 12; i < 18; i++) tr.update([hand(L, 0.38, true)], i / FPS);
    expect(tr.axis).toEqual({ x: 0, y: 0 });
  });
  it("when the hand leaves, movement stops; a new sighting sets a new centre", () => {
    const tr = new GestureTracker();
    for (let i = 0; i < 6; i++) tr.update([hand(L, 0.5)], i / FPS);
    for (let i = 6; i < 12; i++) tr.update([hand(L, 0.38)], i / FPS);
    tr.update([], 0.9);
    expect(tr.axis).toEqual({ x: 0, y: 0 });
    tr.update([hand(L, 0.2)], 1.0);
    expect(tr.axis).toEqual({ x: 0, y: 0 });
  });
});

describe("broken input", () => {
  it("empty and broken input never throws or emits NaN", () => {
    const tr = new GestureTracker();
    expect(tr.update([], 0)).toEqual([]);
    expect(() => tr.update([[] as never], 0.1)).not.toThrow();
    expect(() => tr.update([hand(NaN, NaN)], 0.2)).not.toThrow();
    expect(Number.isFinite(tr.axis.x) && Number.isFinite(tr.axis.y)).toBe(true);
  });
});

describe("assistKnobs", () => {
  it("only widens the deflect windows, never tightens them", () => {
    for (const name of ["easy", "medium", "hard"] as const) {
      const base = structuredClone(DIFFICULTY_PRESETS[name]);
      const k = assistKnobs(base);
      expect(k.deflectEarly).toBeGreaterThanOrEqual(base.deflectEarly);
      expect(k.deflectLate).toBeGreaterThanOrEqual(base.deflectLate);
      k.deflectSteps.forEach((v, i) => expect(v).toBeGreaterThanOrEqual(base.deflectSteps[i]));
      expect(k.playerDamage).toBe(base.playerDamage);
      expect(k.deflectEarly).toBeLessThanOrEqual(0.35);
    }
  });
});