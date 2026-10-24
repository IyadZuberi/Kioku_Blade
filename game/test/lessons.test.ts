import { describe, expect, it } from "vitest";
import { LESSONS, LessonTracker } from "../src/input/lessons";

const ev = (action: string, type = "press") => ({ action, type }) as never;

describe("LessonTracker", () => {
  it("starts empty and lists every lesson once", () => {
    const t = new LessonTracker();
    expect(t.done.size).toBe(0);
    expect(new Set(LESSONS.map((l) => l.id)).size).toBe(LESSONS.length);
  });
  it("both hands in view completes the first lesson; one hand does not", () => {
    const t = new LessonTracker();
    t.update([], { x: 0, y: 0 }, 1);
    expect(t.done.has("hands")).toBe(false);
    expect(t.update([], { x: 0, y: 0 }, 2)).toEqual(["hands"]);
  });
  it("each stick direction completes its own lesson once the stick passes half way", () => {
    const t = new LessonTracker();
    t.update([], { x: 0.4, y: 0.4 }, 2);
    expect([...t.done]).toEqual(["hands"]);
    expect(t.update([], { x: 0, y: 0.8 }, 2)).toEqual(["forward"]);
    expect(t.update([], { x: 0, y: -0.7 }, 2)).toEqual(["back"]);
    expect(t.update([], { x: -0.9, y: 0 }, 2)).toEqual(["left"]);
    expect(t.update([], { x: 0.9, y: 0 }, 2)).toEqual(["right"]);
  });
  it("right-hand presses complete guard, strike, step and jump, and releases or repeats do not", () => {
    const t = new LessonTracker();
    expect(t.update([ev("block")], { x: 0, y: 0 }, 2)).toContain("guard");
    expect(t.update([ev("attack", "release")], { x: 0, y: 0 }, 2)).toEqual([]);
    expect(t.update([ev("attack")], { x: 0, y: 0 }, 2)).toEqual(["strike"]);
    expect(t.update([ev("attack")], { x: 0, y: 0 }, 2)).toEqual([]);
    expect(t.update([ev("dodge"), ev("jump")], { x: 0, y: 0 }, 2).sort()).toEqual(["jump", "step"]);
    expect(t.complete).toBe(false);
  });
  it("is complete when every lesson is done, and reset clears it", () => {
    const t = new LessonTracker();
    t.update([ev("block"), ev("attack"), ev("dodge"), ev("jump")], { x: 0, y: 0.9 }, 2);
    t.update([], { x: 0, y: -0.9 }, 2);
    t.update([], { x: -0.9, y: 0 }, 2);
    t.update([], { x: 0.9, y: 0 }, 2);
    expect(t.complete).toBe(true);
    t.reset();
    expect(t.done.size).toBe(0);
    expect(t.complete).toBe(false);
  });
  it("ignores NaN and non-gesture sources", () => {
    const t = new LessonTracker();
    expect(() => t.update([ev("heal")], { x: NaN, y: NaN }, 0)).not.toThrow();
    expect(t.done.size).toBe(0);
  });
});