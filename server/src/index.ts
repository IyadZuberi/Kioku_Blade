import "./envAuto";
import { resolve } from "node:path";
import { createApp } from "./app";
import { openDb } from "./db";
import { taskHash } from "./mubit/client";
import { makeCallPlan } from "./mubitPlan";
import { makeCallSpeech } from "./mubitSpeech";
import { makeCallForge } from "./mubitForge";
import { generalPlanTask } from "./prompts/general_plan";
import { generalSpeechTask } from "./prompts/general_speech";
import { generalForgeTask } from "./prompts/general_forge";
import { makeSay } from "./voice";

const port = Number(process.env.PORT ?? 8787);
// Loopback only by default (the Vite proxy reaches it). HOST=0.0.0.0 exposes it to the venue network.
const host = process.env.HOST ?? "127.0.0.1";
const db = openDb(process.env.DB_PATH ?? resolve(process.cwd(), "..", "data", "gr.sqlite"));
const app = createApp({ db, callPlan: makeCallPlan(), callSpeech: makeCallSpeech(), callForge: makeCallForge(), say: makeSay() });
app.listen(port, host, () => {
  console.log(`general server on ${host}:${port}`);
  console.log(`task general_plan hash ${taskHash(generalPlanTask)} model ${generalPlanTask.model}`);
  console.log(`task general_speech hash ${taskHash(generalSpeechTask)} model ${generalSpeechTask.model} via ${generalSpeechTask.baseURL}`);
  console.log(`task general_forge hash ${taskHash(generalForgeTask)} model ${generalForgeTask.model} via ${generalForgeTask.baseURL}`);
  console.log(process.env.MUBIT_LIVE === "1" ? "MUBIT LIVE: calls will be sent (credits!)" : "Mubit OFF: rules plans only (set MUBIT_LIVE=1 to enable)");
});
