// LIVE Mubit call: ONE request, uses credits. Only run after the user says OK.
// MUBIT_LIVE=1 pnpm -C server exec tsx scripts/smoke.ts --yes-live   (key from ../.env)
import "../src/envAuto";
import { MOVES, computeHabits, limitsForLevel, validatePlan, rulesPlan } from "@gr/shared";
import { callTask, taskHash } from "../src/mubit/client";
import { logCall } from "../src/mubit/log";
import { generalPlanTask, type PlanInput } from "../src/prompts/general_plan";

if (process.argv.indexOf("--yes-live") < 0 || process.env.MUBIT_LIVE !== "1") {
  console.error("This sends ONE call to Mubit and spends a credit. Needs MUBIT_LIVE=1 and --yes-live. Nothing was sent.");
  process.exit(2);
}
const stats = { fightSeconds: 60, deflects: 2, lateDeflects: 0, blocks: 14, hitsTaken: 4, dodged: 1, playerHits: 5, sweepsJumped: 0, grabbed: 0, grabsEvaded: 0, heals: 0, firstHealAtSeconds: null, medianDeflectTiming: null, victory: false, deaths: 1, hitsByMove: { combo: 3 } };
const habits = computeHabits(stats);
const input: PlanInput = { boss: 1, bossStreak: 0, fight: 2, bossLevel: 3, stats, habits, playerMemory: {}, globalMemory: {}, unlocked: [...MOVES], designerRules: [], limits: limitsForLevel(3) };
const hash = taskHash(generalPlanTask);
console.log("task hash", hash, "model", generalPlanTask.model);
const r = await callTask(generalPlanTask, input, { sessionId: "gr-smoke-1", store: true });
logCall({ ts: new Date().toISOString(), task: "general_plan", task_hash: hash, session_id: "gr-smoke-1", store: true, ok: r.ok, latency_ms: Math.round(r.latencyMs), prompt_tokens: r.usage?.prompt_tokens, completion_tokens: r.usage?.completion_tokens, request_id: r.requestId, served_by: "unknown", error: r.error });
console.log({ ok: r.ok, requestId: r.requestId, latencyMs: Math.round(r.latencyMs), usage: r.usage, error: r.error });
console.log(validatePlan(r.out, limitsForLevel(3), rulesPlan(habits, 3)));

