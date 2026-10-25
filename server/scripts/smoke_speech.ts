// LIVE: one general_speech call (and, with --backup, the plan on the backup model). Needs MUBIT_LIVE=1 and --yes-live.
import "../src/envAuto";
import { callTask, taskHash } from "../src/mubit/client";
import { cleanSpeech, generalSpeechTask, type SpeechInput } from "../src/prompts/general_speech";

if (process.argv.indexOf("--yes-live") < 0 || process.env.MUBIT_LIVE !== "1") {
  console.error("Sends 1 call to Mubit. Needs MUBIT_LIVE=1 and --yes-live. Nothing was sent.");
  process.exit(2);
}
const boss = Number(process.argv[process.argv.indexOf("--boss") + 1] || 3) as 1 | 2 | 3;
const input: SpeechInput = {
  boss,
  speaker: ["", "Masatora, the garden duelist", "Kazemaru, the spear of the wind", "Kurogane, the hollow shogun"][boss],
  fight: 3,
  result: "player lost",
  bossLevel: 6,
  habits: [{ habit: "dodge_spammer", evidence: "dodged 14 times and landed only 6 cuts in 50 seconds" }],
  dossier: "Blocks too long. Rolls when pressed. Never deflects the third cut.",
  councilIntel: "You dodged 14 attacks.",
};
const r = await callTask(generalSpeechTask, input, { sessionId: "gr-smoke-speech", store: true });
console.log("task", generalSpeechTask.name, taskHash(generalSpeechTask), generalSpeechTask.model, "ok", r.ok, `${Math.round(r.latencyMs)} ms`, r.requestId ?? "", r.error ?? "");
console.log(r.ok ? cleanSpeech(r.out) : r.out);
