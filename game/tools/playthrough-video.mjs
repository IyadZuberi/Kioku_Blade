// A silent screen recording (webm) of the whole flow with the bot playing: title, prologue, each chapter, fight,
// finisher, victory, gate. Not committed. PERF_URL=http://localhost:5410/ node tools/playthrough-video.mjs [outdir]
import { chromium } from "playwright";
const BASE = process.env.PERF_URL ?? "http://localhost:5410/";
const dir = process.argv[2] ?? "playthrough";
const browser = await chromium.launch({ channel: "chrome", headless: true, args: ["--use-angle=d3d11", "--use-gl=angle", "--enable-gpu", "--ignore-gpu-blocklist", "--mute-audio"] });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 }, recordVideo: { dir, size: { width: 1280, height: 720 } } });
const page = await ctx.newPage();
await page.addInitScript(() => localStorage.removeItem("kioku.story"));
await page.goto(`${BASE}?name=Ronin`, { waitUntil: "load" });
await page.waitForFunction(() => window.__duel && window.__duel.ready, null, { timeout: 120000 });
await page.waitForTimeout(3500);
await page.keyboard.press("Enter");
await page.waitForTimeout(7000); // prologue
await page.keyboard.press("Escape");
await page.waitForTimeout(6000); // chapter card
for (let boss = 1; boss <= 3; boss++) {
  await page.keyboard.press("Escape"); // skip the words
  await page.waitForTimeout(1500);
  await page.evaluate((b) => { const g = window.__duel.game; g.progress = { boss: b, streak: 2, unlocked: b, cleared: false }; window.__duel.autoPlay(true); }, boss);
  await page.waitForTimeout(18000);
  await page.evaluate(() => { const g = window.__duel.game; window.__duel.autoPlay(false); g.boss.posture = 100; g.boss.markers = 1; });
  await page.waitForFunction(() => window.__duel.game.state !== "fight", null, { timeout: 20000 }).catch(() => {});
  await page.evaluate(() => window.__duel.game.state === "deathblow" || window.__duel.game.startFinisher());
  await page.waitForFunction(() => window.__duel.game.state === "victory", null, { timeout: 25000 }).catch(() => {});
  await page.waitForTimeout(7000);
  if (boss < 3) {
    await page.keyboard.press("Enter"); // the gate to the next arena
    await page.waitForTimeout(13000);
    await page.keyboard.press("Escape");
    await page.waitForTimeout(6000);
  }
}
await page.waitForTimeout(3000);
await ctx.close();
await browser.close();
console.log("video in", dir);
