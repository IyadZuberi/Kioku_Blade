import { describe, expect, it } from "vitest";
import { CAL_STEPS, CalibrationRecorder } from "../src/input/calibration";

const hand = Array.from({ length: 21 }, (_, i) => ({ x: 0.123456 + i * 0.01, y: 0.5 }));

describe("CalibrationRecorder", () => {
  it("walks the script: a get-ready beat, then each step, then ends", () => {
    const r = new CalibrationRecorder([
      { id: "a", say: "A", seconds: 1 },
      { id: "b", say: "B", seconds: 2, expect: "attack" },
    ]);
    expect(r.total).toBeCloseTo(2.5 + 1 + 2.5 + 2, 6);
    expect(r.at(10)).toMatchObject({ ready: true, index: 0 });
    expect(r.at(12.6)).toMatchObject({ ready: false, index: 0 });
    expect(r.at(14)).toMatchObject({ ready: true, index: 1 });
    expect(r.at(16.1)).toMatchObject({ ready: false, index: 1 });
    expect(r.at(18.1)).toBeNull();
  });
  it("records frames with the step label, rounded landmarks, events and the stick", () => {
    const r = new CalibrationRecorder([{ id: "a", say: "A", seconds: 1 }]);
    expect(r.record(0, [hand], [], { x: 0, y: 0 }, 0)).toBe(true);
    expect(r.record(3, [hand, hand], [{ action: "attack", type: "press" }], { x: 0.5, y: -0.25 }, 7.123456)).toBe(true);
    expect(r.record(4, [], [], { x: 0, y: 0 }, 0)).toBe(false);
    expect(r.frames.map((f) => f.step)).toEqual(["ready-a", "a"]);
    expect(r.frames[1]).toMatchObject({ events: ["press:attack"], axis: [0.5, -0.25], speed: 7.1235 });
    expect(r.frames[1].hands[0][0]).toEqual([0.1235, 0.5]);
    expect(r.frames[1].hands).toHaveLength(2);
  });
  it("the default script covers every gesture the game reads", () => {
    const expects = new Set(CAL_STEPS.map((s) => s.expect).filter(Boolean));
    for (const e of ["block", "attack", "dodge", "jump", "forward", "back", "left", "right"]) expect(expects.has(e as never)).toBe(true);
  });
  it("exports a tagged file", () => {
    const r = new CalibrationRecorder();
    r.record(0, [hand], [], { x: 0, y: 0 }, 0);
    const f = r.toFile("UA");
    expect(f).toMatchObject({ kind: "kioku-gesture-calibration", version: 1, userAgent: "UA" });
    expect(f.frames).toHaveLength(1);
  });
});
