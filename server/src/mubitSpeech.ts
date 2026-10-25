import { callTask, taskHash } from "./mubit/client";
import { logCall } from "./mubit/log";
import { generalSpeechTask, type SpeechInput } from "./prompts/general_speech";
import { makeGate } from "./rateGate";
import type { PlanCall } from "./app";

/**
 * The live path for the general's lines and dossier (task general_speech). Same rule as the plan: nothing is
 * sent unless MUBIT_LIVE=1, and a failure just means canned lines (the caller never waits long).
 */
export function makeCallSpeech(o: { call?: typeof callTask; log?: typeof logCall; perMinute?: number } = {}): (input: SpeechInput, sessionId: string) => Promise<PlanCall> {
  const call = o.call ?? callTask;
  const log = o.log ?? logCall;
  // Anyone on the network can post fights: cap paid calls (canned lines are returned beyond the cap).
  const gate = makeGate(o.perMinute ?? (Number(process.env.MUBIT_PER_MINUTE) || 30));
  return async (input, sessionId) => {
    if (process.env.MUBIT_LIVE !== "1") return { out: undefined, ok: false, latencyMs: 0, error: "MUBIT_LIVE is not 1: no Mubit call made" };
    const limited = gate();
    if (limited) return { out: undefined, ok: false, latencyMs: 0, error: limited };
    const r = await call(generalSpeechTask, input, { sessionId, store: true, timeoutMs: 6500 });
    log({
      ts: new Date().toISOString(),
      task: generalSpeechTask.name,
      task_hash: taskHash(generalSpeechTask),
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
