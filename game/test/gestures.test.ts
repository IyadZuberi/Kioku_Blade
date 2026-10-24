import { describe, expect, it } from "vitest";
import { DIFFICULTY_PRESETS } from "../src/game/difficulty";
import { assistKnobs } from "../src/input/assist";
import { GestureTracker, type Hand } from "../src/input/gestureLogic";

/** A synthetic hand: middle MCP (landmark 9) at (x,y), wrist 0.15 below it, fingers curled (fist) or extended. */
function hand(x: number, y: number, fist = false): Hand {
  const pts = Array.from({ length: 21 }, () => ({ x, y, z: 0 }));
  pts[0] = { x, y: y + 0.15, z: 0 };
  pts[9] = { x, y, z: 0 };
  const pip = [6, 10, 14, 18], tip = [8, 12, 16, 20];
  pip.forEach((p, i) => (pts[p] = { x: x + (i - 1.5) * 0.02, y: y - 0.02, z: 0 }));
  // extended: tip beyond the pip (farther from the wrist); curled: tip back near the wrist
  tip.forEach((t, i) => (pts[t] = { x: x + (i - 1.5) * 0.02, y: fist ? y + 0.1 : y - 0.12, z: 0 }));
  return pts;
}
const FPS = 30;
/** Move one open hand from (x0,y0) to (x1,y1) over `secs`, return all events. */
function sweep(tr: GestureTracker, x0: number, y0: number, x1: number, y1: number, secs: number, t0 = 0, fist = false) {
  const n = Math.max(2, Math.round(secs * FPS));
  const ev: { action: string; type: string; t: number }[] = [];
  for (let i = 0; i <= n; i++) {
    const t = t0 + (i / FPS) * (secs / (n / FPS));
    const f = i / n;
    for (const e of tr.update([hand(x0 + (x1 - x0) * f, y0 + (y1 - y0) * f, fist)], t)) ev.push({ ...e, t });
  }
  return ev;
}

describe("GestureTracker", () => {
  it("slow movement emits nothing", () => {
    expect(sweep(new GestureTracker(), 0.3, 0.5, 0.6, 0.5, 2)).toEqual([]);
  });
  it("a fast horizontal swipe emits one attack press and then its release", () => {
    const ev = sweep(new GestureTracker(), 0.2, 0.5, 0.8, 0.5, 0.25);
    const press = ev.filter((e) => e.action === "attack" && e.type === "press");
    expect(press.length).toBe(1);
    // the release comes on a later frame
    const tr = new GestureTracker();
    const evs = [...sweep(tr, 0.2, 0.5, 0.8, 0.5, 0.25), ...sweep(tr, 0.8, 0.5, 0.8, 0.5, 0.3, 0.3)];
    expect(evs.filter((e) => e.action === "attack" && e.type === "release").length).toBe(1);
  });
  it("two swipes inside the cooldown make one attack", () => {
    const tr = new GestureTracker();
    const a = sweep(tr, 0.2, 0.5, 0.8, 0.5, 0.2, 0);
    const b = sweep(tr, 0.8, 0.5, 0.2, 0.5, 0.2, 0.22);
    expect([...a, ...b].filter((e) => e.action === "attack" && e.type === "press").length).toBe(1);
  });
  it("a fast downward move is a dodge and a fast upward flick is a jump", () => {
    expect(sweep(new GestureTracker(), 0.5, 0.2, 0.5, 0.75, 0.25).some((e) => e.action === "dodge" && e.type === "press")).toBe(true);
    expect(sweep(new GestureTracker(), 0.5, 0.75, 0.5, 0.2, 0.25).some((e) => e.action === "jump" && e.type === "press")).toBe(true);
  });
  it("closing a fist presses block, opening it releases", () => {
    const tr = new GestureTracker();
    const ev: { action: string; type: string }[] = [];
    for (let i = 0; i < 6; i++) ev.push(...tr.update([hand(0.5, 0.5, false)], i / FPS));
    for (let i = 6; i < 14; i++) ev.push(...tr.update([hand(0.5, 0.5, true)], i / FPS));
    expect(ev.filter((e) => e.action === "block" && e.type === "press").length).toBe(1);
    expect(ev.some((e) => e.action === "block" && e.type === "release")).toBe(false);
    for (let i = 14; i < 22; i++) ev.push(...tr.update([hand(0.5, 0.5, false)], i / FPS));
    expect(ev.filter((e) => e.action === "block" && e.type === "release").length).toBe(1);
  });
  it("hands disappearing release a held block", () => {
    const tr = new GestureTracker();
    for (let i = 0; i < 8; i++) tr.update([hand(0.5, 0.5, true)], i / FPS);
    const ev: { action: string; type: string }[] = [];
    for (let i = 8; i < 20; i++) ev.push(...tr.update([], i / FPS));
    expect(ev.filter((e) => e.action === "block" && e.type === "release").length).toBe(1);
  });
  it("a fast-moving fist does not attack", () => {
    expect(sweep(new GestureTracker(), 0.2, 0.5, 0.8, 0.5, 0.25, 0, true).some((e) => e.action === "attack")).toBe(false);
  });
  it("two hands: one fist holds the guard while the other swipes to attack", () => {
    const tr = new GestureTracker();
    const ev: { action: string; type: string }[] = [];
    for (let i = 0; i <= 8; i++) {
      const f = i / 8;
      ev.push(...tr.update([hand(0.2, 0.6, true), hand(0.45 + 0.4 * f, 0.5, false)], i / FPS));
    }
    expect(ev.some((e) => e.action === "block" && e.type === "press")).toBe(true);
    expect(ev.some((e) => e.action === "attack" && e.type === "press")).toBe(true);
  });
  it("empty and jittery input never throws or emits NaN actions", () => {
    const tr = new GestureTracker();
    expect(tr.update([], 0)).toEqual([]);
    expect(() => tr.update([[] as any], 0.1)).not.toThrow();
    expect(() => tr.update([hand(NaN, NaN)], 0.2)).not.toThrow();
  });
});

describe("GestureTracker in real conditions", () => {
  it("a swipe still attacks when the camera drops two frames mid-swipe (motion blur)", () => {
    const tr = new GestureTracker();
    const ev: { action: string; type: string }[] = [];
    const n = 9; // 0.3 s sweep at 30 fps
    for (let i = 0; i <= n; i++) {
      const f = i / n;
      const lost = i === 4 || i === 5;
      ev.push(...tr.update(lost ? [] : [hand(0.2 + 0.6 * f, 0.5)], i / FPS));
    }
    expect(ev.some((e) => e.action === "attack" && e.type === "press")).toBe(true);
  });
  it("a moderate, human-speed swipe (about 6 hand-lengths per second) attacks", () => {
    const ev = sweep(new GestureTracker(), 0.3, 0.5, 0.7, 0.5, 0.45);
    expect(ev.some((e) => e.action === "attack" && e.type === "press")).toBe(true);
  });
  it("slow drift (about 1.5 hand-lengths per second) does not", () => {
    expect(sweep(new GestureTracker(), 0.3, 0.5, 0.6, 0.5, 1.3)).toEqual([]);
  });
  it("a hand that vanished for over half a second starts a fresh track (no stale jump)", () => {
    const tr = new GestureTracker();
    tr.update([hand(0.1, 0.5)], 0);
    const ev = tr.update([hand(0.9, 0.5)], 1.0);
    expect(ev).toEqual([]);
  });
  it("exposes the live speed for the calibration overlay", () => {
    const tr = new GestureTracker();
    sweep(tr, 0.2, 0.5, 0.8, 0.5, 0.25);
    expect(tr.debug.hands).toBe(1);
    expect(tr.debug.peak).toBeGreaterThan(4);
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