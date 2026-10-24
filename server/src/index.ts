import { resolve } from "node:path";
import { createApp } from "./app";
import { openDb } from "./db";
import { taskHash } from "./mubit/client";
import { makeCallPlan } from "./mubitPlan";
import { generalPlanTask } from "./prompts/general_plan";

const port = Number(process.env.PORT ?? 8787);
const db = openDb(process.env.DB_PATH ?? resolve(process.cwd(), "..", "data", "gr.sqlite"));
const app = createApp({ db, callPlan: makeCallPlan() });
app.listen(port, () => {
  console.log(`general server on :${port}`);
  console.log(`task general_plan hash ${taskHash(generalPlanTask)} model ${generalPlanTask.model}`);
  console.log(process.env.MUBIT_LIVE === "1" ? "MUBIT LIVE: calls will be sent (credits!)" : "Mubit OFF: rules plans only (set MUBIT_LIVE=1 to enable)");
});
