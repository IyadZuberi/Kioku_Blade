import { describe, expect, it } from "vitest";
import { combineAxes, deadzone } from "../src/input/axes";

describe("combineAxes", () => {
  it("sums keyboard and analog sources and clamps the length to 1", () => {
    const d = combineAxes([{ x: 1, y: 0 }, { x: 0, y: 1 }]);
    expect(d.x).toBeCloseTo(Math.SQRT1_2, 9);
    expect(d.y).toBeCloseTo(Math.SQRT1_2, 9);
    const a = combineAxes([{ x: 0.3, y: 0 }, { x: 0.2, y: 0 }]);
    expect(a.x).toBeCloseTo(0.5, 9);
  });
  it("opposite inputs cancel and an empty list is zero", () => {
    expect(combineAxes([{ x: 1, y: 0 }, { x: -1, y: 0 }])).toEqual({ x: 0, y: 0 });
    expect(combineAxes([])).toEqual({ x: 0, y: 0 });
  });
  it("ignores NaN and infinite sources", () => {
    expect(combineAxes([{ x: NaN, y: 1 }, { x: Infinity, y: 0 }, { x: 0.5, y: 0 }])).toEqual({ x: 0.5, y: 0 });
  });
});

describe("deadzone", () => {
  it("is zero inside the zone and rescales smoothly outside it", () => {
    expect(deadzone({ x: 0.1, y: 0.1 }, 0.25)).toEqual({ x: 0, y: 0 });
    const a = deadzone({ x: 0.25, y: 0 }, 0.25);
    expect(a.x).toBeCloseTo(0, 6);
    const b = deadzone({ x: 1, y: 0 }, 0.25);
    expect(b.x).toBeCloseTo(1, 6);
    const c = deadzone({ x: 0.625, y: 0 }, 0.25);
    expect(c.x).toBeCloseTo(0.5, 6);
  });
  it("keeps direction and never exceeds length 1", () => {
    const v = deadzone({ x: 3, y: 4 }, 0.2);
    expect(Math.hypot(v.x, v.y)).toBeCloseTo(1, 6);
    expect(v.x / v.y).toBeCloseTo(0.75, 6);
  });
});