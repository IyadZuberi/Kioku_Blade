import { describe, expect, it } from "vitest";
import { rulesPlan, type HabitScore } from "@gr/shared";
import { formatIntel, habitBars, highMoves, sourceLine } from "../src/ui/councilText";

const h = (habit: HabitScore["habit"], strength: number): HabitScore => ({ habit, strength, evidence: "e" });

describe("formatIntel", () => {
  it("keeps the real numbers from the intel lines and adds the plan's sentence", () => {
    const plan = { ...rulesPlan([h("block_holder", 1)], 3), intel: "Your guard is a wall." };
    const out = formatIntel(plan, ["You blocked 14 times, deflected 2."]);
    expect(out[0]).toContain("14");
    expect(out).toContain("Your guard is a wall.");
  });
  it("trims the plan sentence to 25 words and keeps at most 3 lines", () => {
    const long = Array.from({ length: 40 }, (_, i) => `w${i}`).join(" ");
    const out = formatIntel({ ...rulesPlan([], 1), intel: long }, ["a.", "b.", "c.", "d."]);
    expect(out.length).toBeLessThanOrEqual(3);
    for (const l of out) expect(l.split(" ").length).toBeLessThanOrEqual(25);
  });
  it("drops an intel line that the plan sentence already starts with", () => {
    const plan = { ...rulesPlan([h("block_holder", 1)], 3), intel: "You blocked 14 times, deflected 2. I will answer with thrust." };
    const out = formatIntel(plan, ["You blocked 14 times, deflected 2."]);
    expect(out).toEqual(["You blocked 14 times, deflected 2. I will answer with thrust."]);
  });
  it("with no habits shows one neutral line (no duplicate)", () => {
    const plan = rulesPlan([], 1);
    const out = formatIntel(plan, ["I could not read a clear pattern yet."]);
    expect(out.length).toBe(1);
  });
});

describe("habitBars", () => {
  it("aligns two fights and treats a missing habit as 0", () => {
    const bars = habitBars([h("block_holder", 0.8)], [h("block_holder", 0.5), h("dodge_spammer", 0.9)]);
    const d = Object.fromEntries(bars.map((b) => [b.habit, b]));
    expect(d.block_holder).toMatchObject({ prev: 0.8, now: 0.5 });
    expect(d.dodge_spammer).toMatchObject({ prev: 0, now: 0.9 });
    expect(bars[0].habit).toBe("dodge_spammer");
  });
  it("is empty when neither fight had habits and caps at 4 rows", () => {
    expect(habitBars([], [])).toEqual([]);
    const many = (["block_holder", "deflect_expert", "dodge_spammer", "jump_dependent", "heal_greedy", "passive"] as const).map((x) => h(x, 0.5));
    expect(habitBars([], many).length).toBe(4);
  });
});

describe("highMoves / sourceLine", () => {
  it("lists the moves at high emphasis in canonical order", () => {
    expect(highMoves(rulesPlan([h("block_holder", 1)], 5))).toEqual(["thrust", "grab", "flurry", "kick"]);
  });
  it("labels the source honestly", () => {
    expect(sourceLine({ source: "mubit", latencyMs: 412, requestId: "mreq_abc", valid: true })).toContain("mubit");
    expect(sourceLine({ source: "mubit", latencyMs: 412, requestId: "mreq_abc", valid: true })).toContain("mreq_abc");
    expect(sourceLine({ source: "rules", latencyMs: 0, valid: false })).toMatch(/rules/);
    expect(sourceLine({ source: "local", latencyMs: 6000, valid: false })).toMatch(/offline/i);
    expect(sourceLine({ source: "replay", latencyMs: 0, valid: true })).toMatch(/replay/i);
  });
});