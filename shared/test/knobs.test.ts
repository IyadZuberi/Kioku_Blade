import { describe, expect, it } from "vitest";
import { applyEmphasis, EMPHASIS_FACTOR, GAP_BY_STEP, TEMPO_P2_BY_STEP } from "../src/knobs";
import { MOVES, type Level3, type Move } from "../src/types";

const all = (l: Level3) => Object.fromEntries(MOVES.map((m) => [m, l])) as Record<Move, Level3>;

describe("knobs", () => {
  it("TEMPO_P2_BY_STEP is increasing and tops out at the base HARD preset (1.12)", () => {
    expect(TEMPO_P2_BY_STEP[0]).toBeGreaterThanOrEqual(1);
    expect(Math.max(...TEMPO_P2_BY_STEP)).toBe(1.12);
    for (let i = 1; i < TEMPO_P2_BY_STEP.length; i++) expect(TEMPO_P2_BY_STEP[i]).toBeGreaterThan(TEMPO_P2_BY_STEP[i - 1]);
  });
  it("GAP_BY_STEP starts at MEDIUM and ends at the base HARD gaps", () => {
    expect(GAP_BY_STEP[0]).toEqual({ p1: [0.6, 0.8], p2: [0.35, 0.55] });
    expect(GAP_BY_STEP[3]).toEqual({ p1: [0.35, 0.6], p2: [0.15, 0.35] });
    for (let i = 1; i < GAP_BY_STEP.length; i++) expect(GAP_BY_STEP[i].p2[0]).toBeLessThan(GAP_BY_STEP[i - 1].p2[0]);
  });
  it("applyEmphasis sums to 1 and orders high > normal > low for the same base weight", () => {
    const base = { combo: 0.3, overhead: 0.3, thrust: 0.3, idle: 0.1 };
    const w = applyEmphasis(base, { ...all("normal"), combo: "high", thrust: "low" });
    expect(Object.values(w).reduce((a, b) => a + b, 0)).toBeCloseTo(1, 10);
    expect(w.combo).toBeGreaterThan(w.overhead);
    expect(w.overhead).toBeGreaterThan(w.thrust);
  });
  it("applyEmphasis keeps idle as a pick weight and ignores moves absent from the base", () => {
    const w = applyEmphasis({ combo: 0.5, idle: 0.5 }, all("high"));
    expect(Object.keys(w).sort()).toEqual(["combo", "idle"]);
    expect(w.idle).toBeGreaterThan(0);
  });
  it("factor table", () => {
    expect(EMPHASIS_FACTOR).toEqual({ low: 0.5, normal: 1, high: 1.8 });
  });
});

