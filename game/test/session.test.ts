import { beforeEach, describe, expect, it, vi } from "vitest";
import { rulesPlan } from "@gr/shared";
import { getNickname, requestPlan, resetReplay, sendOverride } from "../src/learn/session";

const stats = { fightSeconds: 60, deflects: 2, lateDeflects: 0, blocks: 14, hitsTaken: 4, dodged: 1, playerHits: 5, sweepsJumped: 0, grabbed: 0, grabsEvaded: 0, heals: 0, firstHealAtSeconds: null, medianDeflectTiming: null, victory: false, deaths: 1, hitsByMove: { combo: 3 } };
const args = { nickname: "Kenji", fightId: "f1", fightNumber: 1, stats };
const okBody = () => ({ plan: rulesPlan([{ habit: "block_holder", strength: 1, evidence: "blocked 14 times, deflected 2" }], 2), source: "mubit", valid: true, failures: [], latencyMs: 90, bossLevel: 2, grudge: 1, intelLines: ["You blocked 14 times, deflected 2."], requestId: "mreq_x" });

describe("requestPlan", () => {
  it("passes through a good server answer", async () => {
    const r = await requestPlan(args, { fetchFn: async () => new Response(JSON.stringify(okBody()), { status: 200 }) as any });
    expect(r.source).toBe("mubit");
    expect(r.bossLevel).toBe(2);
    expect(r.requestId).toBe("mreq_x");
  });
  it("falls back to a local rules plan when fetch rejects", async () => {
    const r = await requestPlan(args, { fetchFn: async () => { throw new Error("offline"); } });
    expect(r.source).toBe("local");
    expect(r.plan.focus_habit).toBe("block_holder");
    expect(r.intelLines.join(" ")).toContain("14");
  });
  it("falls back within the timeout when fetch hangs", async () => {
    const t0 = Date.now();
    const hang = (_u: unknown, init: any) => new Promise<Response>((_, rej) => init.signal.addEventListener("abort", () => rej(new Error("aborted"))));
    const r = await requestPlan(args, { fetchFn: hang as any, timeoutMs: 100 });
    expect(r.source).toBe("local");
    expect(Date.now() - t0).toBeLessThan(250);
  });
  it("falls back on non-200 and on a body that is not a plan", async () => {
    expect((await requestPlan(args, { fetchFn: async () => new Response("no", { status: 500 }) as any })).source).toBe("local");
    expect((await requestPlan(args, { fetchFn: async () => new Response(JSON.stringify({ plan: 5 }), { status: 200 }) as any })).source).toBe("local");
  });
  it("an idle fight still produces a plan locally", async () => {
    const r = await requestPlan({ ...args, stats: { ...stats, blocks: 0, deflects: 0, hitsTaken: 0, playerHits: 0, fightSeconds: 0 } }, { fetchFn: async () => { throw new Error("x"); } });
    expect(r.plan.focus_habit).toBe("none");
  });
});
describe("replay mode", () => {
  beforeEach(resetReplay);
  const stored = (focus: string) => ({ ...okBody(), source: "replay", plan: { ...okBody().plan, focus_habit: focus } });
  it("serves stored plans round-robin, labelled replay, without posting a fight", async () => {
    const urls: string[] = [];
    const fetchFn = (async (u: string) => {
      urls.push(u);
      return new Response(JSON.stringify({ plans: [stored("passive"), stored("dodge_spammer")] }), { status: 200 });
    }) as any;
    const a = await requestPlan(args, { fetchFn, replay: true });
    const b = await requestPlan(args, { fetchFn, replay: true });
    const c = await requestPlan(args, { fetchFn, replay: true });
    expect([a.plan.focus_habit, b.plan.focus_habit, c.plan.focus_habit]).toEqual(["passive", "dodge_spammer", "passive"]);
    expect(a.source).toBe("replay");
    expect(urls.every((u) => u.includes("/api/replay"))).toBe(true);
  });
  it("falls back to a local plan when there is nothing to replay", async () => {
    const r = await requestPlan(args, { fetchFn: (async () => new Response(JSON.stringify({ plans: [] }), { status: 200 })) as any, replay: true });
    expect(r.source).toBe("local");
  });
});

describe("sendOverride", () => {
  it("posts fightId and rule and returns the server answer", async () => {
    let body: any;
    let auth = "";
    const r = await sendOverride("f1", "Prefer flurry.", "tok", async (_u: any, init: any) => {
      body = JSON.parse(init.body);
      auth = init.headers.authorization;
      return new Response(JSON.stringify({ ok: true }), { status: 200 }) as any;
    });
    expect(body).toEqual({ fightId: "f1", rule: "Prefer flurry." });
    expect(auth).toBe("Bearer tok");
    expect(r.ok).toBe(true);
  });
  it("reports the HTTP status so the caller can tell a wrong token from a missing fight", async () => {
    const r = await sendOverride("f1", "x rule", "bad", async () => new Response(JSON.stringify({ error: "forbidden" }), { status: 403 }) as any);
    expect(r).toEqual({ ok: false, status: 403 });
  });
  it("never throws: an offline server is ok:false", async () => {
    const r = await sendOverride("f1", "x rule", "tok", async () => {
      throw new Error("offline");
    });
    expect(r.ok).toBe(false);
  });
});

describe("getNickname", () => {
  it("gives each browser its own stable Wanderer-xxxx name when none is set", () => {
    const store = new Map<string, string>();
    vi.stubGlobal("localStorage", { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => void store.set(k, v) });
    vi.stubGlobal("location", { search: "" });
    const a = getNickname();
    expect(a).toMatch(/^Wanderer-[0-9a-f]{4}$/);
    expect(getNickname()).toBe(a);
    store.set("gr.nickname", "Kenji");
    expect(getNickname()).toBe("Kenji");
    vi.unstubAllGlobals();
  });
});
