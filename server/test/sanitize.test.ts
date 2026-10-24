import { describe, expect, it } from "vitest";
import { cleanNickname, parseStats, sessionSlug } from "../src/sanitize";
import { bossLevel } from "../src/bossLevel";

describe("cleanNickname", () => {
  it("empty or whitespace becomes Wanderer", () => {
    expect(cleanNickname("  ")).toBe("Wanderer");
    expect(cleanNickname(undefined)).toBe("Wanderer");
    expect(cleanNickname(42)).toBe("Wanderer");
  });
  it("caps at 20 characters", () => {
    expect(cleanNickname("x".repeat(500)).length).toBe(20);
  });
  it("removes control and zero-width characters and collapses spaces", () => {
    expect(cleanNickname("a\u0000b\u200Bc\n  d")).toBe("abc d");
  });
  it("keeps emoji and normal text", () => {
    expect(cleanNickname("Kenji 侍")).toBe("Kenji 侍");
  });
});

describe("sessionSlug", () => {
  it("is ascii [A-Za-z0-9_-] only and never empty", () => {
    expect(sessionSlug("Kenji 侍; DROP TABLE")).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(sessionSlug("侍侍")).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(sessionSlug("侍侍").length).toBeGreaterThan(0);
  });
});

describe("parseStats", () => {
  it("returns null for non-objects", () => {
    expect(parseStats(null)).toBeNull();
    expect(parseStats("x")).toBeNull();
    expect(parseStats([])).toBeNull();
  });
  it("coerces junk numbers to 0, clamps huge values, filters hitsByMove to real moves", () => {
    const s = parseStats({ fightSeconds: "abc", deflects: -4, blocks: 1e12, hitsByMove: { combo: 3, fireball: 9, thrust: "x" }, victory: 1, extra: "ignored" })!;
    expect(s.fightSeconds).toBe(0);
    expect(s.deflects).toBe(0);
    expect(s.blocks).toBe(1_000_000);
    expect(s.hitsByMove).toEqual({ combo: 3 });
    expect(s.victory).toBe(true);
    expect((s as any).extra).toBeUndefined();
  });
  it("accepts {} as an all-zero fight (idle player)", () => {
    const s = parseStats({})!;
    expect(s.deflects).toBe(0);
    expect(s.firstHealAtSeconds).toBeNull();
    expect(s.medianDeflectTiming).toBeNull();
  });
});

describe("bossLevel", () => {
  it("is 1 + floor(total/8), capped at 10", () => {
    expect(bossLevel(0)).toBe(1);
    expect(bossLevel(7)).toBe(1);
    expect(bossLevel(8)).toBe(2);
    expect(bossLevel(72)).toBe(10);
    expect(bossLevel(10_000)).toBe(10);
    expect(bossLevel(-3)).toBe(1);
    expect(bossLevel(NaN)).toBe(1);
  });
});

