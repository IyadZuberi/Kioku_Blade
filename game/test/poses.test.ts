import { describe, expect, it } from "vitest";
import { PoseTracker, classify, poseFeatures, type Pose } from "../src/input/poses";
import type { Hand } from "../src/input/gestureLogic";

/** A synthetic hand: wrist at (at, 0.6), fingers fanned by `spread`, curled by `curl` (0 straight, 1 closed). */
function hand(curl: number, at = 0.7, spread = 0): Hand {
  const h: Hand = [{ x: at, y: 0.6 }];
  for (let i = 1; i < 21; i++) {
    const finger = Math.floor((i - 1) / 4);
    const seg = ((i - 1) % 4) + 1;
    h.push({ x: at + (finger - 2) * 0.02 + spread * seg * 0.01, y: 0.6 - 0.08 - (seg - 1) * 0.03 * (1 - curl * 0.9) - (finger === 2 ? 0.01 : 0) });
  }
  return h;
}
/** In the mirrored camera view a hand with raw x 0.3 shows on the right of the picture (the fighting side). */
const sh = (h: Hand): Hand => h.map((p) => ({ ...p, x: p.x - 0.4 }));
const pose = (id: string, action: Pose["action"], h: Hand): Pose => ({ id, name: id, action, samples: [poseFeatures(h)!] });

describe("poses", () => {
  const open = hand(0);
  const fist = hand(1);
  const point = hand(0.5, 0.7, 4);
  const set = { poses: [pose("open", "none", open), pose("fist", "block", fist), pose("point", "attack", point)] };

  it("features do not depend on where the hand is", () => {
    const a = poseFeatures(hand(0, 0.3))!;
    const b = poseFeatures(hand(0, 0.8))!;
    expect(a.every((v, i) => Math.abs(v - b[i]) < 1e-9)).toBe(true);
  });
  it("classifies each trained pose and rejects a different hand shape", () => {
    expect(classify(poseFeatures(fist)!, set)?.pose.id).toBe("fist");
    expect(classify(poseFeatures(hand(0.03))!, set)?.pose.id).toBe("open");
    expect(classify(poseFeatures(hand(0.5, 0.7, -9))!, set)).toBeNull();
  });
  it("fires after two matching frames, holds a block, releases when the pose goes", () => {
    const t = new PoseTracker();
    t.set = set;
    const ev: string[] = [];
    const feed = (h: Hand, at: number) => t.update([sh(h)], at).forEach((e) => ev.push(`${e.action}:${e.type}`));
    feed(fist, 0);
    expect(ev).toEqual([]);
    feed(fist, 0.033);
    expect(ev).toEqual(["block:press"]);
    feed(fist, 0.066);
    feed(fist, 0.1);
    expect(ev).toEqual(["block:press"]);
    feed(open, 0.133);
    feed(open, 0.166);
    expect(ev).toEqual(["block:press", "block:release"]);
  });
  it("a tap pose presses once and releases itself; a rest pose does nothing", () => {
    const t = new PoseTracker();
    t.set = set;
    const ev: string[] = [];
    for (let i = 0; i < 12; i++) t.update([sh(point)], i * 0.033).forEach((e) => ev.push(`${e.action}:${e.type}`));
    expect(ev).toEqual(["attack:press", "attack:release"]);
    ev.length = 0;
    for (let i = 0; i < 6; i++) t.update([sh(open)], 1 + i * 0.033).forEach((e) => ev.push(`${e.action}:${e.type}`));
    expect(ev).toEqual([]);
  });
});

import { lookAlike, withPose } from "../src/input/poses";
describe("keeping every pose", () => {
  const a = hand(1), b = hand(0), c = hand(0.5, 0.7, 4);
  it("a new capture replaces only the old pose of the same action; all the others stay", () => {
    const old = [pose("a", "block", a), pose("b", "attack", b), pose("c", "jump", c)];
    expect(withPose(old, pose("n", "block", a)).map((p) => p.id)).toEqual(["b", "c", "n"]);
    expect(withPose(old, pose("d", "dodge", hand(0.2, 0.7, 2))).length).toBe(4);
    expect(withPose(old, pose("e", "attack", b)).map((p) => p.id)).toEqual(["a", "c", "e"]);
  });
  it("a pose that looks like another is reported, never silently dropped", () => {
    const old = [pose("a", "block", a), pose("b", "attack", b)];
    const twin = pose("t", "jump", b);
    expect(lookAlike(old, twin).map((p) => p.id)).toEqual(["b"]);
    expect(withPose(old, twin).length).toBe(3);
  });
});

describe("one hand or two", () => {
  const set = { poses: [pose("fist", "block", hand(1)), pose("point", "attack", hand(0.5, 0.7, 4)), pose("open", "none", hand(0))] };
  const run = (frames: Hand[][]) => {
    const t = new PoseTracker();
    t.set = set;
    const ev: string[] = [];
    frames.forEach((hs, i) => t.update(hs, i * 0.033).forEach((e) => ev.push(`${e.action}:${e.type}`)));
    return ev;
  };
  const at = (h: Hand, x: number): Hand => h.map((p) => ({ ...p, x: p.x - 0.7 + x }));
  it("a single right hand works, and so does a single left hand (a pose is the same on either hand)", () => {
    const point = hand(0.5, 0.7, 4);
    // the camera view is mirrored: a hand with raw x 0.3 shows on the right of the picture
    expect(run(Array.from({ length: 6 }, () => [at(point, 0.3)]))).toContain("attack:press");
    // a left hand makes the mirror-image shape
    const mirrored = point.map((p) => ({ ...p, x: 2 * point[0].x - p.x }));
    expect(run(Array.from({ length: 6 }, () => [at(mirrored, 0.8)]))).toContain("attack:press");
  });
  it("both hands at once: one guards while the other strikes; the guard stays held until both let go", () => {
    const fist = hand(1), point = hand(0.5, 0.7, 4), open = hand(0);
    const L = (h: Hand) => at(h.map((p) => ({ ...p, x: 2 * h[0].x - p.x })), 0.8);
    const R = (h: Hand) => at(h, 0.3);
    const ev = run([[L(fist), R(open)], [L(fist), R(open)], [L(fist), R(point)], [L(fist), R(point)], [L(fist), R(open)], [L(fist), R(open)], [L(open), R(open)], [L(open), R(open)], [L(open), R(open)]]);
    expect(ev.filter((e) => e === "block:press")).toHaveLength(1);
    expect(ev).toContain("attack:press");
    expect(ev.filter((e) => e === "block:release")).toHaveLength(1);
    expect(ev.indexOf("attack:press")).toBeLessThan(ev.indexOf("block:release"));
  });
});
