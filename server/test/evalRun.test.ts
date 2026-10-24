import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { rulesPlan } from "@gr/shared";
import { appendSummary, evalSet, percentile, readSummary, type SummaryRow } from "../src/evalRun";
import { buildHeldout, buildSeed } from "../src/sim/sets";

const items = buildHeldout(buildSeed());
const rules = async (input: any) => ({ out: rulesPlan(input.habits, input.bossLevel), ok: true, latencyMs: 10 });

describe("percentile", () => {
  it("nearest-rank on a known list", () => {
    const xs = [10, 20, 30, 40, 50, 60, 70, 80, 90, 100];
    expect(percentile(xs, 50)).toBe(50);
    expect(percentile(xs, 95)).toBe(100);
    expect(percentile([], 50)).toBe(0);
    expect(percentile([7], 95)).toBe(7);
  });
});

describe("evalSet", () => {
  it("the rules baseline is fully valid and on target (by construction) with no violations", async () => {
    const r = await evalSet(items, rules);
    expect(r.n).toBe(60);
    expect(r.valid_rate).toBe(1);
    expect(r.target_rate).toBe(1);
    expect(r.violations).toBe(0);
    expect(r.p50_ms).toBe(10);
    expect(r.agree_rate).toBe("");
  });
  it("failed calls count as invalid and off target, with fallback plan not credited", async () => {
    const r = await evalSet(items, async () => ({ out: undefined, ok: false, latencyMs: 5 }));
    expect(r.valid_rate).toBe(0);
    expect(r.target_rate).toBe(0);
  });
  it("hostile plans are counted as violations and never throw", async () => {
    const bad = async () => ({ out: { focus_habit: "x", opening_strings: Array.from({ length: 9 }, () => ["fireball"]), emphasis: 1, tempo_step: 99, gap_step: 9, intel: 1, taunt: 2 }, ok: true, latencyMs: 1 });
    const r = await evalSet(items, bad);
    expect(r.violations).toBeGreaterThan(0);
    expect(r.valid_rate).toBe(0);
  });
  it("agreement against a reference run: same plans agree fully, different plans do not", async () => {
    const ref = await evalSet(items, rules, { keepPlans: true });
    const same = await evalSet(items, rules, { reference: ref.plans });
    expect(same.agree_rate).toBe(1);
    const other = await evalSet(items, async (i: any) => ({ out: { ...rulesPlan([], 1) }, ok: true, latencyMs: 1 }), { reference: ref.plans });
    expect(other.agree_rate).toBeLessThan(1);
  });
  it("cost per 1k uses logged token means and the Mubit run fee", async () => {
    const r = await evalSet(items, async (input: any) => ({ out: rulesPlan(input.habits, input.bossLevel), ok: true, latencyMs: 1, usage: { prompt_tokens: 1500, completion_tokens: 100 } }), { prices: [0.1, 0.5] });
    expect(r.mean_in_tok).toBe(1500);
    expect(r.cost_per_1k).toBeCloseTo(5.2, 6);
  });
});

describe("summary csv", () => {
  it("appends rows with one header and reads them back", () => {
    const file = join(mkdtempSync(join(tmpdir(), "gr-sum-")), "summary.csv");
    const base: SummaryRow = { label: "baseline", iso: "t", n: 60, valid_rate: 1, target_rate: 1, agree_rate: 1, violations: 0, p50_ms: 1, p95_ms: 2, mean_in_tok: 0, mean_out_tok: 0, cost_per_1k: "", notes: "a, b" };
    appendSummary(base, file);
    appendSummary({ ...base, label: "provider" }, file);
    expect(readFileSync(file, "utf8").trim().split("\n").length).toBe(3);
    const rows = readSummary(file);
    expect(rows.map((r) => r.label)).toEqual(["baseline", "provider"]);
    expect(rows[0].notes).toBe("a, b");
    expect(rows[0].n).toBe(60);
  });
  it("a missing file reads as no rows", () => {
    expect(readSummary("/definitely/not/here.csv")).toEqual([]);
  });
});