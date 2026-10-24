// Frame pacing through the whole flow in real Chrome (vsync on): loading, title, prologue, chapter card,
// words, a fight, the finisher, the gate and the next chapter. Reports long frames per game state.
//   node tools/flowperf.mjs        PERF_URL=http://localhost:5410/
import { chromium } from "playwright";
const BASE = process.env.PERF_URL ?? "http://localhost:5410/";
const browser = await chromium.launch({ channel: "chrome", headless: false, args: ["--disable-renderer-backgrounding", "--disable-backgrounding-occluded-windows", "--disable-features=CalculateNativeWinOcclusion", "--mute-audio"] });
const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });
await page.addInitScript(() => {
  localStorage.removeItem("kioku.story");
  const log = (window.__frames = []);
  let last = 0;
  const tick = (t) => {
    if (last) log.push([+(t - last).toFixed(1), window.__duel?.game?.state ?? "loading", window.__duel?.ready ? 1 : 0]);
    last = t;
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
});
const t0 = Date.now();
await page.goto(`${BASE}?name=Flow`, { waitUntil: "load" });
await page.waitForFunction(() => window.__duel && window.__duel.ready, null, { timeout: 120000 });
console.log("ready after", ((Date.now() - t0) / 1000).toFixed(1), "s");
await page.waitForTimeout(2000);
await page.keyboard.press("Enter"); // title -> prologue
await page.waitForTimeout(3000);
await page.keyboard.press("Escape"); // skip prologue -> card
await page.waitForTimeout(4500);
await page.keyboard.press("Escape"); // skip words -> fight
await page.waitForTimeout(1500);
await page.evaluate(() => { const g = window.__duel.game; g.progress = { boss: 1, streak: 2, unlocked: 1, cleared: false }; window.__duel.autoPlay(true); });
await page.waitForTimeout(15000);
await page.evaluate(() => { const g = window.__duel.game; window.__duel.autoPlay(false); g.boss.posture = 100; g.boss.markers = 1; });
await page.waitForFunction(() => window.__duel.game.state !== "fight", null, { timeout: 20000 }).catch(() => {});
await page.evaluate(() => window.__duel.game.state === "deathblow" || window.__duel.game.startFinisher());
await page.waitForFunction(() => window.__duel.game.state === "victory", null, { timeout: 20000 }).catch(() => {});
await page.waitForTimeout(7000);
await page.keyboard.press("Enter"); // -> gate
await page.waitForTimeout(12000);
await page.keyboard.press("Escape");
await page.waitForTimeout(6000);
const frames = await page.evaluate(() => window.__frames);
const by = {};
for (const [dt, st, ready] of frames) {
  const k = ready ? st : "loading";
  by[k] ??= { n: 0, long: 0, worst: 0, sum: 0 };
  const b = by[k];
  b.n++; b.sum += dt; if (dt > 25) b.long++; b.worst = Math.max(b.worst, dt);
}
for (const [k, b] of Object.entries(by)) console.log(k.padEnd(10), "frames", String(b.n).padStart(5), "fps", (1000 / (b.sum / b.n)).toFixed(1).padStart(5), "long(>25ms)", String(b.long).padStart(4), `(${((b.long / b.n) * 100).toFixed(1)}%)`, "worst", b.worst, "ms");
await browser.close();
