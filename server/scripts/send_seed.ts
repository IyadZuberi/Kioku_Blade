// LIVE: sends the 80 seed items to Mubit with storage ON (this is what Mubit trains on). Spends credits.
//   MUBIT_LIVE=1 tsx scripts/send_seed.ts --yes-live
// After this, server/src/prompts/general_plan.ts is FROZEN (any edit starts a new, empty Mubit task).
import { readFileSync } from "node:fs";
import { validatePlan } from "@gr/shared";
import { callTask, taskHash } from "../src/mubit/client";
import { logCall } from "../src/mubit/log";
import { generalPlanTask, type PlanInput } from "../src/prompts/general_plan";

if (process.argv.indexOf("--yes-live") < 0 || process.env.MUBIT_LIVE !== "1") {
  console.error("This sends 80 calls to Mubit and spends credits. Needs MUBIT_LIVE=1 and --yes-live. Nothing was sent.");
  process.exit(2);
}
const seed: PlanInput[] = JSON.parse(readFileSync("../data/seed.json", "utf8"));
const hash = taskHash(generalPlanTask);
console.log("task hash", hash, "model", generalPlanTask.model, "items", seed.length);
let next = 0, ok = 0, valid = 0, failed = 0;
const worker = async () => {
  for (let i = next++; i < seed.length; i = next++) {
    const sessionId = `gr-seed-${i}`;
    let r = await callTask(generalPlanTask, seed[i], { sessionId, store: true, timeoutMs: 30000 });
    for (let retry = 0; !r.ok && retry < 2; retry++) {
      await new Promise((res) => setTimeout(res, 1500 * (retry + 1)));
      r = await callTask(generalPlanTask, seed[i], { sessionId, store: true, timeoutMs: 30000 });
    }
    logCall({ ts: new Date().toISOString(), task: generalPlanTask.name, task_hash: hash, session_id: sessionId, store: true, ok: r.ok, latency_ms: Math.round(r.latencyMs), prompt_tokens: r.usage?.prompt_tokens, completion_tokens: r.usage?.completion_tokens, request_id: r.requestId, served_by: "unknown", error: r.error });
    if (r.ok) {
      ok++;
      if (validatePlan(r.out, seed[i].limits).valid) valid++;
    } else failed++;
  }
};
await Promise.all(Array.from({ length: 4 }, worker));
console.log({ sent: seed.length, ok, failed, validPlanRate: ok ? +(valid / ok).toFixed(3) : 0 });
console.log("Now open the Mubit console > Tasks: expect exactly ONE task, kept count rising toward 25.");