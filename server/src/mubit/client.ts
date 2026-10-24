import crypto from "node:crypto";
import OpenAI from "openai";

/** The only door to an LLM. Server-side only: the Mubit key must never reach the browser. */
export interface TaskDef<I, O> {
  name: string;
  model: string; // FROZEN once seeding starts
  system: string; // FROZEN
  schema: object; // FROZEN
  /** "json_schema" (strict) is the default; "json_object" only if the starter credit refuses it (decide once, before seeding). */
  format?: "json_schema" | "json_object";
  /** Reasoning models (gpt-oss): how hard to think. "low" keeps answers fast and the token bill small. */
  reasoning?: "low" | "medium" | "high";
  validate: (o: unknown) => boolean;
  fallback: (input: I) => O;
}

export interface CallResult<O> {
  out: O;
  ok: boolean;
  latencyMs: number;
  requestId?: string;
  usage?: { prompt_tokens: number; completion_tokens: number };
  /** The provider's rate-limit headers (x-ratelimit-*), when it sends them. */
  limits?: Record<string, string>;
  raw?: string;
  error?: string;
}

/** The slice of the OpenAI SDK we use (lets tests inject a fake). */
export interface OpenAILike {
  chat: {
    completions: {
      create(
        body: any,
        opts?: any,
      ): { withResponse(): Promise<{ data: any; response: { headers: { get(k: string): string | null } } }> };
    };
  };
}

let shared: OpenAILike | null = null;
function defaultClient(): OpenAILike {
  // Credits are limited: every path that builds the real client needs MUBIT_LIVE=1, whatever the caller checked.
  if (process.env.MUBIT_LIVE !== "1") throw new Error("MUBIT_LIVE is not 1: no Mubit call made");
  const apiKey = process.env.MUBIT_API_KEY;
  if (!apiKey) throw new Error("MUBIT_API_KEY not set (no Mubit call made)");
  shared ??= new OpenAI({ baseURL: process.env.MUBIT_BASE_URL ?? "https://api.mubit.ai/compat/groq/v1", apiKey }) as unknown as OpenAILike;
  return shared;
}

export function taskHash(t: TaskDef<any, any>): string {
  return crypto.createHash("sha256").update(t.model + t.system + JSON.stringify(t.schema)).digest("hex").slice(0, 12);
}

export async function callTask<I, O>(
  t: TaskDef<I, O>,
  input: I,
  opts: { sessionId: string; store: boolean; timeoutMs?: number; client?: OpenAILike },
): Promise<CallResult<O>> {
  const t0 = performance.now();
  const timeoutMs = opts.timeoutMs ?? 15000;
  const fail = (error: string, extra: Partial<CallResult<O>> = {}): CallResult<O> => ({
    out: t.fallback(input),
    ok: false,
    latencyMs: performance.now() - t0,
    error,
    ...extra,
  });
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const client = opts.client ?? defaultClient();
    const response_format =
      t.format === "json_object"
        ? { type: "json_object" }
        : { type: "json_schema", json_schema: { name: t.name, strict: true, schema: t.schema } };
    const call = client.chat.completions
      .create(
        {
          model: t.model,
          messages: [
            { role: "system", content: t.system },
            { role: "user", content: JSON.stringify(input) }, // EVERYTHING variable goes here
          ],
          response_format,
          ...(t.reasoning ? { reasoning_effort: t.reasoning } : {}),
          // No `metadata`: on this route the provider refuses it ("only allowed when 'store' is enabled",
          // even with store: true). Mubit then gives each call the session of its conversation start
          // (instructions + first user message), and every fight report is a different user message,
          // so each call is still its own session. opts.sessionId is kept for our own log.
          // no temperature: gpt-6-luna only accepts its default (1). The enum-only schema keeps plans stable.
        },
        { headers: opts.store ? {} : { "x-middleware-store": "false" }, timeout: timeoutMs },
      )
      .withResponse();
    const timeout = new Promise<never>((_, rej) => {
      timer = setTimeout(() => rej(new Error(`timeout after ${timeoutMs} ms`)), timeoutMs);
    });
    const { data, response } = await Promise.race([call, timeout]);
    const raw: string = data?.choices?.[0]?.message?.content ?? "";
    const requestId = response?.headers?.get("x-middleware-request-id") ?? undefined;
    const limits: Record<string, string> = {};
    for (const k of ["limit-requests", "limit-tokens", "remaining-requests", "remaining-tokens", "reset-requests", "reset-tokens"]) {
      const v = response?.headers?.get(`x-ratelimit-${k}`);
      if (v) limits[k] = v;
    }
    const usage = data?.usage;
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      return fail("reply was not JSON", { requestId, usage, raw });
    }
    if (!t.validate(parsed)) return fail("reply failed validation", { requestId, usage, raw });
    return { out: parsed as O, ok: true, latencyMs: performance.now() - t0, requestId, usage, limits, raw };
  } catch (e) {
    return fail(e instanceof Error ? e.message : String(e));
  } finally {
    clearTimeout(timer);
  }
}
