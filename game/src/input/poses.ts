/**
 * Hand POSES the player trains themselves: each pose is a few recorded samples of one hand shape
 * plus the action it triggers. A pose is read from a single frame (no swipe to measure), so the
 * reaction is as fast as the camera: two matching frames (~65 ms) and the action fires.
 *
 * One hand or two: every visible hand is read on its own (the left of the picture and the right of the picture),
 * so a pose works with either hand, and both hands can hold a pose at once. A pose trained with the right hand
 * matches the left hand's mirror image. Pure: landmarks + a clock in, press/release events out. Stored in
 * localStorage by the trainer.
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

/**
 * Wrist-relative landmarks in palm lengths: independent of where the hand is and how far it is from the camera.
 * `mirror` flips a left hand into the right-hand shape the poses are stored in.
 */
export function poseFeatures(h: Hand, mirror = false): number[] | null {
  if (h.length < 21) return null;
  const s = Math.hypot(h[9].x - h[0].x, h[9].y - h[0].y);
  if (!(s > 0.02)) return null;
  const f: number[] = [];
  for (let i = 1; i < 21; i++) f.push(((h[i].x - h[0].x) / s) * (mirror ? -1 : 1), (h[i].y - h[0].y) / s);
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

/**
 * Add a freshly captured pose. Every OTHER pose is kept: only the old pose for the same action is replaced.
 * (Poses that look alike are reported by `lookAlike` so the trainer can say so, never silently dropped.)
 */
export function withPose(poses: Pose[], added: Pose): Pose[] {
  return [...poses.filter((p) => p.action !== added.action), added];
}

/** The existing poses (of other actions) that this new one could be confused with. */
export function lookAlike(poses: Pose[], added: Pose): Pose[] {
  return poses.filter((p) => p.action !== added.action && p.samples.some((s) => added.samples.some((n) => dist(s, n) < POSE.maxDist * 0.8)));
}

type Slot = "L" | "R";
interface SlotState {
  seen: string | null;
  count: number;
  active: Pose | null;
  off: number;
}
const fresh = (): SlotState => ({ seen: null, count: 0, active: null, off: 0 });

export class PoseTracker {
  private poseSet: PoseSet = { poses: [] };
  get set(): PoseSet {
    return this.poseSet;
  }
  /** Replacing the poses also forgets what was held and any cooldowns, so nothing stale fires. */
  set set(v: PoseSet) {
    this.poseSet = v;
    this.slots = { L: fresh(), R: fresh() };
    this.held.clear();
    this.cool = {};
    this.current = null;
    this.currents = { L: null, R: null };
  }
  /** What is recognised right now: the best match of either hand (for the trainer's live readout). */
  current: Match | null = null;
  currents: Record<Slot, Match | null> = { L: null, R: null };
  private slots: Record<Slot, SlotState> = { L: fresh(), R: fresh() };
  /** How many hands hold each held action (block stays pressed while any hand holds it). */
  private held = new Map<string, number>();
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
    // Which hand is which: with two hands the left and right of the picture; one hand is whichever side it is on.
    const seen = hands.filter((h) => h.length >= 21).sort((a, b) => 1 - a[9].x - (1 - b[9].x));
    const by: Record<Slot, Hand | undefined> = { L: undefined, R: undefined };
    if (seen.length >= 2) [by.L, by.R] = [seen[0], seen[seen.length - 1]];
    else if (seen.length === 1) by[1 - seen[0][9].x < 0.5 ? "L" : "R"] = seen[0];
    for (const slot of ["L", "R"] as const) this.tick(slot, by[slot], t, out);
    this.current = [this.currents.R, this.currents.L].filter((m): m is Match => !!m).sort((a, b) => a.dist - b.dist)[0] ?? null;
    return out;
  }

  private tick(slot: Slot, hand: Hand | undefined, t: number, out: GestureEvent[]): void {
    const st = this.slots[slot];
    const f = hand && poseFeatures(hand, slot === "L");
    const m = f ? classify(f, this.set) : null;
    this.currents[slot] = m;
    const id = m?.pose.id ?? null;
    if (id === st.seen) st.count++;
    else {
      st.seen = id;
      st.count = 1;
    }
    if (st.count >= POSE.confirmFrames && id && st.active?.id !== id) {
      this.leave(st, out);
      const pose = m!.pose;
      st.active = pose;
      const a = pose.action;
      if (a === "none") return;
      const key = `${slot}${pose.id}`;
      if (HELD.includes(a)) {
        const n = (this.held.get(a) ?? 0) + 1;
        this.held.set(a, n);
        if (n === 1) out.push({ action: a as Action, type: "press" });
      } else if (t >= (this.cool[key] ?? 0)) {
        this.cool[key] = t + POSE.cooldown;
        out.push({ action: a as Action, type: "press" });
        this.releases.push({ action: a as Action, at: t + POSE.tapSeconds });
      }
    } else if (st.active && st.seen !== st.active.id) {
      if (++st.off >= POSE.releaseFrames) this.leave(st, out);
    } else st.off = 0;
  }

  private leave(st: SlotState, out: GestureEvent[]): void {
    const a = st.active?.action;
    if (a && HELD.includes(a)) {
      const n = (this.held.get(a) ?? 1) - 1;
      this.held.set(a, Math.max(0, n));
      if (n <= 0) out.push({ action: a as Action, type: "release" });
    }
    st.active = null;
    st.off = 0;
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
