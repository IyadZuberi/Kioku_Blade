import { describe, expect, it } from "vitest";
import { rulesPlan } from "@gr/shared";
import { requestPlan } from "../src/learn/session";

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