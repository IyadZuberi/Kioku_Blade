import crypto from "node:crypto";
import seedrandom from "seedrandom";
import { describe, expect, it } from "vitest";
import { ACCEPTED_COUNTERS, HABITS, computeHabits } from "@gr/shared";
import { genInput, genStats, type Archetype } from "../src/sim/archetypes";
import { buildHeldout, buildSeed } from "../src/sim/sets";

const hash = (x: unknown) => crypto.createHash("sha1").update(JSON.stringify(x)).digest("hex");

describe("genStats", () => {
  it.each(HABITS)("%s archetype makes that habit the top computeHabits result in >= 90 of 100 draws", (h) => {
    const rng = seedrandom("t-" + h);
    let hit = 0;
    for (let i = 0; i < 100; i++) if (computeHabits(genStats(h, rng))[0]?.habit === h) hit++;
    expect(hit).toBeGreaterThanOrEqual(90);
  });
  it('"none" archetype yields no habits', () => {
    const rng = seedrandom("none");
    for (let i = 0; i < 50; i++) expect(computeHabits(genStats("none", rng))).toEqual([]);
  });
  it("is deterministic for a fixed seed", () => {
    expect(genStats("dodge_spammer", seedrandom("a"))).toEqual(genStats("dodge_spammer", seedrandom("a")));
  });
  it("never produces NaN, infinity or negatives", () => {
    const rng = seedrandom("nan");
    const kinds: Archetype[] = [...HABITS, "mixed", "none"];
    for (let i = 0; i < 200; i++) {
      const s = genStats(kinds[i % kinds.length], rng);
      for (const [k, v] of Object.entries(s)) if (typeof v === "number") expect(Number.isFinite(v) && v >= 0, `${k}=${v}`).toBe(true);
    }
  });
});

describe("genInput", () => {
  it("habits match computeHabits(stats); limits match the boss level; rules are strings", () => {
    const rng = seedrandom("in");
    for (let i = 0; i < 30; i++) {
      const x = genInput("block_holder", rng, i);
      expect(x.habits).toEqual(computeHabits(x.stats));
      expect(x.limits.maxStrings).toBeGreaterThanOrEqual(1);
      expect(x.fight).toBeGreaterThanOrEqual(1);
      expect(x.designerRules.every((r) => typeof r === "string")).toBe(true);
    }
  });
});

describe("seed and held-out sets", () => {
  const seed = buildSeed();
  const held = buildHeldout(seed);
  it("have 80 and 60 items", () => {
    expect(seed.length).toBe(80);
    expect(held.length).toBe(60);
  });
  it("share no input (hash-checked) and ids are unique", () => {
    const s = new Set(seed.map(hash));
    expect(held.some((h) => s.has(hash(h.input)))).toBe(false);
    expect(new Set(held.map((h) => h.id)).size).toBe(60);
    expect(new Set(seed.map(hash)).size).toBe(80);
  });
  it("labels agree with the grader's table", () => {
    for (const h of held) {
      expect(h.label.primary).toBe(h.input.habits[0]?.habit ?? "none");
      expect(h.label.accepted).toEqual(h.label.primary === "none" ? [] : ACCEPTED_COUNTERS[h.label.primary]);
    }
  });
  it("cover every habit family in the seed", () => {
    const tops = new Set<string>(seed.map((i) => i.habits[0]?.habit ?? "none"));
    for (const h of HABITS) expect(tops.has(h)).toBe(true);
    expect(tops.has("none")).toBe(true);
  });
  it("are reproducible", () => {
    expect(hash(buildSeed())).toBe(hash(seed));
  });
});