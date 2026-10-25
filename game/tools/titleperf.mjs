// Frame times on the title screen after load, in real Chrome: when do the long frames happen?
import { chromium } from "playwright";
const BASE = process.env.PERF_URL ?? "http://localhost:5410/";
const browser = await chromium.launch({ channel: "chrome", headless: false, args: ["--disable-renderer-backgrounding", "--mute-audio"] });
const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });
await page.addInitScript(() => {
  const log = (window.__f = []);
  let last = 0;
  const tick = (t) => { if (last) log.push([Math.round(t), +(t - last).toFixed(1)]); last = t; requestAnimationFrame(tick); };
  requestAnimationFrame(tick);
});
await page.goto(`${BASE}?name=T`, { waitUntil: "load" });
await page.waitForFunction(() => window.__duel && window.__duel.ready, null, { timeout: 120000 });
const t0 = await page.evaluate(() => performance.now());
await page.waitForTimeout(8000);
const f = await page.evaluate(() => window.__f);
const after = f.filter(([t]) => t > t0);
const long = after.filter(([, d]) => d > 25);
console.log("title frames", after.length, "long", long.length, "worst", Math.max(...after.map((x) => x[1])));
console.log(long.map(([t, d]) => `${((t - t0) / 1000).toFixed(2)}s:${d}`).join(" "));
await browser.close();
