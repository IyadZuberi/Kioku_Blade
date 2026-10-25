// LIVE, one call: does the model design a sensible arsenal from a digest?  MUBIT_LIVE=1 tsx scripts/smoke_forge.ts --yes-live
import "../src/envAuto";
import { cleanForge, type BrainDigest } from "@gr/shared";
import { callTask, taskHash } from "../src/mubit/client";
import { generalForgeTask } from "../src/prompts/general_forge";

if (process.argv.indexOf("--yes-live") < 0 || process.env.MUBIT_LIVE !== "1") {
  console.error("Needs MUBIT_LIVE=1 and --yes-live. Nothing was sent.");
  process.exit(2);
}
const digest: BrainDigest = {
  boss: 2, lvl: 9, duels: 4, won: true,
  style: { agg: 0.35, guard: 0.1, defl: 0.7, dodge: 0.1, jump: 0.2, heal: 0 },
  near: 0.85, hitNear: 2, hitFar: 0,
  moves: ["leap", "combo", "comboDelay", "overhead", "thrust", "sweep", "grab", "flurry", "windSlash", "waterfowl", "spin", "lunge"],
  works: ["thrust", "comboDelay"], failed: ["sweep"], cond: "afterDodge",
};
console.log("task hash", taskHash(generalForgeTask), generalForgeTask.model);
const r = await callTask(generalForgeTask, digest, { sessionId: "gr-forge-smoke-1", store: true, timeoutMs: 30000 });
console.log({ ok: r.ok, latencyMs: Math.round(r.latencyMs), requestId: r.requestId, usage: r.usage, error: r.error });
console.log("raw:", JSON.stringify(r.out));
console.log("checked:", JSON.stringify(cleanForge(r.out, { moves: digest.moves, level: digest.lvl, cond: digest.cond }), null, 1));
