import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { callTask, taskHash, type OpenAILike, type TaskDef } from "../src/mubit/client";
import { costPer1k } from "../src/mubit/cost";
import { logCall } from "../src/mubit/log";

type In = { a: number };
type Out = { ok: boolean };
const task: TaskDef<In, Out> = {
  name: "t",
  model: "m",
  system: "sys",
  schema: { type: "object" },
  validate: (o) => !!o && typeof o === "object" && "ok" in (o as object),
  fallback: () => ({ ok: false }),
};

function fake(impl: (body: any, opts: any) => Promise<string> | string, requestId = "mreq_test") {
  const calls: { body: any; opts: any }[] = [];
  const client: OpenAILike = {
    chat: {
      completions: {
        create: (body: any, opts: any) => {
          calls.push({ body, opts });
          return {
            withResponse: async () => ({
              data: { choices: [{ message: { content: await impl(body, opts) } }], usage: { prompt_tokens: 10, completion_tokens: 5 } },
              response: { headers: { get: (k: string) => (k.toLowerCase() === "x-middleware-request-id" ? requestId : null) } },
            }),
          };
        },
      },
    },
  };
  return { client, calls };
}

describe("callTask", () => {
  it("returns ok with the parsed result and the request id", async () => {
    const { client } = fake(() => JSON.stringify({ ok: true }));
    const r = await callTask(task, { a: 1 }, { sessionId: "s1", store: true, client });
    expect(r.ok).toBe(true);
    expect(r.out).toEqual({ ok: true });
    expect(r.requestId).toBe("mreq_test");
    expect(r.usage).toEqual({ prompt_tokens: 10, completion_tokens: 5 });
  });
  it("network error returns the fallback with ok=false and an error", async () => {
    const { client } = fake(() => {
      throw new Error("ECONNRESET");
    });
    const r = await callTask(task, { a: 1 }, { sessionId: "s", store: true, client });
    expect(r.ok).toBe(false);
    expect(r.out).toEqual({ ok: false });
    expect(r.error).toContain("ECONNRESET");
  });
  it("non-JSON reply returns the fallback", async () => {
    const { client } = fake(() => "not json at all");
    const r = await callTask(task, { a: 1 }, { sessionId: "s", store: true, client });
    expect(r.ok).toBe(false);
    expect(r.out).toEqual({ ok: false });
  });
  it("a reply that fails validate() returns the fallback", async () => {
    const { client } = fake(() => JSON.stringify({ nope: 1 }));
    const r = await callTask(task, { a: 1 }, { sessionId: "s", store: true, client });
    expect(r.ok).toBe(false);
  });
  it("store:false sends x-middleware-store: false; store:true sends none", async () => {
    const a = fake(() => JSON.stringify({ ok: true }));
    await callTask(task, { a: 1 }, { sessionId: "s", store: false, client: a.client });
    expect(a.calls[0].opts.headers["x-middleware-store"]).toBe("false");
    const b = fake(() => JSON.stringify({ ok: true }));
    await callTask(task, { a: 1 }, { sessionId: "s", store: true, client: b.client });
    expect(b.calls[0].opts.headers?.["x-middleware-store"]).toBeUndefined();
  });
  it("session id lands in metadata.session_id; input is the user message JSON; system is the frozen text", async () => {
    const { client, calls } = fake(() => JSON.stringify({ ok: true }));
    await callTask(task, { a: 7 }, { sessionId: "gr-live-x-1", store: true, client });
    const b = calls[0].body;
    expect(b.metadata.session_id).toBe("gr-live-x-1");
    expect(b.messages[0]).toEqual({ role: "system", content: "sys" });
    expect(JSON.parse(b.messages[1].content)).toEqual({ a: 7 });
    expect(b.model).toBe("m");
    expect(b.response_format.type).toBe("json_schema");
  });
  it("timeout returns the fallback within timeoutMs + 50", async () => {
    const { client } = fake(() => new Promise<string>(() => {}));
    const t0 = Date.now();
    const r = await callTask(task, { a: 1 }, { sessionId: "s", store: true, client, timeoutMs: 120 });
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/timeout/i);
    expect(Date.now() - t0).toBeLessThan(170);
  });
  it("no API key and no injected client returns the fallback without throwing", async () => {
    const saved = process.env.MUBIT_API_KEY;
    const savedLive = process.env.MUBIT_LIVE;
    process.env.MUBIT_LIVE = "1";
    delete process.env.MUBIT_API_KEY;
    const r = await callTask(task, { a: 1 }, { sessionId: "s", store: true });
    savedLive === undefined ? delete process.env.MUBIT_LIVE : (process.env.MUBIT_LIVE = savedLive);
    process.env.MUBIT_API_KEY = saved;
    if (saved === undefined) delete process.env.MUBIT_API_KEY;
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/key/i);
  });
});

describe("live gate in the client itself", () => {
  it("with a key present but MUBIT_LIVE unset, the default client path makes no call and says why", async () => {
    const saved = { k: process.env.MUBIT_API_KEY, l: process.env.MUBIT_LIVE };
    process.env.MUBIT_API_KEY = "mbt_must_not_be_used";
    delete process.env.MUBIT_LIVE;
    const r = await callTask(task, { a: 1 }, { sessionId: "s", store: true });
    saved.k === undefined ? delete process.env.MUBIT_API_KEY : (process.env.MUBIT_API_KEY = saved.k);
    saved.l === undefined ? delete process.env.MUBIT_LIVE : (process.env.MUBIT_LIVE = saved.l);
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/MUBIT_LIVE/);
  });
});

describe("taskHash", () => {
  it("changes when the system text changes and is 12 hex chars", () => {
    const h1 = taskHash(task);
    const h2 = taskHash({ ...task, system: "sys2" });
    expect(h1).toMatch(/^[0-9a-f]{12}$/);
    expect(h1).not.toBe(h2);
  });
});

describe("costPer1k", () => {
  it("adds the $5 Mubit run fee to token cost", () => {
    expect(costPer1k({ inTok: 1500, outTok: 100, inPricePerM: 0.1, outPricePerM: 0.5 })).toBeCloseTo(5.2, 6);
    expect(costPer1k({ inTok: 1500, outTok: 100, inPricePerM: 3, outPricePerM: 15 })).toBeCloseTo(11, 6);
  });
});

describe("logCall", () => {
  it("writes a header once and one row per call, escaping commas", () => {
    const dir = mkdtempSync(join(tmpdir(), "gr-log-"));
    const file = join(dir, "calls.csv");
    const row = { ts: "t", task: "x", task_hash: "h", session_id: "s,1", store: true, ok: true, latency_ms: 12, served_by: "unknown" };
    logCall(row, file);
    logCall({ ...row, session_id: "s2" }, file);
    const lines = readFileSync(file, "utf8").trim().split("\n");
    expect(lines.length).toBe(3);
    expect(lines[0].startsWith("ts,task,task_hash,session_id")).toBe(true);
    expect(lines[1]).toContain("\"s,1\"");
  });
});

