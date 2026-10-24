/**
 * Hand gestures to game actions. Pure: landmarks + a clock in, press/release events out (the
 * MediaPipe wrapper and the tests both drive it). Hand-agnostic on purpose: a fist held anywhere is
 * the guard, a fast swipe with an open hand is a strike, so one hand or two both work.
 *
 *   fist (held)            -> block (closing it just before a blow is the deflect)
 *   fast sideways swipe    -> attack
 *   fast downward swipe    -> dodge
 *   fast upward flick      -> jump
 * Movement and the gourd stay on the keyboard (WASD, R).
 */
import type { Action } from "../core/Input";

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

/** Design values, tuned on the demo laptop. Speeds are in hand-lengths per second. */
export const GESTURE = { swipeSpeed: 6, dominance: 1.4, attackCooldown: 0.4, moveCooldown: 0.8, tapSeconds: 0.09, fistFrames: 2, openFrames: 2, lostFrames: 5 };

const FINGERS: [number, number][] = [[8, 6], [12, 10], [16, 14], [20, 18]]; // [tip, pip]
const d = (a: Pt, b: Pt) => Math.hypot(a.x - b.x, a.y - b.y);
const ok = (h: Hand) => h.length >= 21 && Number.isFinite(h[9].x) && Number.isFinite(h[9].y) && Number.isFinite(h[0].x) && Number.isFinite(h[0].y);
const isFist = (h: Hand) => FINGERS.filter(([tip, pip]) => d(h[tip], h[0]) < d(h[pip], h[0])).length >= 3;

interface Track {
  x: number;
  y: number;
  t: number;
  vx: number;
  vy: number;
}

export class GestureTracker {
  private tracks: (Track | undefined)[] = [];
  private fist = 0;
  private open = 0;
  private lost = 0;
  private blockHeld = false;
  private cooldownUntil: Partial<Record<Action, number>> = {};
  private releases: { action: Action; at: number }[] = [];

  update(hands: Hand[], t: number): GestureEvent[] {
    const out: GestureEvent[] = [];
    this.releases = this.releases.filter((r) => {
      if (r.at > t) return true;
      out.push({ action: r.action, type: "release" });
      return false;
    });

    const valid = hands.filter(ok).sort((a, b) => a[9].x - b[9].x);
    let anyFist = false;
    valid.forEach((h, i) => {
      const scale = d(h[9], h[0]);
      if (scale < 0.02) return;
      const fist = isFist(h);
      anyFist ||= fist;
      const prev = this.tracks[i];
      const tr: Track = { x: h[9].x, y: h[9].y, t, vx: 0, vy: 0 };
      if (prev && t > prev.t) {
        const dt = t - prev.t;
        tr.vx = 0.5 * ((tr.x - prev.x) / dt / scale) + 0.5 * prev.vx;
        tr.vy = 0.5 * ((tr.y - prev.y) / dt / scale) + 0.5 * prev.vy;
      }
      this.tracks[i] = tr;
      if (fist) return;
      const speed = Math.hypot(tr.vx, tr.vy);
      if (speed < GESTURE.swipeSpeed) return;
      const ax = Math.abs(tr.vx), ay = Math.abs(tr.vy);
      let action: Action | null = null;
      if (ax >= GESTURE.dominance * ay) action = "attack";
      else if (ay >= GESTURE.dominance * ax) action = tr.vy > 0 ? "dodge" : "jump";
      if (!action || t < (this.cooldownUntil[action] ?? -1)) return;
      this.cooldownUntil[action] = t + (action === "attack" ? GESTURE.attackCooldown : GESTURE.moveCooldown);
      out.push({ action, type: "press" });
      this.releases.push({ action, at: t + GESTURE.tapSeconds });
    });
    this.tracks.length = valid.length;

    if (valid.length) this.lost = 0;
    else this.lost++;
    if (anyFist) {
      this.fist++;
      this.open = 0;
    } else {
      this.open++;
      this.fist = 0;
    }
    if (!this.blockHeld && this.fist >= GESTURE.fistFrames) {
      this.blockHeld = true;
      out.push({ action: "block", type: "press" });
    } else if (this.blockHeld && (this.open >= GESTURE.openFrames || this.lost >= GESTURE.lostFrames)) {
      this.blockHeld = false;
      out.push({ action: "block", type: "release" });
    }
    return out;
  }

  /** Current state label for the preview HUD. */
  get status(): string {
    return this.blockHeld ? "guard" : this.tracks.length ? "open hand" : "no hand";
  }
}