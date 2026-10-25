/**
 * The movement stick from the left hand. Pure: landmarks + a clock in, an axis out.
 * Everything else (strike, guard, step, jump, gourd, lock-on) is a hand POSE the player trains
 * (poses.ts); there are no swipes or fist rules any more.
 *
 * Hold the LEFT hand (left half of the preview) where it feels natural: that spot is the centre.
 * Raise it to walk toward the boss, lower it to back off, move it left / right to strafe.
 * Closing the fist sets a new centre. A lone hand takes the role of the side it first appears on.
 */
import type { Action } from "../core/Input";
import { deadzone, type Axis } from "./axes";

export interface Pt {
  x: number;
  y: number;
  z?: number;
}
export type Hand = Pt[];
export interface GestureEvent {
  action: Action;
  type: "press" | "release";
}

export const GESTURE = {
  trackKeep: 0.3,
  /** How far (fraction of the view width) the left hand travels for full stick. */
  stickRadius: 0.14,
  stickDead: 0.2,
};

const FINGERS: [number, number][] = [[8, 6], [12, 10], [16, 14], [20, 18]]; // [tip, pip]
const d = (a: Pt, b: Pt) => Math.hypot(a.x - b.x, a.y - b.y);
const ok = (h: Hand) => h.length >= 21 && Number.isFinite(h[9].x) && Number.isFinite(h[9].y) && Number.isFinite(h[0].x) && Number.isFinite(h[0].y);
const isFist = (h: Hand) => FINGERS.filter(([tip, pip]) => d(h[tip], h[0]) < d(h[pip], h[0])).length >= 3;

interface Track {
  /** Mirrored x (your right hand has the larger value), y as in the image. */
  x: number;
  y: number;
  t: number;
  /** The stick's centre. */
  nx: number;
  ny: number;
  fist: boolean;
}

export class GestureTracker {
  /** Movement stick from the left hand: forward is +y, right is +x. */
  axis: Axis = { x: 0, y: 0 };
  debug = { hands: 0 };
  private track?: Track;

  /** Kept so callers keep one shape: the stick never emits press/release events. */
  update(hands: Hand[], t: number): GestureEvent[] {
    if (this.track && t - this.track.t > GESTURE.trackKeep) this.track = undefined;
    const seen = hands
      .filter(ok)
      .map((h) => ({ h, mx: 1 - h[9].x, y: h[9].y }))
      .sort((a, b) => a.mx - b.mx);
    this.debug.hands = seen.length;

    // two hands: the left one moves; one hand: it moves if it is on the left half or is the hand already being tracked
    let mover: (typeof seen)[number] | undefined;
    if (seen.length >= 2) mover = seen[0];
    else if (seen.length === 1) {
      const s = seen[0];
      const prev = this.track;
      mover = s.mx < 0.5 || (prev && Math.hypot(prev.x - s.mx, prev.y - s.y) < 0.3) ? s : undefined;
    }
    if (mover && d(mover.h[9], mover.h[0]) >= 0.02) {
      const fist = isFist(mover.h);
      const prev = this.track;
      const tr: Track = { x: mover.mx, y: mover.y, t, nx: prev?.nx ?? mover.mx, ny: prev?.ny ?? mover.y, fist };
      // closing the fist sets a new stick centre where the hand is
      if (fist && !prev?.fist) {
        tr.nx = mover.mx;
        tr.ny = mover.y;
      }
      this.track = tr;
    }
    const mv = this.track;
    this.axis = mv ? deadzone({ x: (mv.x - mv.nx) / GESTURE.stickRadius, y: (mv.ny - mv.y) / GESTURE.stickRadius }, GESTURE.stickDead) : { x: 0, y: 0 };
    if (!Number.isFinite(this.axis.x) || !Number.isFinite(this.axis.y)) this.axis = { x: 0, y: 0 };
    return [];
  }

  get status(): string {
    return this.axis.x !== 0 || this.axis.y !== 0 ? "moving" : this.track ? "left hand" : "no hand";
  }
}
