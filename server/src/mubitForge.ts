import type { BrainDigest } from "@gr/shared";
import { callTask, taskHash } from "./mubit/client";
import { logCall } from "./mubit/log";
import { generalForgeTask } from "./prompts/general_forge";
import { makeGate } from "./rateGate";
import type { PlanCall } from "./app";

/**
 * The live path for the general's arsenal design (task general_forge). Same rules as the others: nothing is sent
 * unless MUBIT_LIVE=1, calls are capped per minute, and a failure just means the game's own arsenal is used.
 */
export function makeCallForge(o: { call?: typeof callTask; log?: typeof logCall; perMinute?: number } = {}): (input: BrainDigest, sessionId: string) => Promise<PlanCall> {
  const call = o.call ?? callTask;
  const log = o.log ?? logCall;
  const gate = makeGate(o.perMinute ?? (Number(process.env.MUBIT_PER_MINUTE) || 30));
  return async (input, sessionId) => {
    if (process.env.MUBIT_LIVE !== "1") return { out: undefined, ok: false, latencyMs: 0, error: "MUBIT_LIVE is not 1: no Mubit call made" };
    const limited = gate();
    if (limited) return { out: undefined, ok: false, latencyMs: 0, error: limited };
    const r = await call(generalForgeTask, input, { sessionId, store: true, timeoutMs: 9000 });
    log({
      ts: new Date().toISOString(),
      task: generalForgeTask.name,
      task_hash: taskHash(generalForgeTask),
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
