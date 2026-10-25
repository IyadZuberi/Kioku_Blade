// LIVE: sends MORE examples to Mubit with storage ON, for BOTH tasks, so each task has plenty of kept examples
// to train its adapter on. Plan inputs are new (a different RNG seed than data/seed.json); speech inputs are built
// from the same fights. Spends starter credit.
//   MUBIT_LIVE=1 tsx scripts/send_more.ts --yes-live [--plans 120] [--speech 60]
import "../src/envAuto";
import seedrandom from "seedrandom";
import { HABITS, rulesPlan } from "@gr/shared";
import { callTask } from "../src/mubit/client";
import { logCall } from "../src/mubit/log";
import { generalPlanTask, type PlanInput } from "../src/prompts/general_plan";
import { generalSpeechTask, speakerOf, type SpeechInput } from "../src/prompts/general_speech";
import { genInput, type Archetype } from "../src/sim/archetypes";

if (process.argv.indexOf("--yes-live") < 0 || process.env.MUBIT_LIVE !== "1") {
  console.error("This sends live calls to Mubit and spends credits. Needs MUBIT_LIVE=1 and --yes-live. Nothing was sent.");
  process.exit(2);
}
const arg = (n: string, d: number) => Number(process.argv[process.argv.indexOf(n) + 1]) || d;
const nPlans = arg("--plans", 120), nSpeech = arg("--speech", 60);
const r = seedrandom("gr-seed-2");
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

let ok = 0, failed = 0;
async function run<I, O>(task: typeof generalPlanTask | typeof generalSpeechTask, items: I[], tag: string): Promise<void> {
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
console.log({ plans: nPlans, speech: nSpeech, ok, failed });
