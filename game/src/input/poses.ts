/**
 * Hand POSES the player trains themselves: each pose is a few recorded samples of one hand shape
 * plus the action it triggers. A pose is read from a single frame (no swipe to measure), so the
 * reaction is as fast as the camera: two matching frames (~65 ms) and the action fires.
 * Pure: landmarks + a clock in, press/release events out. Stored in localStorage by the trainer.
 */
import type { Action } from "../core/Input";
import type { GestureEvent, Hand } from "./gestureLogic";

/** "none" marks a rest pose: trained so ordinary hand shapes are recognised as "do nothing". */
export type PoseAction = Action | "none";
export interface Pose {
  id: string;
  name: string;
  action: PoseAction;
  samples: number[][];
}
export interface PoseSet {
  poses: Pose[];
}

export const POSE = {
  /** Mean distance per landmark (in palm lengths) under which a sample counts as a match. */
  maxDist: 0.32,
  /** The best pose must beat the runner-up by this much, or nothing matches. */
  margin: 0.04,
  confirmFrames: 2,
  releaseFrames: 2,
  tapSeconds: 0.09,
  cooldown: 0.25,
};

/** Actions held while the pose is held (the rest fire once per pose entry). */
export const HELD: PoseAction[] = ["block"];

/** Wrist-relative landmarks in palm lengths: independent of where the hand is and how far it is from the camera. */
export function poseFeatures(h: Hand): number[] | null {
  if (h.length < 21) return null;
  const s = Math.hypot(h[9].x - h[0].x, h[9].y - h[0].y);
  if (!(s > 0.02)) return null;
  const f: number[] = [];
  for (let i = 1; i < 21; i++) f.push((h[i].x - h[0].x) / s, (h[i].y - h[0].y) / s);
  return f;
}

export function dist(a: number[], b: number[]): number {
  let t = 0;
  for (let i = 0; i < a.length; i += 2) t += Math.hypot(a[i] - b[i], a[i + 1] - b[i + 1]);
  return t / (a.length / 2);
}

export interface Match {
  pose: Pose;
  dist: number;
}
/** The closest trained pose, or null when nothing is close enough or two poses are too alike to tell apart. */
export function classify(f: number[], set: PoseSet): Match | null {
  let best: Match | null = null;
  let second = Infinity;
  for (const pose of set.poses) {
    let m = Infinity;
    for (const s of pose.samples) m = Math.min(m, dist(f, s));
    if (!best || m < best.dist) {
      if (best) second = best.dist;
      best = { pose, dist: m };
    } else second = Math.min(second, m);
  }
  if (!best || best.dist > POSE.maxDist || second - best.dist < POSE.margin) return null;
  return best;
}

/** Add a freshly captured pose and drop the stale ones: the old pose for the same action, and any other pose whose shape is now ambiguous with it. */
export function withPose(poses: Pose[], added: Pose): Pose[] {
  const alike = (p: Pose) => p.samples.some((s) => added.samples.some((n) => dist(s, n) < POSE.maxDist));
  return [...poses.filter((p) => p.action !== added.action && !alike(p)), added];
}

export class PoseTracker {
  private poseSet: PoseSet = { poses: [] };
  get set(): PoseSet {
    return this.poseSet;
  }
  /** Replacing the poses also forgets what was held and any cooldowns, so nothing stale fires. */
  set set(v: PoseSet) {
    this.poseSet = v;
    this.seen = null;
    this.count = 0;
    this.active = null;
    this.off = 0;
    this.cool = {};
    this.current = null;
  }
  /** What is recognised right now (for the trainer's live readout). */
  current: Match | null = null;
  private seen: string | null = null;
  private count = 0;
  private active: Pose | null = null;
  private off = 0;
  private cool: Record<string, number> = {};
  private releases: { action: Action; at: number }[] = [];

  get ready(): boolean {
    return this.set.poses.some((p) => p.action !== "none" && p.samples.length > 0);
  }

  update(hands: Hand[], t: number): GestureEvent[] {
    const out: GestureEvent[] = [];
    this.releases = this.releases.filter((r) => {
      if (r.at > t) return true;
      out.push({ action: r.action, type: "release" });
      return false;
    });
    // the fighting hand is the one on the right of the picture (mirrored); a lone hand is that hand
    const sorted = hands.filter((h) => h.length >= 21).sort((a, b) => 1 - a[9].x - (1 - b[9].x));
    const hand = sorted[sorted.length - 1];
    const f = hand && poseFeatures(hand);
    this.current = f ? classify(f, this.set) : null;
    const id = this.current?.pose.id ?? null;
    if (id === this.seen) this.count++;
    else {
      this.seen = id;
      this.count = 1;
    }

    if (this.count >= POSE.confirmFrames && id && this.active?.id !== id) {
      this.leave(out);
      const pose = this.current!.pose;
      this.active = pose;
      const a = pose.action;
      if (a !== "none" && t >= (this.cool[pose.id] ?? 0)) {
        this.cool[pose.id] = t + POSE.cooldown;
        out.push({ action: a, type: "press" });
        if (!HELD.includes(a)) this.releases.push({ action: a, at: t + POSE.tapSeconds });
      }
    } else if (this.active && this.seen !== this.active.id) {
      if (++this.off >= POSE.releaseFrames) this.leave(out);
    } else this.off = 0;
    return out;
  }

  private leave(out: GestureEvent[]): void {
    if (this.active && HELD.includes(this.active.action)) out.push({ action: this.active.action as Action, type: "release" });
    this.active = null;
    this.off = 0;
  }
}

const KEY = "kioku-poses";
export function loadPoses(): PoseSet {
  try {
    const s = JSON.parse(localStorage.getItem(KEY) ?? "null") as PoseSet | null;
    if (s && Array.isArray(s.poses)) return s;
  } catch {
    /* no storage: start empty */
  }
  return { poses: [] };
}
export function savePoses(set: PoseSet): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(set));
  } catch {
    /* private window: poses last until reload */
  }
}
