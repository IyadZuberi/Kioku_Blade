// Fresh README screenshots (JPEG, 1600x900) into ../docs/img/. DUEL_URL=http://localhost:5410/ node tools/readme-shots.mjs
import { mkdirSync } from "node:fs";
import { launch } from "./gpu.mjs";
const out = new URL("../../docs/img/", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");
mkdirSync(out, { recursive: true });
const base = process.env.DUEL_URL ?? "http://localhost:5410/";
const shots = [["title", 1, "title", 1400], ["fight", 1, "arena1-masatora", 900], ["fight", 2, "arena2-kazemaru", 900], ["fight", 3, "arena3-kurogane", 900], ["finisher", 3, "finisher-kurogane", 700], ["victory", 2, "victory", 3000]];
for (const [scene, boss, name, wait] of shots) {
  process.env.DUEL_URL = `${base}?boss=${boss}&name=Ronin&quality=high`;
  const mod = await import(`./gpu.mjs?${name}`);
  const { browser, page, errors } = await mod.launch();
  await page.evaluate((n) => window.__duel.scene(n), scene);
  await page.waitForTimeout(wait);
  await page.screenshot({ path: `${out}${name}.jpg`, type: "jpeg", quality: 86 });
  console.log(name, errors.length ? errors.join(" | ") : "ok");
  await browser.close();
}
