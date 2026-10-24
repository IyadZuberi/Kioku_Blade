/**
 * A guided hand recording: the training window walks the player through each gesture, records the raw
 * hand landmarks and what the tracker made of them, and saves a JSON file. Replaying that file
 * (tools/gesture-replay.ts) shows which gestures were missed or mistaken and lets the thresholds be
 * tuned to how this player actually moves. Pure apart from the clock it is given.
 */
import type { GestureEvent, Hand } from "./gestureLogic";

export interface CalStep {
  id: string;
  /** What to do, shown big over the camera. */
  say: string;
  seconds: number;
  /** The action the step expects (for the replay report). */
  expect?: "block" | "attack" | "dodge" | "jump" | "forward" | "back" | "left" | "right";
}

const READY = 2.5;

export const CAL_STEPS: CalStep[] = [
  { id: "rest", say: "Hold both hands up, relaxed, and keep still", seconds: 4 },
  { id: "forward", say: "Left hand: raise it and hold (walk forward)", seconds: 4, expect: "forward" },
  { id: "back", say: "Left hand: lower it and hold (step back)", seconds: 4, expect: "back" },
  { id: "left", say: "Left hand: slide it left and hold", seconds: 4, expect: "left" },
  { id: "right", say: "Left hand: slide it right and hold", seconds: 4, expect: "right" },
  { id: "guard", say: "Right hand: close your fist for a second, open it, repeat", seconds: 7, expect: "block" },
  { id: "strike", say: "Right hand: swipe sideways, fast, 4 times", seconds: 7, expect: "attack" },
  { id: "step", say: "Right hand: swipe down, fast, 4 times", seconds: 7, expect: "dodge" },
  { id: "jump", say: "Right hand: flick up, fast, 4 times", seconds: 7, expect: "jump" },
  { id: "free", say: "Now fight the way you want to play: mix it all", seconds: 12 },
];

export interface CalFrame {
  t: number;
  step: string;
  /** Raw landmarks as the camera saw them (x, y in 0..1, not mirrored), 4 decimals. */
  hands: number[][][];
  events: string[];
  axis: [number, number];
  speed: number;
}

export interface CalFile {
  kind: "kioku-gesture-calibration";
  version: 1;
  recordedAt: string;
  userAgent: string;
  steps: CalStep[];
  frames: CalFrame[];
}

const r4 = (v: number) => Math.round(v * 1e4) / 1e4;

export class CalibrationRecorder {
  readonly frames: CalFrame[] = [];
  private t0 = -1;
  private readonly timeline: { start: number; end: number; step: CalStep; ready: boolean }[] = [];
  readonly total: number;

  constructor(readonly steps: CalStep[] = CAL_STEPS) {
    let t = 0;
    for (const s of steps) {
      this.timeline.push({ start: t, end: t + READY, step: s, ready: true });
      t += READY;
      this.timeline.push({ start: t, end: t + s.seconds, step: s, ready: false });
      t += s.seconds;
    }
    this.total = t;
  }

  /** Where the script is at clock `now` (seconds): the step, whether it is the get-ready beat, seconds left in it. */
  at(now: number): { step: CalStep; ready: boolean; left: number; index: number } | null {
    if (this.t0 < 0) this.t0 = now;
    const t = now - this.t0;
    const i = this.timeline.findIndex((x) => t >= x.start && t < x.end);
    if (i < 0) return null;
    const x = this.timeline[i];
    return { step: x.step, ready: x.ready, left: x.end - t, index: this.steps.indexOf(x.step) };
  }

  get done(): boolean {
    return this.t0 >= 0 && this.frames.length > 0 && this.frames[this.frames.length - 1].t >= this.total - 0.05;
  }

  /** Record one analysed camera frame. Returns false once the script is over. */
  record(now: number, hands: Hand[], events: GestureEvent[], axis: { x: number; y: number }, speed: number): boolean {
    const a = this.at(now);
    if (!a) return false;
    this.frames.push({
      t: r4(now - this.t0),
      step: a.ready ? `ready-${a.step.id}` : a.step.id,
      hands: hands.map((h) => h.map((p) => [r4(p.x), r4(p.y)])),
      events: events.map((e) => `${e.type}:${e.action}`),
      axis: [r4(axis.x), r4(axis.y)],
      speed: r4(speed),
    });
    return true;
  }

  toFile(userAgent = ""): CalFile {
    return { kind: "kioku-gesture-calibration", version: 1, recordedAt: new Date().toISOString(), userAgent, steps: this.steps, frames: this.frames };
  }
}
