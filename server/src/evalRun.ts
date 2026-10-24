/** The Use-of-Mubit scoreboard: run a plan source over the held-out set and score it. */
import { appendFileSync, existsSync, mkdirSync, readFileSync } from "node:fs";
import { dirname } from "node:path";
import { agrees, gradePlan, rulesPlan, validatePlan, type Plan } from "@gr/shared";
import { cell, parseCsv } from "./csv";
import { costPer1k } from "./mubit/cost";
import type { PlanInput } from "./prompts/general_plan";
import type { HeldoutItem } from "./sim/sets";

export interface RunOut {
  out: unknown;
  ok: boolean;
  latencyMs: number;
  usage?: { prompt_tokens: number; completion_tokens: number };
}
export type Runner = (input: PlanInput, i: number) => Promise<RunOut>;

export interface EvalResult {
  n: number;
  valid_rate: number;
  target_rate: number;
  agree_rate: number | "";
  violations: number;
  p50_ms: number;
  p95_ms: number;
  mean_in_tok: number;
  mean_out_tok: number;
  cost_per_1k: number | "";
  plans?: Plan[];
}

/** Nearest-rank percentile; 0 for an empty list. */
export function percentile(xs: number[], p: number): number {
  if (!xs.length) return 0;
  const a = [...xs].sort((x, y) => x - y);
  return a[Math.min(a.length - 1, Math.max(0, Math.ceil((p / 100) * a.length) - 1))];
}

const VIOLATIONS = new Set(["step_over_limit", "too_many_strings", "string_too_long", "bad_move"]);
const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);

export async function evalSet(
  items: HeldoutItem[],
  run: Runner,
  o: { reference?: Plan[]; keepPlans?: boolean; prices?: [number, number]; concurrency?: number } = {},
): Promise<EvalResult> {
  const plans: Plan[] = new Array(items.length);
  const flags = items.map(() => ({ valid: false, target: false, agree: false, violation: false, ms: 0, inTok: undefined as number | undefined, outTok: undefined as number | undefined }));
  let next = 0;
  const worker = async () => {
    for (let i = next++; i < items.length; i = next++) {
      const it = items[i];
      const fb = rulesPlan(it.input.habits, it.input.bossLevel);
      let r: RunOut;
      try {
        r = await run(it.input, i);
      } catch {
        r = { out: undefined, ok: false, latencyMs: 0 };
      }
      const f = flags[i];
      f.ms = r.latencyMs;
      f.inTok = r.usage?.prompt_tokens;
      f.outTok = r.usage?.completion_tokens;
      if (!r.ok) {
        plans[i] = fb;
        continue;
      }
      const v = validatePlan(r.out, it.input.limits, fb);
      plans[i] = v.plan;
      f.valid = v.valid;
      f.violation = v.failures.some((c) => VIOLATIONS.has(c));
      f.target = gradePlan(it, v.plan, v.valid).targetOk;
      if (o.reference?.[i]) f.agree = agrees(v.plan, o.reference[i]);
    }
  };
  await Promise.all(Array.from({ length: Math.max(1, o.concurrency ?? 1) }, worker));

  const n = items.length;
  const rate = (k: "valid" | "target" | "agree") => flags.filter((f) => f[k]).length / n;
  const inToks = flags.flatMap((f) => (f.inTok === undefined ? [] : [f.inTok]));
  const outToks = flags.flatMap((f) => (f.outTok === undefined ? [] : [f.outTok]));
  const ms = flags.map((f) => f.ms);
  const res: EvalResult = {
    n,
    valid_rate: rate("valid"),
    target_rate: rate("target"),
    agree_rate: o.reference ? rate("agree") : "",
    violations: flags.filter((f) => f.violation).length,
    p50_ms: percentile(ms, 50),
    p95_ms: percentile(ms, 95),
    mean_in_tok: mean(inToks),
    mean_out_tok: mean(outToks),
    cost_per_1k: o.prices && inToks.length ? costPer1k({ inTok: mean(inToks), outTok: mean(outToks), inPricePerM: o.prices[0], outPricePerM: o.prices[1] }) : "",
  };
  if (o.keepPlans) res.plans = plans;
  return res;
}

export interface SummaryRow {
  label: string;
  iso: string;
  n: number;
  valid_rate: number;
  target_rate: number;
  agree_rate: number | "";
  violations: number;
  p50_ms: number;
  p95_ms: number;
  mean_in_tok: number;
  mean_out_tok: number;
  cost_per_1k: number | "";
  notes: string;
}
const COLS: (keyof SummaryRow)[] = ["label", "iso", "n", "valid_rate", "target_rate", "agree_rate", "violations", "p50_ms", "p95_ms", "mean_in_tok", "mean_out_tok", "cost_per_1k", "notes"];
const NUM = new Set<keyof SummaryRow>(["n", "valid_rate", "target_rate", "violations", "p50_ms", "p95_ms", "mean_in_tok", "mean_out_tok"]);

export function appendSummary(row: SummaryRow, file: string): void {
  mkdirSync(dirname(file), { recursive: true });
  if (!existsSync(file)) appendFileSync(file, COLS.join(",") + "\n");
  appendFileSync(file, COLS.map((c) => cell(row[c])).join(",") + "\n");
}

export function readSummary(file: string): SummaryRow[] {
  if (!existsSync(file)) return [];
  const [head, ...rows] = parseCsv(readFileSync(file, "utf8"));
  if (!head) return [];
  return rows.map((r) => {
    const o: Record<string, unknown> = {};
    head.forEach((h, i) => {
      const v = r[i] ?? "";
      o[h] = NUM.has(h as keyof SummaryRow) ? Number(v) : h === "agree_rate" || h === "cost_per_1k" ? (v === "" ? "" : Number(v)) : v;
    });
    return o as unknown as SummaryRow;
  });
}