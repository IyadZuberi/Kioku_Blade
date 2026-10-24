import { callTask, taskHash } from "./mubit/client";
import { logCall } from "./mubit/log";
import { generalPlanTask } from "./prompts/general_plan";
import type { Deps } from "./app";

/**
 * The live path to Mubit. Mubit credits are limited, so NOTHING is sent unless MUBIT_LIVE=1,
 * even if a key is present. Every live call is logged to data/calls.csv.
 */
export function makeCallPlan(): Deps["callPlan"] {
  return async (input, sessionId) => {
    if (process.env.MUBIT_LIVE !== "1") return { out: undefined, ok: false, latencyMs: 0, error: "MUBIT_LIVE is not 1: no Mubit call made" };
    const r = await callTask(generalPlanTask, input, { sessionId, store: true, timeoutMs: 6000 });
    logCall({
      ts: new Date().toISOString(),
      task: generalPlanTask.name,
      task_hash: taskHash(generalPlanTask),
      session_id: sessionId,
      store: true,
      ok: r.ok,
      latency_ms: Math.round(r.latencyMs),
      prompt_tokens: r.usage?.prompt_tokens,
      completion_tokens: r.usage?.completion_tokens,
      request_id: r.requestId,
      served_by: "unknown",
      error: r.error,
    });
    return { out: r.out, ok: r.ok, latencyMs: r.latencyMs, requestId: r.requestId, error: r.error };
  };
}
