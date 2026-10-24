import { describe, expect, it } from "vitest";
import { PadMapper, type PadSnapshot } from "../src/input/gamepadLogic";

const pad = (o: Partial<PadSnapshot> = {}): PadSnapshot => ({ axes: [0, 0, 0, 0], buttons: Array.from({ length: 17 }, () => false), ...o });
const press = (...idx: number[]) => pad({ buttons: Array.from({ length: 17 }, (_, i) => idx.includes(i)) });

describe("PadMapper", () => {
  it("left stick moves with a dead zone (stick up = forward = +y)", () => {
    const m = new PadMapper();
    expect(m.update(pad({ axes: [0.1, -0.1, 0, 0] })).axis).toEqual({ x: 0, y: 0 });
    const a = m.update(pad({ axes: [0, -1, 0, 0] })).axis;
    expect(a.y).toBeCloseTo(1, 6);
    expect(a.x).toBeCloseTo(0, 6);
    expect(m.update(pad({ axes: [1, 0, 0, 0] })).axis.x).toBeCloseTo(1, 6);
  });
  it("face buttons: A jump, B dodge, X attack, Y heal (press on the edge only)", () => {
    const m = new PadMapper();
    const ev = (idx: number) => m.update(press(idx)).events;
    expect(ev(0)).toEqual([{ action: "jump", type: "press" }]);
    expect(m.update(press(0)).events).toEqual([]); // held: no repeat
    expect(m.update(pad()).events).toEqual([{ action: "jump", type: "release" }]);
    expect(ev(1)).toEqual([{ action: "dodge", type: "press" }]);
    m.update(pad());
    expect(ev(2)).toEqual([{ action: "attack", type: "press" }]);
    m.update(pad());
    expect(ev(3)).toEqual([{ action: "heal", type: "press" }]);
  });
  it("triggers and bumpers: LB / LT guard, RB / RT strike, either stick click locks on", () => {
    const m = new PadMapper();
    expect(m.update(press(4)).events).toEqual([{ action: "block", type: "press" }]);
    m.update(pad());
    expect(m.update(press(6)).events).toEqual([{ action: "block", type: "press" }]);
    m.update(pad());
    expect(m.update(press(7)).events).toEqual([{ action: "attack", type: "press" }]);
    m.update(pad());
    expect(m.update(press(10)).events).toEqual([{ action: "lock", type: "press" }]);
  });
  it("two buttons for one action hold it until both are released", () => {
    const m = new PadMapper();
    m.update(press(4));
    expect(m.update(press(4, 6)).events).toEqual([]);
    expect(m.update(press(6)).events).toEqual([]);
    expect(m.update(pad()).events).toEqual([{ action: "block", type: "release" }]);
  });
  it("a disconnected pad (null) releases everything that was held", () => {
    const m = new PadMapper();
    m.update(press(4, 2));
    const r = m.update(null);
    expect(r.axis).toEqual({ x: 0, y: 0 });
    expect(r.events).toEqual(expect.arrayContaining([{ action: "block", type: "release" }, { action: "attack", type: "release" }]));
  });
  it("short or odd arrays never throw", () => {
    const m = new PadMapper();
    expect(() => m.update({ axes: [], buttons: [] })).not.toThrow();
    expect(() => m.update({ axes: [NaN, NaN], buttons: [true] })).not.toThrow();
  });
});