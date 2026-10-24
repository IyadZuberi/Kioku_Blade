// Side and front views of the general (look check). Usage: DUEL_URL=...?boss=N TAG=x node tools/side.mjs
import { launch } from "./gpu.mjs";
const { browser, page } = await launch({ width: 1200, height: 800 });
await page.evaluate(() => window.__duel.scene("closeB"));
for (const [n, dx, dz] of [["front", 0, 3.2], ["side", 3.2, 0], ["back", 0, -3.2]]) {
  await page.evaluate(([dx, dz]) => {
    const g = window.__duel.game, B = g.boss.pos, T = g.camera.constructor;
    g.cam.override = { pos: B.clone().set(B.x + dx, 1.7, B.z + dz), look: B.clone().set(B.x, 1.35, B.z) };
    g.step(0.05);
  }, [dx, dz]);
  await page.waitForTimeout(300);
  await page.screenshot({ path: `shots/look_${process.env.TAG ?? "x"}_${n}.png` });
}
await browser.close();
