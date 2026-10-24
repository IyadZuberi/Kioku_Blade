// CPU profile of a fight in real Chrome: top self-time functions. Use the dev server (readable names).
//   node tools/profile.mjs [querystring]      PERF_URL=http://localhost:5411/
import { chromium } from "playwright";

const BASE = process.env.PERF_URL ?? "http://localhost:5411/";
const qs = process.argv[2] ?? "quality=low";
const browser = await chromium.launch({
  channel: "chrome",
  headless: false,
  args: ["--disable-renderer-backgrounding", "--disable-backgrounding-occluded-windows", "--disable-features=CalculateNativeWinOcclusion", "--ignore-gpu-blocklist", "--mute-audio", "--autoplay-policy=no-user-gesture-required"],
});
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
await page.goto(`${BASE}?name=Prof&${qs}`, { waitUntil: "load" });
await page.waitForFunction(() => window.__duel && window.__duel.ready, null, { timeout: 120000 });
await page.evaluate(() => {
  const g = window.__duel.game;
  g.startFight();
  g.boss.passive = false;
  window.__duel.autoPlay(true);
});
await page.waitForTimeout(5000);
const cdp = await page.context().newCDPSession(page);
await cdp.send("Profiler.enable");
await cdp.send("Profiler.setSamplingInterval", { interval: 500 });
await cdp.send("Profiler.start");
const fps = await page.evaluate(() => new Promise((res) => { let n = 0; const s = performance.now(); const t = () => { n++; if (performance.now() - s < 6000) requestAnimationFrame(t); else res(+(n / 6).toFixed(1)); }; requestAnimationFrame(t); }));
const { profile } = await cdp.send("Profiler.stop");
const self = new Map();
const byId = new Map(profile.nodes.map((n) => [n.id, n]));
const total = profile.timeDeltas.reduce((a, b) => a + b, 0);
profile.samples.forEach((id, i) => {
  const n = byId.get(id);
  const f = n.callFrame;
  const key = `${f.functionName || "(anonymous)"} ${f.url.split("/").slice(-2).join("/")}:${f.lineNumber}`;
  self.set(key, (self.get(key) ?? 0) + profile.timeDeltas[i]);
});
// inclusive time per function (self + descendants), counted once per sample via the stack
const parent = new Map();
for (const n of profile.nodes) for (const c of n.children ?? []) parent.set(c, n.id);
const incl = new Map();
profile.samples.forEach((id, i) => {
  const seen = new Set();
  for (let cur = id; cur !== undefined; cur = parent.get(cur)) {
    const f = byId.get(cur).callFrame;
    const key = `${f.functionName || "(anonymous)"} ${f.url.split("/").slice(-2).join("/")}:${f.lineNumber}`;
    if (!seen.has(key)) {
      seen.add(key);
      incl.set(key, (incl.get(key) ?? 0) + profile.timeDeltas[i]);
    }
  }
});
const topIncl = [...incl.entries()].filter(([k]) => !/three\.module|\(root\)|\(program\)|\(idle\)/.test(k)).sort((a, b) => b[1] - a[1]).slice(0, 30);
console.log("--- inclusive (non-three) ---");
for (const [k, v] of topIncl) console.log(`${(v / total * 100).toFixed(1).padStart(5)}%  ${k}`);
const top = [...self.entries()].sort((a, b) => b[1] - a[1]).slice(0, 28);
console.log(JSON.stringify({ fps, totalMs: Math.round(total / 1000) }));
for (const [k, v] of top) console.log(`${(v / total * 100).toFixed(1).padStart(5)}%  ${k}`);
await browser.close();