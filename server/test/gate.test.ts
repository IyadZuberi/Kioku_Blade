import { afterEach, describe, expect, it } from "vitest";
import { makeCallPlan } from "../src/mubitPlan";
import { computeHabits, limitsForLevel, MOVES } from "@gr/shared";

const stats = { fightSeconds: 1, deflects: 0, lateDeflects: 0, blocks: 0, hitsTaken: 0, dodged: 0, playerHits: 0, sweepsJumped: 0, grabbed: 0, grabsEvaded: 0, heals: 0, firstHealAtSeconds: null, medianDeflectTiming: null, victory: false, deaths: 0, hitsByMove: {} };
const input = { fight: 1, bossLevel: 1, stats, habits: computeHabits(stats), playerMemory: {}, globalMemory: {}, unlocked: [...MOVES], designerRules: [], limits: limitsForLevel(1) };
const saved = { live: process.env.MUBIT_LIVE, key: process.env.MUBIT_API_KEY };
afterEach(() => {
  for (const [k, v] of [["MUBIT_LIVE", saved.live], ["MUBIT_API_KEY", saved.key]] as const) v === undefined ? delete process.env[k] : (process.env[k] = v);
});

describe("live-call gate", () => {
  it("makes no Mubit call unless MUBIT_LIVE=1, even when a key is present", async () => {
    delete process.env.MUBIT_LIVE;
    process.env.MUBIT_API_KEY = "mbt_should_never_be_used";
    const r = await makeCallPlan()(input, "gr-test");
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/MUBIT_LIVE/);
    expect(r.latencyMs).toBe(0);
  });
});

describe("live-call rate limit", () => {
  it("stops after perMinute live calls and does not call the model for the rest", async () => {
    process.env.MUBIT_LIVE = "1";
    let calls = 0;
    const fake = async () => (calls++, { out: {}, ok: true, latencyMs: 1 });
    const cp = makeCallPlan({ call: fake as any, perMinute: 2, log: () => {} });
    const a = await cp(input, "s1");
    const b = await cp(input, "s2");
    const c = await cp(input, "s3");
    expect([a.ok, b.ok, c.ok]).toEqual([true, true, false]);
    expect(c.error).toMatch(/rate/i);
    expect(calls).toBe(2);
  });
});
