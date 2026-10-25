import { chromium } from "playwright";
const b = await chromium.launch({ channel: "chrome", headless: true, args: ["--use-angle=d3d11", "--use-gl=angle", "--enable-gpu", "--ignore-gpu-blocklist", "--mute-audio"] });
for (const boss of [1, 2, 3]) {
  const p = await b.newPage({ viewport: { width: 1000, height: 640 } });
  await p.goto(`http://localhost:5410/?boss=${boss}&name=G`, { waitUntil: "load" });
  await p.waitForFunction(() => window.__duel && window.__duel.ready, null, { timeout: 90000 });
  for (const clip of ["guard", "block"]) {
    await p.evaluate((c) => { window.__duel.scene("closeB"); const g = window.__duel.game; g.boss.passive = true; g.boss.enter(c === "guard" ? "block" : "block"); g.boss.setClip(c, 0); for (let i = 0; i < 40; i++) g.step(1 / 60); }, clip);
    await p.waitForTimeout(500);
    await p.screenshot({ path: `${process.env.TEMP}/guard_${boss}_${clip}.png` });
  }
  await p.close();
}
await b.close();
