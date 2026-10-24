// Allocation sampling during a fight (dev server for names): who makes the garbage that triggers GC hitches.
import { chromium } from "playwright";
const BASE = process.env.PERF_URL ?? "http://localhost:5411/";
const browser = await chromium.launch({ channel: "chrome", headless: false, args: ["--disable-renderer-backgrounding", "--disable-backgrounding-occluded-windows", "--disable-features=CalculateNativeWinOcclusion", "--mute-audio"] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
await page.goto(`${BASE}?name=Alloc&${process.argv[2] ?? ""}`, { waitUntil: "load" });
await page.waitForFunction(() => window.__duel && window.__duel.ready, null, { timeout: 120000 });
await page.evaluate(() => { const g = window.__duel.game; g.startFight(); g.boss.passive = false; window.__duel.autoPlay(true); });
await page.waitForTimeout(4000);
const cdp = await page.context().newCDPSession(page);
await cdp.send("HeapProfiler.enable");
await cdp.send("HeapProfiler.startSampling", { samplingInterval: 4096, includeObjectsCollectedByMajorGC: true, includeObjectsCollectedByMinorGC: true });
await page.waitForTimeout(6000);
const { profile } = await cdp.send("HeapProfiler.stopSampling");
const self = new Map();
let total = 0;
const walk = (n, stack) => {
  const f = n.callFrame;
  const key = `${f.functionName || "(anon)"} ${f.url.split("/").slice(-2).join("/").split("?")[0]}:${f.lineNumber + 1}`;
  const sz = n.selfSize;
  total += sz;
  if (sz) self.set(key, (self.get(key) ?? 0) + sz);
  for (const c of n.children) walk(c, stack);
};
walk(profile.head, []);
console.log("total sampled MB over 6s:", (total / 1e6).toFixed(1));
for (const [k, v] of [...self.entries()].sort((a, b) => b[1] - a[1]).slice(0, 30)) console.log(((v / 1e6) / 6).toFixed(3).padStart(7), "MB/s ", k);
await browser.close();
