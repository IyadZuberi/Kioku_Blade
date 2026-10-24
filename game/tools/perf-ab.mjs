// Real-fps A/B of quality knobs in a real (non-throttled) Chrome window.
//   node tools/perf-ab.mjs "baseline=" "shadow1024=shadow=1024" "lights0=lights=0" ...
// Needs `pnpm -C game build; pnpm -C game preview` (port 5410) and Google Chrome installed.
import { chromium } from "playwright";

const BASE = process.env.PERF_URL ?? "http://localhost:5410/";
const SECS = Number(process.env.PERF_SECS ?? 5);
const configs = (process.argv.slice(2).length ? process.argv.slice(2) : ["baseline="]).map((a) => {
  const i = a.indexOf("=");
  const rest = a.slice(i + 1).split("@@");
  return { name: a.slice(0, i), qs: rest[0], js: rest[1] ?? "" };
});

const browser = await chromium.launch({
  channel: "chrome",
  headless: false,
  args: ["--disable-renderer-backgrounding", "--disable-backgrounding-occluded-windows", "--disable-features=CalculateNativeWinOcclusion", "--ignore-gpu-blocklist", "--enable-gpu-rasterization", "--disable-gpu-vsync", "--disable-frame-rate-limit", "--autoplay-policy=no-user-gesture-required", "--mute-audio"],
});
const rows = [];
for (const c of configs) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  await page.goto(`${BASE}?quality=low&name=Perf&${c.qs}`, { waitUntil: "load" });
  await page.waitForFunction(() => window.__duel && window.__duel.ready, null, { timeout: 90000 });
  await page.evaluate(() => {
    const g = window.__duel.game;
    g.startFight();
    g.boss.passive = true;
  });
  if (c.js) await page.evaluate(new Function("g", "scene", "THREE", `return (async () => { ${c.js} })()`).toString().length ? `(() => { const g = window.__duel.game; ${c.js} })()` : "");
  await page.waitForTimeout(4000); // warm-up
  const r = await page.evaluate(
    (secs) =>
      new Promise((res) => {
        const ts = [];
        const s = performance.now();
        const tick = (t) => {
          ts.push(t);
          if (performance.now() - s < secs * 1000) requestAnimationFrame(tick);
          else {
            const d = ts.slice(1).map((x, i) => x - ts[i]).sort((a, b) => a - b);
            res({ fps: +(ts.length / secs).toFixed(1), p50: +d[d.length >> 1].toFixed(1), p95: +d[Math.floor(d.length * 0.95)].toFixed(1), max: +d[d.length - 1].toFixed(1), pr: window.__duel.game.renderer.getPixelRatio(), gpu: window.__duel.game.rendererName.slice(0, 40) });
          }
        };
        requestAnimationFrame(tick);
      }),
    SECS,
  );
  rows.push({ config: c.name, ...r });
  console.log(JSON.stringify(rows[rows.length - 1]));
  await page.close();
}
await browser.close();