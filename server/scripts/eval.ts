// Score a plan source on the held-out set and append a row to data/eval/summary.csv.
//   tsx scripts/eval.ts --label baseline                       (local rules table, free)
//   MUBIT_LIVE=1 tsx scripts/eval.ts --label provider --yes-live --notes "..."   (LIVE: spends Mubit credits)
// Held-out calls always send x-middleware-store: false (never trained on).
import "../src/envAuto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { rulesPlan, type Plan } from "@gr/shared";
import { evalSet, appendSummary, type Runner } from "../src/evalRun";
import { callTask, taskHash } from "../src/mubit/client";
import { PRICES } from "../src/mubit/cost";
import { logCall } from "../src/mubit/log";
import { generalPlanTask } from "../src/prompts/general_plan";
import type { HeldoutItem } from "../src/sim/sets";

const arg = (k: string) => {
  const i = process.argv.indexOf(`--${k}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
};
const label = arg("label") ?? "baseline";
const setPath = arg("set") ?? "../data/heldout.json";
const notes = arg("notes") ?? "";
const live = label !== "baseline";

if (live && (process.argv.indexOf("--yes-live") < 0 || process.env.MUBIT_LIVE !== "1")) {
  console.error(`label "${label}" calls Mubit and spends credits. Needs MUBIT_LIVE=1 and --yes-live. Nothing was sent.`);
  process.exit(2);
}

const items: HeldoutItem[] = JSON.parse(readFileSync(setPath, "utf8"));
const hash = taskHash(generalPlanTask);
const runner: Runner = live
  ? async (input, i) => {
      const sessionId = `gr-eval-${label}-${i}`;
      const r = await callTask(generalPlanTask, input, { sessionId, store: false, timeoutMs: 20000 });
      logCall({ ts: new Date().toISOString(), task: generalPlanTask.name, task_hash: hash, session_id: sessionId, store: false, ok: r.ok, latency_ms: Math.round(r.latencyMs), prompt_tokens: r.usage?.prompt_tokens, completion_tokens: r.usage?.completion_tokens, request_id: r.requestId, served_by: "unknown", error: r.error });
      // Groq free tier: ~8k tokens/min. Wait for the window like send_seed.ts, or most of the 60 calls 429.
      const left = Number(r.limits?.["remaining-tokens"] ?? 8000);
      const m = /(?:(\d+)m)?([\d.]+)s/.exec(r.limits?.["reset-tokens"] ?? "0s");
      if (left < 2600) await new Promise((res) => setTimeout(res, ((m ? Number(m[1] ?? 0) * 60 + Number(m[2]) : 15) + 1) * 1000));
      return { out: r.out, ok: r.ok, latencyMs: r.latencyMs, usage: r.usage };
    }
  : async (input) => {
      const t0 = performance.now();
      return { out: rulesPlan(input.habits, input.bossLevel, input.unlocked), ok: true, latencyMs: performance.now() - t0 };
    };

mkdirSync("../data/eval", { recursive: true });
const refFile = "../data/eval/provider-plans.json";
const reference: Plan[] | undefined = label !== "provider" && existsSync(refFile) ? JSON.parse(readFileSync(refFile, "utf8")) : undefined;
const model = generalPlanTask.model.replace(/-\d{4}-\d{2}-\d{2}$/, "");
const res = await evalSet(items, runner, { reference, keepPlans: true, prices: live ? PRICES[model] : undefined, concurrency: 1 });
writeFileSync(`../data/eval/${label}-plans.json`, JSON.stringify(res.plans));
const { plans: _plans, ...row } = res;
const iso = new Date().toISOString();
appendSummary({ label, iso, notes, ...row }, "../data/eval/summary.csv");
writeFileSync(`../data/eval/${label}-${iso.replace(/[:.]/g, "-")}.json`, JSON.stringify({ label, iso, notes, taskHash: hash, ...row }, null, 1));
console.log(label, row);