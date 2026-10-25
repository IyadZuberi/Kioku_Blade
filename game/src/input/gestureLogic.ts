/**
 * Two-hand gestures to game input. Pure: landmarks + a clock in, press/release events and a
 * movement axis out (the MediaPipe wrapper and the tests both drive it).
 *
 * LEFT hand (the one on the left of your screen preview) is the movement stick:
 *   hold it where it feels natural, that spot is the centre; raise it to walk toward the boss, lower
 *   it to back off, move it left / right to strafe. Close the fist to set a new centre.
 * RIGHT hand fights:
 *   fist (held)            -> guard (closing it just before a blow is the deflect)
 *   fast sideways swipe    -> strike
 *   fast downward swipe    -> step (dodge)
 *   fast upward flick      -> jump
 * A single visible hand takes the role of the side of the view it first appears on.
 * The gourd stays on the keyboard (R) or the pad (Y).
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
export type Role = "move" | "fight";

/** Design values, tuned on the demo laptop. Speeds are in hand-lengths per second (a deliberate swipe is ~8-15, a casual one ~4-6). */
export const GESTURE = {
  swipeSpeed: 3.5,
  trackKeep: 0.3,
  smooth: 0.6,
  dominance: 1.4,
  attackCooldown: 0.4,
  moveCooldown: 0.8,
  tapSeconds: 0.09,
  fistFrames: 2,
  openFrames: 2,
  lostFrames: 5,
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
  vx: number;
  vy: number;
  /** The stick's centre (move hand). */
  nx: number;
  ny: number;
  fist: boolean;
}

export class GestureTracker {
  /** Movement stick from the left hand: forward is +y, right is +x. */
  axis: Axis = { x: 0, y: 0 };
  /** Live numbers for the calibration overlay (?gdebug=1). */
  debug = { hands: 0, speed: 0, peak: 0, vx: 0, vy: 0, role: "fight" as Role };
  /** True when the player has trained hand poses: the fighting hand is then read by PoseTracker, not as swipes and a fist. */
  poseMode = false;
  private tracks: Partial<Record<Role, Track>> = {};
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

    // A hand lost to motion blur for a few frames keeps its track, so a fast swipe still has a speed.
    for (const r of ["move", "fight"] as const) {
      const tr = this.tracks[r];
      if (tr && t - tr.t > GESTURE.trackKeep) delete this.tracks[r];
    }

    const seen = hands
      .filter(ok)
      .map((h) => ({ h, mx: 1 - h[9].x, y: h[9].y }))
      .sort((a, b) => a.mx - b.mx);
    this.debug.hands = seen.length;
    this.debug.speed = 0;
    this.debug.peak = Math.max(0, this.debug.peak - 0.02);

    // Who is who: with two hands the left one moves and the right one fights; a lone hand keeps the
    // role of the nearest recent track, else the role of the side of the view it appears on.
    const assigned: { role: Role; h: Hand; mx: number; y: number }[] = [];
    if (seen.length >= 2) {
      assigned.push({ role: "move", ...seen[0] }, { role: "fight", ...seen[seen.length - 1] });
    } else if (seen.length === 1) {
      const s = seen[0];
      let role: Role = s.mx < 0.5 ? "move" : "fight";
      let best = 0.3;
      for (const r of ["move", "fight"] as const) {
        const tr = this.tracks[r];
        if (tr && Math.hypot(tr.x - s.mx, tr.y - s.y) < best) {
          best = Math.hypot(tr.x - s.mx, tr.y - s.y);
          role = r;
        }
      }
      assigned.push({ role, ...s });
    }

    let fightSeen = false;
    let fightFist = false;
    for (const a of assigned) {
      const { role, h, mx, y } = a;
      this.debug.role = role;
      const scale = d(h[9], h[0]);
      if (scale < 0.02) continue;
      const fist = isFist(h);
      const prev = this.tracks[role];
      const tr: Track = { x: mx, y, t, vx: 0, vy: 0, nx: prev?.nx ?? mx, ny: prev?.ny ?? y, fist };
      if (prev && t > prev.t) {
        const dt = Math.max(t - prev.t, 1 / 60);
        const k = GESTURE.smooth;
        tr.vx = k * ((mx - prev.x) / dt / scale) + (1 - k) * prev.vx;
        tr.vy = k * ((y - prev.y) / dt / scale) + (1 - k) * prev.vy;
      }
      this.tracks[role] = tr;
      const speed = Math.hypot(tr.vx, tr.vy);
      this.debug.speed = Math.max(this.debug.speed, speed);
      this.debug.peak = Math.max(this.debug.peak, speed);
      this.debug.vx = tr.vx;
      this.debug.vy = tr.vy;

      if (role === "move") {
        // closing the fist sets a new stick centre where the hand is
        if (fist && !prev?.fist) {
          tr.nx = mx;
          tr.ny = y;
        }
        continue;
      }

      fightSeen = true;
      fightFist = fist && !this.poseMode;
      if (fist || this.poseMode) continue;
      if (speed < GESTURE.swipeSpeed) continue;
      const ax = Math.abs(tr.vx), ay = Math.abs(tr.vy);
      let action: Action | null = null;
      if (ax >= GESTURE.dominance * ay) action = "attack";
      else if (ay >= GESTURE.dominance * ax) action = tr.vy > 0 ? "dodge" : "jump";
      if (!action || t < (this.cooldownUntil[action] ?? -1)) continue;
      this.cooldownUntil[action] = t + (action === "attack" ? GESTURE.attackCooldown : GESTURE.moveCooldown);
      out.push({ action, type: "press" });
      this.releases.push({ action, at: t + GESTURE.tapSeconds });
    }

    // Movement stick from the left hand (0 when it is not there).
    const mv = this.tracks.move;
    if (mv) this.axis = deadzone({ x: (mv.x - mv.nx) / GESTURE.stickRadius, y: (mv.ny - mv.y) / GESTURE.stickRadius }, GESTURE.stickDead);
    else this.axis = { x: 0, y: 0 };
    if (!Number.isFinite(this.axis.x) || !Number.isFinite(this.axis.y)) this.axis = { x: 0, y: 0 };

    // Guard from the right hand's fist.
    if (fightSeen) this.lost = 0;
    else this.lost++;
    if (fightSeen && fightFist) {
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
    const mv = this.axis.x !== 0 || this.axis.y !== 0 ? "moving" : this.tracks.move ? "left hand" : "";
    const fight = this.blockHeld ? "guard" : this.tracks.fight ? "right hand" : "";
    return [mv, fight].filter(Boolean).join(" · ") || "no hands";
  }
}
