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
    const feed = (h: Hand, at: number) => t.update([h], at).forEach((e) => ev.push(`${e.action}:${e.type}`));
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
    for (let i = 0; i < 12; i++) t.update([point], i * 0.033).forEach((e) => ev.push(`${e.action}:${e.type}`));
    expect(ev).toEqual(["attack:press", "attack:release"]);
    ev.length = 0;
    for (let i = 0; i < 6; i++) t.update([open], 1 + i * 0.033).forEach((e) => ev.push(`${e.action}:${e.type}`));
    expect(ev).toEqual([]);
  });
});
