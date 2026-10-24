// Real-time frames of a sequence → shots/film_<name>_NN.png (then: node tools/montage.mjs film_<name>).
// Usage: node tools/film.mjs finisher|gate [every=0.3] [seconds=4]
import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { launch } from "./gpu.mjs";

const [name = "finisher", everyA = "0.3", secsA = "4"] = process.argv.slice(2);
const every = +everyA, secs = +secsA;
const out = join(dirname(fileURLToPath(import.meta.url)), "..", "shots");
mkdirSync(out, { recursive: true });
const { browser, page, errors } = await launch({ width: 1280, height: 720 });
if (name === "finisher") {
  await page.evaluate(() => window.__duel.scene("break"));
  await page.evaluate(() => { const g = window.__duel.game; g.bot.deflect = false; g.startFinisher(); g.resume(); });
} else if (name === "gate") {
  // the real path: two wins already on boss 1, this finisher is the third, then any key at the victory prompt
  await page.evaluate(() => { const g = window.__duel.game; g.progress = { boss: 1, streak: 2, unlocked: 1, cleared: false }; });
  await page.evaluate(() => window.__duel.scene("break"));
  await page.evaluate(() => { const g = window.__duel.game; g.bot.deflect = false; g.bot.play = false; g.startFinisher(); g.resume(); });
  await page.waitForFunction(() => window.__duel.game.state === "victory", null, { timeout: 15000 });
  await page.waitForTimeout(6500);
  await page.keyboard.press("Enter");
}
const n = Math.round(secs / every);
for (let i = 0; i < n; i++) {
  await page.screenshot({ path: join(out, `film_${name}_${String(i).padStart(2, "0")}.png`) });
  const st = await page.evaluate(() => { const g = window.__duel.game; const f = (v) => v.toArray().map((x) => x.toFixed(1)).join(","); return `${g.state} cam=${g.cam.mode} ov=${!!g.cam.override} camPos=${f(g.camera.position)} P=${f(g.player.pos)} B=${f(g.boss.pos)} bstate=${g.boss.state}`; });
  if (process.env.LOG || i % 4 === 0) console.log(i, st);
  await page.waitForTimeout(every * 1000);
}
await browser.close();
if (errors.length) console.log("ERRORS:\n" + errors.join("\n"));
