// Which attacks each general actually uses in simulated fights (deflect bot plays). Usage: node tools/movecount.mjs
import { launch } from "./gpu.mjs";
const { browser, page } = await launch({ width: 640, height: 360 });
for (const boss of [1, 2, 3]) {
  const r = await page.evaluate((boss) => {
    const d = window.__duel, g = d.game;
    g.pause();
    g.selectBoss?.(boss);
    g.setBoss(boss);
    const seen = {};
    let serial = -1, hits = 0;
    for (let fight = 0; fight < 3; fight++) {
      g.startFight();
      d.autoPlay(true);
      for (let i = 0; i < 60 * 70 && g.state !== "victory" && g.state !== "defeat"; i++) {
        g.step(1 / 60);
        if (g.boss.serial !== serial && g.boss.state === "attack") {
          serial = g.boss.serial;
          seen[g.boss.moveName] = (seen[g.boss.moveName] ?? 0) + 1;
        }
      }
      hits += g.stats.playerHits;
    }
    return { boss: g.bossDef.latin, seen };
  }, boss);
  console.log(JSON.stringify(r));
}
await browser.close();
