// IK accuracy vs cost: runs a scripted auto-play fight under different IK budgets (dev server).
//   node tools/ik-probe.mjs
import { chromium } from "playwright";
const BASE = process.env.PERF_URL ?? "http://localhost:5411/";
const browser = await chromium.launch({ channel: "chrome", headless: false, args: ["--disable-renderer-backgrounding", "--disable-backgrounding-occluded-windows", "--disable-features=CalculateNativeWinOcclusion", "--ignore-gpu-blocklist", "--mute-audio"] });
const page = await browser.newPage({ viewport: { width: 960, height: 540 } });
await page.goto(`${BASE}?quality=low&name=IK`, { waitUntil: "load" });
await page.waitForFunction(() => window.__duel && window.__duel.ready, null, { timeout: 120000 });
const out = await page.evaluate(async () => {
  const { IK_TUNE } = await import("/src/chars/SkinnedCharacter.ts");
  const d = window.__duel, g = d.game;
  g.pause();
  const res = [];
  for (const [name, arm, assist] of [["6/3 (old)", 6, 3], ["4/2", 4, 2], ["3/2", 3, 2], ["2/1", 2, 1]]) {
    IK_TUNE.arm = arm;
    IK_TUNE.assist = assist;
    d.setDifficulty("medium");
    g.startFight();
    d.autoPlay(true);
    let n = 0, assisted = 0, sumErr = 0, maxErr = 0, ms = 0;
    for (let i = 0; i < 1500; i++) {
      const t0 = performance.now();
      g.loop.step(1 / 120, false);
      ms += performance.now() - t0;
      const sk = g.bossBody.active, ref = g.bossBody.procedural;
      if (sk && sk !== ref && sk.assistW > 0.9 && sk.swordSocket) {
        const dd = sk.cfg.sword;
        sk.swordSocket.updateWorldMatrix(true, false);
        const tip = new sk.swordSocket.position.constructor(0, dd.tsuba + dd.blade, 0).applyMatrix4(sk.swordSocket.matrixWorld);
        const e = tip.distanceTo(ref.rig.tipW);
        assisted++;
        sumErr += e;
        maxErr = Math.max(maxErr, e);
      }
      n++;
      if (g.state === "victory" || g.state === "defeat") break;
    }
    res.push({ name, steps: n, msPerStep: +(ms / n).toFixed(2), assistedSteps: assisted, meanTipErrMm: assisted ? +(sumErr / assisted * 1000).toFixed(1) : null, maxTipErrMm: +(maxErr * 1000).toFixed(1), end: g.state });
    d.autoPlay(false);
  }
  IK_TUNE.arm = 6;
  IK_TUNE.assist = 3;
  g.resume();
  return res;
});
for (const r of out) console.log(JSON.stringify(r));
await browser.close();