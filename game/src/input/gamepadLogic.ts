/**
 * Game controller mapping (standard layout: Xbox / PlayStation / Switch Pro in browsers).
 *   left stick      move
 *   A / Cross       jump          B / Circle     step (dodge)
 *   X / Square      strike        Y / Triangle   gourd
 *   LB, LT          guard         RB, RT         strike
 *   L3 or R3        lock on
 * Pure: a snapshot in, an axis and press/release events out.
 */
import type { Action } from "../core/Input";
import { deadzone, type Axis } from "./axes";

export interface PadSnapshot {
  axes: readonly number[];
  buttons: readonly boolean[];
}
export interface PadEvent {
  action: Action;
  type: "press" | "release";
}

const MAP: [number, Action][] = [
  [0, "jump"],
  [1, "dodge"],
  [2, "attack"],
  [3, "heal"],
  [4, "block"],
  [5, "attack"],
  [6, "block"],
  [7, "attack"],
  [10, "lock"],
  [11, "lock"],
];

export class PadMapper {
  private down = new Set<number>();

  update(p: PadSnapshot | null): { axis: Axis; events: PadEvent[] } {
    const events: PadEvent[] = [];
    const now = new Set<number>();
    if (p) p.buttons.forEach((b, i) => b && now.add(i));
    const held = (a: Action, s: Set<number>) => MAP.some(([i, x]) => x === a && s.has(i));
    for (const action of new Set(MAP.map(([, a]) => a))) {
      const was = held(action, this.down), is = held(action, now);
      if (!was && is) events.push({ action, type: "press" });
      else if (was && !is) events.push({ action, type: "release" });
    }
    this.down = now;
    const ax = p ? Number(p.axes[0]) || 0 : 0;
    const ay = p ? Number(p.axes[1]) || 0 : 0;
    // stick up reports -1: forward is +y
    const axis = deadzone({ x: ax, y: -ay }, 0.22);
    return { axis, events };
  }
}