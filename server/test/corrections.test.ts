import type { AddressInfo } from "node:net";
import { afterEach, describe, expect, it } from "vitest";
import { rulesPlan } from "@gr/shared";
import { createApp, type Deps } from "../src/app";
import { openDb } from "../src/db";
import { addRule, designerRules } from "../src/memory";
import type { PlanInput } from "../src/prompts/general_plan";

const stats = { fightSeconds: 60, deflects: 2, lateDeflects: 0, blocks: 14, hitsTaken: 4, dodged: 1, playerHits: 15, sweepsJumped: 0, grabbed: 0, grabsEvaded: 0, heals: 0, firstHealAtSeconds: null, medianDeflectTiming: null, victory: false, deaths: 1, hitsByMove: { combo: 3 } };
let server: any;
afterEach(() => server?.close());

function boot(callPlan?: Deps["callPlan"]) {
  const db = openDb(":memory:");
  const calls: { input: PlanInput; sessionId: string }[] = [];
  const dep: Deps = {
    db,
    callPlan:
      callPlan ??
      (async (input, sessionId) => {
        calls.push({ input, sessionId });
        return { out: rulesPlan(input.habits, input.bossLevel), ok: true, latencyMs: 7, requestId: "mreq_fix" };
      }),
  };
  server = createApp(dep).listen(0);
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  const post = (path: string, body: unknown) => fetch(base + path, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  return { db, base, post, calls };
}
const fight = (id: string) => ({ fightId: id, nickname: "K", fightNumber: 1, stats });

describe("POST /api/override", () => {
  it("adds one rule and re-sends the stored input with it under a gr-fix session", async () => {
    const { post, calls, db } = boot();
    await post("/api/fight-end", fight("f1"));
    const r = await post("/api/override", { fightId: "f1", rule: "When the player blocks often, field thrust." });
    expect(r.status).toBe(200);
    const j: any = await r.json();
    expect(j.ok).toBe(true);
    expect(j.plan.focus_habit).toBeDefined();
    expect(designerRules(db)).toEqual(["When the player blocks often, field thrust."]);
    const fix = calls[calls.length - 1];
    expect(fix.sessionId).toMatch(/^gr-fix-[0-9a-f-]{36}$/);
    expect(fix.input.designerRules).toContain("When the player blocks often, field thrust.");
    expect(fix.input.stats.blocks).toBe(14);
  });
  it("a duplicate rule (any case) is not added twice", async () => {
    const { post, db } = boot();
    await post("/api/fight-end", fight("f1"));
    await post("/api/override", { fightId: "f1", rule: "Field thrust." });
    await post("/api/override", { fightId: "f1", rule: "field THRUST." });
    expect(designerRules(db).length).toBe(1);
  });
  it("keeps only the newest 15 rules", () => {
    const db = openDb(":memory:");
    for (let i = 1; i <= 17; i++) addRule(db, `rule ${i}`);
    const r = designerRules(db);
    expect(r.length).toBe(15);
    expect(r[0]).toBe("rule 3");
    expect(r[14]).toBe("rule 17");
  });
  it("unknown fight is 404; empty or over-long rule is 400", async () => {
    const { post } = boot();
    await post("/api/fight-end", fight("f1"));
    expect((await post("/api/override", { fightId: "nope", rule: "x rule" })).status).toBe(404);
    expect((await post("/api/override", { fightId: "f1", rule: "   " })).status).toBe(400);
    expect((await post("/api/override", { fightId: "f1", rule: "x".repeat(201) })).status).toBe(400);
  });
  it("when the model call fails the rule is still stored and the answer says ok:false", async () => {
    let n = 0;
    const { post, db } = boot(async (input) => (n++ === 0 ? { out: rulesPlan(input.habits, 1), ok: true, latencyMs: 1 } : { out: undefined, ok: false, latencyMs: 1, error: "offline" }));
    await post("/api/fight-end", fight("f1"));
    const j: any = await (await post("/api/override", { fightId: "f1", rule: "Prefer flurry." })).json();
    expect(j.ok).toBe(false);
    expect(designerRules(db)).toEqual(["Prefer flurry."]);
  });
  it("rules written by an override reach the NEXT fight's prompt input", async () => {
    const { post, calls } = boot();
    await post("/api/fight-end", fight("f1"));
    await post("/api/override", { fightId: "f1", rule: "Prefer flurry." });
    await post("/api/fight-end", fight("f2"));
    expect(calls[calls.length - 1].input.designerRules).toContain("Prefer flurry.");
  });
});

describe("GET /api/replay", () => {
  it("returns only real stored plans, each labelled replay, newest first, at most 20", async () => {
    const { post, base } = boot();
    for (let i = 0; i < 25; i++) await post("/api/fight-end", fight(`f${i}`));
    const j: any = await (await fetch(base + "/api/replay")).json();
    expect(j.plans.length).toBe(20);
    expect(j.plans.every((p: any) => p.source === "replay")).toBe(true);
    expect(j.plans[0].plan.focus_habit).toBeDefined();
  });
  it("is empty before any fight", async () => {
    const { base } = boot();
    expect(((await (await fetch(base + "/api/replay")).json()) as any).plans).toEqual([]);
  });
});