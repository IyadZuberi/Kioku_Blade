import { afterEach, describe, expect, it } from "vitest";
import type { AddressInfo } from "node:net";
import type { Server } from "node:http";
import { rulesPlan, type Plan } from "@gr/shared";
import { createApp, type Deps } from "../src/app";
import { openDb } from "../src/db";
import { cleanSpeech, generalSpeechTask, speakerOf } from "../src/prompts/general_speech";

let server: Server | undefined;
afterEach(() => server?.close());

const zero = { fightSeconds: 60, deflects: 2, lateDeflects: 0, blocks: 14, hitsTaken: 4, dodged: 1, playerHits: 5, sweepsJumped: 0, grabbed: 0, grabsEvaded: 0, heals: 0, firstHealAtSeconds: null, medianDeflectTiming: null, victory: false, deaths: 1, hitsByMove: {} };

function boot(speech?: Deps["callSpeech"]) {
  const db = openDb(":memory:");
  const inputs: any[] = [];
  const plans: any[] = [];
  const app = createApp({
    db,
    callPlan: async (input) => {
      plans.push(input);
      return { out: { ...rulesPlan(input.habits, input.bossLevel), intel: "ok" } as Plan, ok: true, latencyMs: 1, model: "m" };
    },
    callSpeech: speech && (async (i, s) => { inputs.push({ i, s }); return speech(i, s); }),
  });
  server = app.listen(0) as Server;
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  const post = async (id: string) => (await (await fetch(base + "/api/fight-end", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ fightId: id, nickname: "Kenji", boss: 3, stats: zero }) })).json()) as any;
  return { post, inputs, plans };
}

describe("general_speech in the fight-end loop", () => {
  it("returns the model's lines and keeps its dossier, fed back into the next plan as playerMemory.dossier", async () => {
    const { post, plans, inputs } = boot(async () => ({ out: { dossier: "Holds the guard too long.", greeting: "You hide behind steel.", parry: "Not today.", fall: "Well cut.", win: "Rest now." }, ok: true, latencyMs: 2 }));
    const a = await post("a1");
    expect(a.lines).toMatchObject({ greeting: "You hide behind steel.", parry: "Not today.", fall: "Well cut.", win: "Rest now.", source: "mubit" });
    expect(a.dossier).toBe("Holds the guard too long.");
    expect(plans[0].playerMemory.dossier).toBe(""); // nothing known before the first duel
    await post("a2");
    expect(plans[1].playerMemory.dossier).toBe("Holds the guard too long.");
    expect(inputs[1].i.dossier).toBe("Holds the guard too long."); // and the next speech call sees it too
    expect(inputs[0].s).toMatch(/^gr-speech-Kenji-a1$/);
    expect(inputs[0].i.speaker).toBe(speakerOf(3));
  });
  it("without the speech call the fight still works: local notes from the habit evidence, no lines", async () => {
    const { post } = boot();
    const a = await post("b1");
    expect(a.source).toBe("mubit");
    expect(a.lines.source).toBe("local");
    expect(a.lines.greeting).toBe("");
    expect(a.dossier).toMatch(/Last duel:/);
  });
  it("a failed or garbage speech call changes nothing else", async () => {
    const { post } = boot(async () => ({ out: undefined, ok: false, latencyMs: 1, error: "429" }));
    const a = await post("c1");
    expect(a.plan.intel).toBe("ok");
    expect(a.lines.source).toBe("local");
    const { post: post2 } = boot(async () => { throw new Error("boom"); });
    expect((await post2("c2")).lines.source).toBe("local");
  });
});

describe("cleanSpeech", () => {
  it("caps every field to its word limit and drops anything rude", () => {
    const long = Array.from({ length: 60 }, (_, i) => `w${i}`).join(" ");
    const s = cleanSpeech({ dossier: long, greeting: long, parry: long, fall: long, win: "you fucking idiot" });
    expect(s.dossier.split(" ").length).toBe(30);
    expect(s.greeting.split(" ").length).toBe(18);
    expect(s.parry.split(" ").length).toBe(6);
    expect(s.fall.split(" ").length).toBe(12);
    expect(s.win).toBe("");
  });
  it("junk in, empty fields out (never throws)", () => {
    for (const j of [null, undefined, 5, "x", [], { dossier: 3 }]) expect(cleanSpeech(j)).toEqual({ dossier: "", greeting: "", parry: "", fall: "", win: "" });
  });
  it("the task validates only complete objects", () => {
    expect(generalSpeechTask.validate({ dossier: "", greeting: "", parry: "", fall: "", win: "" })).toBe(true);
    expect(generalSpeechTask.validate({ dossier: "x" })).toBe(false);
  });
  it("the system prompt carries no per-player data and every field is named", () => {
    for (const k of ["dossier", "greeting", "parry", "fall", "win"]) expect(generalSpeechTask.system).toContain(k);
    expect(generalSpeechTask.system).not.toMatch(/\d{3,}/);
  });
});
