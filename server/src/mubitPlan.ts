import { callTask, taskHash } from "./mubit/client";
import { logCall } from "./mubit/log";
import { generalPlanTask } from "./prompts/general_plan";

/**
 * When the main provider (Groq) is out of tokens for the minute or the day, the same plan prompt is
 * answered by Mubit's starter-credit model instead, as a different task and NOT stored (so it can
 * neither fork the task nor pollute its examples). The plan still comes from a real model call.
 */
const BACKUP = { model: process.env.MUBIT_BACKUP_MODEL ?? "gpt-6-luna", baseURL: process.env.MUBIT_BACKUP_BASE ?? "https://api.mubit.ai/openai/v1" };
const OUT_OF_ROOM = /429|rate limit|tokens per (day|minute)|TPD|TPM/i; // fast refusals only: a timeout would leave no time for a second call
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
    let r = await call(generalPlanTask, input, { sessionId, store: true, timeoutMs: 4500 } /* < the browser's 6 s requestPlan abort, so a slow live plan is not shown as "offline" */);
    let servedBy = "primary";
    if (!r.ok && OUT_OF_ROOM.test(r.error ?? "") && process.env.MUBIT_BACKUP !== "off") {
      r = await call({ ...generalPlanTask, model: BACKUP.model, baseURL: BACKUP.baseURL, reasoning: undefined }, input, { sessionId, store: false, timeoutMs: 8500 });
      servedBy = "backup";
    }
    log({
      ts: new Date().toISOString(),
      task: generalPlanTask.name,
      task_hash: servedBy === "primary" ? taskHash(generalPlanTask) : taskHash({ ...generalPlanTask, model: BACKUP.model, baseURL: BACKUP.baseURL }),
      session_id: sessionId,
      store: servedBy === "primary",
      ok: r.ok,
      latency_ms: Math.round(r.latencyMs),
      prompt_tokens: r.usage?.prompt_tokens,
      completion_tokens: r.usage?.completion_tokens,
      request_id: r.requestId,
      served_by: servedBy,
      error: r.error,
    });
    return { out: r.out, ok: r.ok, latencyMs: r.latencyMs, requestId: r.requestId, error: r.error, model: servedBy === "primary" ? generalPlanTask.model : BACKUP.model };
  };
}
