// Where a fight frame's time goes, in real Chrome (uncapped): simulation (fixed steps), frame update, render submit,
// and the remainder (GPU wait / browser). Usage: node tools/perfsplit.mjs [querystring]   PERF_URL=http://localhost:5410/
import { chromium } from "playwright";

const BASE = process.env.PERF_URL ?? "http://localhost:5410/";
const qs = process.argv[2] ?? "";
const browser = await chromium.launch({
  channel: "chrome",
  headless: false,
  args: ["--disable-renderer-backgrounding", "--disable-backgrounding-occluded-windows", "--disable-features=CalculateNativeWinOcclusion", "--ignore-gpu-blocklist", ...(process.env.VSYNC ? [] : ["--disable-gpu-vsync", "--disable-frame-rate-limit"]), "--mute-audio"],
});
const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });
await page.goto(`${BASE}?name=Split&${qs}`, { waitUntil: "load" });
await page.waitForFunction(() => window.__duel && window.__duel.ready, null, { timeout: 120000 });
const out = await page.evaluate(async () => {
  const d = window.__duel;
  const g = d.game;
  g.startFight();
  g.boss.passive = false;
  d.autoPlay(true);
  await new Promise((r) => setTimeout(r, +(new URLSearchParams(location.search).get("wait") ?? 4000)));
  const acc = { fixed: 0, fixedN: 0, frame: 0, post: 0 };
  const wrap = (obj, name, key, countKey) => {
    const f = obj[name].bind(obj);
    obj[name] = (...a) => {
      const t = performance.now();
      const r = f(...a);
      acc[key] += performance.now() - t;
      if (countKey) acc[countKey]++;
      return r;
    };
  };
  wrap(g, "fixed", "fixed", "fixedN");
  wrap(g, "frame", "frame");
  wrap(g.post, "render", "post");
  const ts = [];
  const spikes = [];
  let last = { fixed: 0, frame: 0, post: 0, fixedN: 0 };
  await new Promise((res) => {
    const tick = (t) => {
      if (ts.length && t - ts[ts.length - 1] > 22)
        spikes.push({ i: ts.length, dt: +(t - ts[ts.length - 1]).toFixed(1), fixed: +(acc.fixed - last.fixed).toFixed(1), steps: acc.fixedN - last.fixedN, post: +(acc.post - last.post).toFixed(1), state: g.state, boss: g.boss.state, atk: g.boss.attack?.name ?? null, heap: performance.memory ? Math.round(performance.memory.usedJSHeapSize / 1e6) : 0 });
      last = { ...acc };
      ts.push(t);
      if (ts.length < 600) requestAnimationFrame(tick);
      else res();
    };
    requestAnimationFrame(tick);
  });
  const n = ts.length - 1;
  const dts = ts.slice(1).map((x, i) => x - ts[i]).sort((a, b) => a - b);
  const total = ts[n] - ts[0];
  const info = g.renderer.info.render;
  return {
    renderer: g.rendererName,
    pixelRatio: g.renderer.getPixelRatio(),
    fps: +((n / total) * 1000).toFixed(1),
    p50: +dts[n >> 1].toFixed(1),
    p95: +dts[Math.floor(n * 0.95)].toFixed(1),
    p99: +dts[Math.floor(n * 0.99)].toFixed(1),
    perFrameMs: {
      fixed: +(acc.fixed / n).toFixed(2),
      fixedSteps: +(acc.fixedN / n).toFixed(2),
      frameUpdate: +((acc.frame - acc.post) / n).toFixed(2),
      renderSubmit: +(acc.post / n).toFixed(2),
      other: +((total - acc.fixed - acc.frame) / n).toFixed(2),
    },
    spikes: spikes.slice(0, 25),
    calls: info.calls,
    tris: info.triangles,
  };
});
console.log(JSON.stringify(out, null, 1));
await browser.close();
