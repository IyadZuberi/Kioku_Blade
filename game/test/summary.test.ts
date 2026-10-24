import { describe, expect, it } from "vitest";
import { mark, summarize } from "../src/learn/summary";
import type { DuelStats } from "../src/game/Game";

const fresh = (): DuelStats => ({
  deflects: 0, lateDeflects: 0, blocks: 0, hitsTaken: 0, dodged: 0, nearMisses: 0, playerHits: 0, bossBlocks: 0, bossDeflects: 0,
  breaks: 0, deathblows: 0, finishers: 0, mikiri: 0, sweepsJumped: 0, headKicks: 0, kicks: 0, grabbed: 0, grabsEvaded: 0, heals: 0,
  punishes: 0, resurrections: 0, victory: false, deaths: 0, defeats: 0, timings: [], contactErr: [], hitLog: [], maxPostureSeen: 0,
});

describe("summarize", () => {
  it("counts hitsByMove from real-format hitLog lines (attack name is the 2nd token)", () => {
    const s = fresh();
    const m = mark(s);
    s.hitLog.push("idle@0.52 combo press-none win=0.250", "guard@0.30 thrust press-0.120 win=0.250", "idle@0.10 combo press-none win=0.250", "run@0.2 ? press-none win=0.250", "idle@0.1 fireball press-none win=0.250");
    const r = summarize(s, m, 50, null);
    expect(r.hitsByMove).toEqual({ combo: 2, thrust: 1 });
  });
  it("is a delta since the mark: earlier fights do not leak in", () => {
    const s = fresh();
    s.deflects = 10; s.blocks = 4; s.hitLog.push("idle@0.5 sweep press-none win=0.250"); s.timings.push(0.1, 0.2);
    const m = mark(s);
    s.deflects += 3; s.blocks += 1; s.dodged += 2; s.hitLog.push("idle@0.5 combo press-none win=0.250"); s.timings.push(0.05);
    const r = summarize(s, m, 40, null);
    expect(r).toMatchObject({ deflects: 3, blocks: 1, dodged: 2, fightSeconds: 40 });
    expect(r.hitsByMove).toEqual({ combo: 1 });
    expect(r.medianDeflectTiming).toBe(0.05);
  });
  it("empty fight gives zeros and null timings (no NaN)", () => {
    const s = fresh();
    const r = summarize(s, mark(s), 0, null);
    expect(r.deflects).toBe(0);
    expect(r.medianDeflectTiming).toBeNull();
    expect(r.firstHealAtSeconds).toBeNull();
    expect(r.victory).toBe(false);
  });
  it("median of an even count averages the middle two", () => {
    const s = fresh();
    const m = mark(s);
    s.timings.push(0.4, 0.1, 0.3, 0.2);
    expect(summarize(s, m, 10, null).medianDeflectTiming).toBeCloseTo(0.25, 6);
  });
  it("passes through victory, deaths delta and firstHealAt", () => {
    const s = fresh();
    s.deaths = 2;
    const m = mark(s);
    s.deaths = 3; s.victory = true;
    const r = summarize(s, m, 30, 12.5);
    expect(r).toMatchObject({ victory: true, deaths: 1, firstHealAtSeconds: 12.5 });
  });
});