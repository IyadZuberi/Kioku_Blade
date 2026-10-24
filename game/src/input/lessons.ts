/** The hand-training checklist: which gesture has been seen yet. Pure, so the window and the tests share it. */
import type { GestureEvent } from "./gestureLogic";

export type LessonId = "hands" | "forward" | "back" | "left" | "right" | "guard" | "strike" | "step" | "jump";
export interface Lesson {
  id: LessonId;
  title: string;
  hint: string;
  hand: "left" | "right" | "both";
}

export const LESSONS: Lesson[] = [
  { id: "hands", title: "Show both hands", hint: "Hold both hands up to the camera, palms open. Your left hand stays on the left half of the picture, your right on the right.", hand: "both" },
  { id: "forward", title: "Walk forward", hint: "Raise your left hand a little above where it rests.", hand: "left" },
  { id: "back", title: "Step back", hint: "Lower your left hand below where it rests.", hand: "left" },
  { id: "left", title: "Move left", hint: "Slide your left hand to the left.", hand: "left" },
  { id: "right", title: "Move right", hint: "Slide your left hand to the right.", hand: "left" },
  { id: "guard", title: "Guard", hint: "Close your right hand into a fist. Hold it to block; close it just before a hit to deflect.", hand: "right" },
  { id: "strike", title: "Strike", hint: "Swipe your right hand sideways, fast and with an open hand.", hand: "right" },
  { id: "step", title: "Step", hint: "Swipe your right hand down, fast and open.", hand: "right" },
  { id: "jump", title: "Jump", hint: "Flick your right hand up, fast and open.", hand: "right" },
];

const BY_ACTION: Record<string, LessonId> = { block: "guard", attack: "strike", dodge: "step", jump: "jump" };

export class LessonTracker {
  readonly done = new Set<LessonId>();

  /** Feed one frame; returns the lessons that were completed by it. */
  update(events: GestureEvent[], axis: { x: number; y: number }, hands: number): LessonId[] {
    const fresh: LessonId[] = [];
    const mark = (id: LessonId) => {
      if (!this.done.has(id)) (this.done.add(id), fresh.push(id));
    };
    if (hands >= 2) mark("hands");
    if (axis.y > 0.5) mark("forward");
    if (axis.y < -0.5) mark("back");
    if (axis.x < -0.5) mark("left");
    if (axis.x > 0.5) mark("right");
    for (const e of events) if (e.type === "press" && BY_ACTION[e.action]) mark(BY_ACTION[e.action]);
    return fresh;
  }

  get complete(): boolean {
    return this.done.size === LESSONS.length;
  }

  reset(): void {
    this.done.clear();
  }
}