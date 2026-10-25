import { launch } from "./gpu.mjs";
const { browser, page } = await launch({ width: 640, height: 360 });
const name = process.env.MOVE ?? "vanish";
const out = await page.evaluate((name) => {
  const d = window.__duel, g = d.game;
  g.pause(); g.startFight(); d.autoPlay(false); g.bot.play = false; g.bot.deflect = false;
  g.boss.passive = true;
  for (let i = 0; i < 90; i++) g.step(1 / 60);
  g.boss.pos.set(g.player.pos.x, 0, g.player.pos.z - 4.5);
  g.boss.passive = false;
  g.forceBossAttack(name);
  const rows = []; const evs = new Set();
  let hp0 = g.player.health;
  for (let i = 0; i < 200; i++) {
    g.step(1 / 60);
    const b = g.boss;
    const dist = Math.hypot(b.pos.x - g.player.pos.x, b.pos.z - g.player.pos.z);
    if (i % 12 === 0) rows.push(`${(i / 60).toFixed(2)}s state=${b.state} atk=${b.attack?.name ?? "-"}/${b.moveName} vanished=${b.vanished} vis=${g.bossBody.active.rig.root.visible} dist=${dist.toFixed(1)} y=${b.pos.y.toFixed(1)} php=${g.player.health.toFixed(0)}`);
  }
  return rows.join("\n");
}, name);
console.log(out);
await browser.close();
