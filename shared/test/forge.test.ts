import { describe, expect, it } from "vitest";
import { cleanCombo, cleanForge, parseDigest } from "../src/forge";

const MOVES = ["leap", "combo", "comboDelay", "overhead", "thrust", "sweep", "grab", "flurry"];

describe("parseDigest", () => {
  it("clamps numbers, drops unknown moves, rejects an empty move list", () => {
    const d = parseDigest({ boss: 9, lvl: -5, duels: 3, won: true, style: { agg: 7 }, moves: [...MOVES, "evil", 4], works: ["thrust", "x"], cond: "bogus" });
    expect(d).toMatchObject({ boss: 3, lvl: 0, duels: 3, won: true, cond: "none" });
    expect(d!.style.agg).toBe(1);
    expect(d!.moves).toEqual(MOVES);
    expect(d!.works).toEqual(["thrust"]);
    expect(parseDigest({ moves: [] })).toBeNull();
    expect(parseDigest(null)).toBeNull();
  });
});

describe("cleanCombo", () => {
  it("accepts a playable combo and rejects moves he lacks, repeats, short or too long ones, and three perils in a row", () => {
    expect(cleanCombo(["thrust", "sweep", "combo"], MOVES, 4)).toEqual(["thrust", "sweep", "combo"]);
    expect(cleanCombo(["thrust", "windSlash", "combo"], MOVES, 4)).toBeNull();
    expect(cleanCombo(["combo", "combo", "leap"], MOVES, 4)).toBeNull();
    expect(cleanCombo(["combo", "leap"], MOVES, 4)).toBeNull();
    expect(cleanCombo(["thrust", "sweep", "grab", "combo"], MOVES, 9)).toBeNull();
    expect(cleanCombo(Array.from({ length: 9 }, (_, i) => MOVES[i % 2]), MOVES, 3)).toBeNull(); // 9 is too long at level 3
    expect(cleanCombo(Array.from({ length: 9 }, (_, i) => MOVES[i % 2]), MOVES, 20)).not.toBeNull();
  });
});

describe("cleanForge", () => {
  const ctx = { moves: MOVES, level: 6, cond: "afterDodge" };
  it("keeps good combos, a valid tactic and condition, and a teachable new move", () => {
    const f = cleanForge({ combos: [{ name: "Red Dawn", moves: ["leap", "combo", "overhead"] }, { name: "Bad", moves: ["leap", "leap", "leap"] }], tactic: "kite", cond: "whenOpen", teach: "windSlash", note: "He will keep away now." }, ctx);
    expect(f.combos).toEqual([{ name: "Red Dawn", moves: ["leap", "combo", "overhead"] }]);
    expect(f).toMatchObject({ tactic: "kite", cond: "whenOpen", teach: "windSlash", note: "He will keep away now." });
  });
  it("lets a combo use the move it is teaching him in the same answer", () => {
    const f = cleanForge({ combos: [{ name: "Gale", moves: ["windSlash", "leap", "combo"] }], tactic: "mixed", cond: "none", teach: "windSlash", note: "" }, ctx);
    expect(f.combos).toHaveLength(1);
  });
  it("refuses to teach a move he has, an unknown one, or anything before level 3", () => {
    expect(cleanForge({ teach: "leap" }, ctx).teach).toBe("none");
    expect(cleanForge({ teach: "nuke" }, ctx).teach).toBe("none");
    expect(cleanForge({ teach: "lunge" }, { ...ctx, level: 2 }).teach).toBe("none");
  });
  it("garbage in, safe defaults out (keeps the current condition)", () => {
    expect(cleanForge("nonsense", ctx)).toEqual({ combos: [], tactic: "mixed", cond: "afterDodge", teach: "none", note: "" });
    expect(cleanForge({ combos: "x", tactic: 5, cond: "x" }, ctx).cond).toBe("afterDodge");
  });
  it("at most three combos, names cleaned and capped, profanity dropped", () => {
    const c = (n: string) => ({ name: n, moves: ["leap", "combo", "overhead"] });
    const f = cleanForge({ combos: [c("a b c d e f"), c("shit storm"), c("<script>x</script>"), c("four")], tactic: "crowd", cond: "none", teach: "none", note: "" }, ctx);
    expect(f.combos.length).toBeLessThanOrEqual(2);
    expect(f.combos[0].name.split(" ").length).toBeLessThanOrEqual(4);
    expect(f.combos.every((x) => !/script|shit/i.test(x.name) || !/shit/i.test(x.name))).toBe(true);
  });
});
