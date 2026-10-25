// LIVE: sends MORE examples to Mubit with storage ON, for BOTH tasks, so each task has plenty of kept examples
// to train its adapter on. Plan inputs are new (a different RNG seed than data/seed.json); speech inputs are built
// from the same fights. Spends starter credit.
//   MUBIT_LIVE=1 tsx scripts/send_more.ts --yes-live [--plans 120] [--speech 60] [--forge 80]
import "../src/envAuto";
import seedrandom from "seedrandom";
import { HABITS, rulesPlan } from "@gr/shared";
import { callTask } from "../src/mubit/client";
import { logCall } from "../src/mubit/log";
import { generalPlanTask, type PlanInput } from "../src/prompts/general_plan";
import { generalSpeechTask, speakerOf, type SpeechInput } from "../src/prompts/general_speech";
import { generalForgeTask } from "../src/prompts/general_forge";
import { BOSS_MOVES, type BrainDigest } from "@gr/shared";
import { genInput, type Archetype } from "../src/sim/archetypes";

if (process.argv.indexOf("--yes-live") < 0 || process.env.MUBIT_LIVE !== "1") {
  console.error("This sends live calls to Mubit and spends credits. Needs MUBIT_LIVE=1 and --yes-live. Nothing was sent.");
  process.exit(2);
}
const arg = (n: string, d: number) => Number(process.argv[process.argv.indexOf(n) + 1]) || d;
const nPlans = arg("--plans", 120), nSpeech = arg("--speech", 60), nForge = arg("--forge", 80);
const r = seedrandom(process.env.SEED ?? "gr-seed-3");
const kinds: Archetype[] = [...HABITS, "mixed", "none"];
const inputs: PlanInput[] = Array.from({ length: nPlans }, (_, i) => genInput(kinds[i % kinds.length], r, i));
const speech: SpeechInput[] = inputs.slice(0, nSpeech).map((p) => ({
  boss: p.boss,
  speaker: speakerOf(p.boss),
  fight: p.fight,
  result: p.stats.victory ? "player won" : "player lost",
  bossLevel: p.bossLevel,
  habits: p.habits.map((h) => ({ habit: h.habit, evidence: h.evidence })),
  dossier: (p.playerMemory as { dossier?: string }).dossier ?? "",
  councilIntel: rulesPlan(p.habits, p.bossLevel, p.unlocked).intel,
}));

// the arsenal task: digests of generals at different levels against different players (what the game sends after a duel)
const UNLOCKED = ["windSlash", "lunge", "backflip", "waterfowl", "shockwave", "vanish", "stance"];
const forgeIn: BrainDigest[] = Array.from({ length: nForge }, (_, i) => {
  const lvl = Math.round((1 + r() * 30) * 10) / 10;
  const boss = (1 + (i % 3)) as 1 | 2 | 3;
  const have = [...BOSS_MOVES[boss], ...UNLOCKED.filter((_, k) => lvl >= [5, 8, 11, 14, 17, 20, 24][k])];
  const arch = [{ defl: 0.7, guard: 0.1, dodge: 0.1 }, { defl: 0.1, guard: 0.7, dodge: 0.1 }, { defl: 0.1, guard: 0.1, dodge: 0.7 }, { defl: 0.3, guard: 0.3, dodge: 0.3 }][i % 4];
  const near = Math.round((i % 5 < 2 ? 0.8 + r() * 0.2 : i % 5 < 4 ? r() * 0.25 : 0.4 + r() * 0.2) * 100) / 100;
  const pick = (n: number) => [...have].sort(() => r() - 0.5).slice(0, n);
  return { boss, lvl, duels: 1 + Math.floor(lvl / 1.6), won: r() < 0.55, style: { agg: Math.round(r() * 100) / 100, guard: arch.guard, defl: arch.defl, dodge: arch.dodge, jump: Math.round(r() * 30) / 100, heal: Math.round(r() * 30) / 100 }, near, hitNear: Math.round(r() * 60) / 10, hitFar: Math.round(r() * 60) / 10, moves: have, works: pick(2), failed: pick(1), cond: ["none", "afterDeflect", "afterDodge", "whenOpen", "guardBroken"][1 + (i % 4)] };
});

let ok = 0, failed = 0;
async function run<I>(task: typeof generalPlanTask | typeof generalSpeechTask | typeof generalForgeTask, items: I[], tag: string): Promise<void> {
  let next = 0;
  const worker = async () => {
    for (let i = next++; i < items.length; i = next++) {
      const sessionId = `gr-more-${tag}-${i}`;
      let res = await callTask(task as never, items[i] as never, { sessionId, store: true, timeoutMs: 30000 });
      for (let retry = 0; !res.ok && retry < 2; retry++) {
        await new Promise((s) => setTimeout(s, 1500 * (retry + 1)));
        res = await callTask(task as never, items[i] as never, { sessionId, store: true, timeoutMs: 30000 });
      }
      logCall({ ts: new Date().toISOString(), task: task.name, task_hash: "more", session_id: sessionId, store: true, ok: res.ok, latency_ms: Math.round(res.latencyMs), prompt_tokens: res.usage?.prompt_tokens, completion_tokens: res.usage?.completion_tokens, request_id: res.requestId, served_by: "unknown", error: res.error });
      res.ok ? ok++ : failed++;
      if ((i + 1) % 10 === 0) console.log(`${tag} ${i + 1}/${items.length} ok=${ok} failed=${failed} left=${res.limits?.["remaining-tokens"] ?? "-"}`);
    }
  };
  await Promise.all(Array.from({ length: 3 }, worker));
}
await run(generalPlanTask, inputs, "plan");
await run(generalSpeechTask, speech, "speech");
await run(generalForgeTask, forgeIn, "forge");
console.log({ plans: nPlans, speech: nSpeech, forge: nForge, ok, failed });
