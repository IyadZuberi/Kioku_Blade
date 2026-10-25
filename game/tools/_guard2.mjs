import { chromium } from "playwright";
const b = await chromium.launch({ channel: "chrome", headless: true, args: ["--use-angle=d3d11", "--use-gl=angle", "--enable-gpu", "--ignore-gpu-blocklist", "--mute-audio"] });
for (const boss of [1, 3]) {
  const p = await b.newPage({ viewport: { width: 1000, height: 640 } });
  await p.goto(`http://localhost:5410/?boss=${boss}&name=G`, { waitUntil: "load" });
  await p.waitForFunction(() => window.__duel && window.__duel.ready, null, { timeout: 90000 });
  await p.evaluate(async () => {
    const V = window.__duel.game.boss.pos.constructor;
    window.__duel.scene("closeB");
    const g = window.__duel.game, bo = g.boss;
    bo.passive = true; bo.enter("block"); bo.setClip("guard", 0);
    for (let i = 0; i < 40; i++) g.step(1 / 60);
    const at = bo.ch.rig.chestW.clone().add(new V(0.4, 0.1, 0.5));
    bo.ch.guardAt(at); bo.ch.bounce();
  });
  for (const [i, ms] of [[0, 60], [1, 150], [2, 300]]) {
    await p.evaluate((n) => { for (let k = 0; k < n; k++) window.__duel.game.step(1 / 60); }, ms === 60 ? 3 : ms === 150 ? 6 : 9);
    await p.waitForTimeout(250);
    await p.screenshot({ path: `${process.env.TEMP}/parry_${boss}_${i}.png` });
  }
  await p.close();
}
await b.close();
