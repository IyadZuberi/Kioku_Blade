import { callTask, taskHash } from "./mubit/client";
import { logCall } from "./mubit/log";
import { generalPlanTask } from "./prompts/general_plan";
import type { Deps } from "./app";

/**
 * The live path to Mubit. Mubit credits are limited, so NOTHING is sent unless MUBIT_LIVE=1,
 * even if a key is present. Every live call is logged to data/calls.csv.
 */
export function makeCallPlan(o: { call?: typeof callTask; perMinute?: number; log?: typeof logCall } = {}): Deps["callPlan"] {
  const call = o.call ?? callTask;
  const log = o.log ?? logCall;
  // Groq free tier is ~8k tokens/min (~4 plans): set MUBIT_PER_MINUTE=4 there; default stays 30.
  const perMinute = o.perMinute ?? (Number(process.env.MUBIT_PER_MINUTE) || 30);
  const stamps: number[] = [];
  return async (input, sessionId) => {
    if (process.env.MUBIT_LIVE !== "1") return { out: undefined, ok: false, latencyMs: 0, error: "MUBIT_LIVE is not 1: no Mubit call made" };
    // Anyone on the network can post fights: cap paid calls (rules plans are returned beyond the cap).
    const now = Date.now();
    while (stamps.length && now - stamps[0] > 60_000) stamps.shift();
    if (stamps.length >= perMinute) return { out: undefined, ok: false, latencyMs: 0, error: `rate limit: ${perMinute} live calls per minute` };
    stamps.push(now);
    const r = await call(generalPlanTask, input, { sessionId, store: true, timeoutMs: 4500 } /* < the browser's 6 s requestPlan abort, so a slow live plan is not shown as "offline" */);
    log({
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
