// CPU profile of the page load (until __duel.ready). Dev server for names: PERF_URL=http://localhost:5411/
import { chromium } from "playwright";
const BASE = process.env.PERF_URL ?? "http://localhost:5411/";
const browser = await chromium.launch({ channel: "chrome", headless: false, args: ["--mute-audio"] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const cdp = await page.context().newCDPSession(page);
await cdp.send("Profiler.enable");
await cdp.send("Profiler.setSamplingInterval", { interval: 1000 });
const after = process.argv.includes("--after-ready");
if (!after) await cdp.send("Profiler.start");
const t0 = Date.now();
await page.goto(`${BASE}?name=Load`, { waitUntil: "load" });
await page.waitForFunction(() => window.__duel && window.__duel.ready, null, { timeout: 180000 });
console.log("ready", ((Date.now() - t0) / 1000).toFixed(1), "s");
if (after) {
  // the first seconds of the title, right after the loading screen lifts
  await cdp.send("Profiler.start");
  await page.waitForTimeout(2500);
}
const { profile } = await cdp.send("Profiler.stop");
const byId = new Map(profile.nodes.map((n) => [n.id, n]));
const parent = new Map();
for (const n of profile.nodes) for (const c of n.children ?? []) parent.set(c, n.id);
const incl = new Map(), self = new Map();
const total = profile.timeDeltas.reduce((a, b) => a + b, 0);
const key = (f) => `${f.functionName || "(anon)"} ${f.url.split("/").slice(-2).join("/").split("?")[0]}:${f.lineNumber + 1}`;
profile.samples.forEach((id, i) => {
  const dt = profile.timeDeltas[i];
  self.set(key(byId.get(id).callFrame), (self.get(key(byId.get(id).callFrame)) ?? 0) + dt);
  const seen = new Set();
  for (let c = id; c !== undefined; c = parent.get(c)) { const k = key(byId.get(c).callFrame); if (!seen.has(k)) { seen.add(k); incl.set(k, (incl.get(k) ?? 0) + dt); } }
});
console.log("--- inclusive (ms) ---");
for (const [k, v] of [...incl].filter(([k]) => !/\(root\)|\(program\)|\(idle\)/.test(k)).sort((a, b) => b[1] - a[1]).slice(0, 40)) console.log(String(Math.round(v / 1000)).padStart(6), k);
console.log("--- self (ms) ---");
for (const [k, v] of [...self].sort((a, b) => b[1] - a[1]).slice(0, 15)) console.log(String(Math.round(v / 1000)).padStart(6), k);
await browser.close();
