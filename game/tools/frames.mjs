// Frame-time sequence in real Chrome (uncapped): shows jank patterns.
import { chromium } from "playwright";
const BASE = process.env.PERF_URL ?? "http://localhost:5410/";
const browser = await chromium.launch({ channel: "chrome", headless: false, args: ["--disable-renderer-backgrounding", "--disable-backgrounding-occluded-windows", "--disable-features=CalculateNativeWinOcclusion", "--ignore-gpu-blocklist", "--disable-gpu-vsync", "--disable-frame-rate-limit", "--mute-audio"] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
await page.goto(`${BASE}?quality=low&name=Frames&${process.argv[2] ?? ""}`, { waitUntil: "load" });
await page.waitForFunction(() => window.__duel && window.__duel.ready, null, { timeout: 90000 });
await page.evaluate(() => { const g = window.__duel.game; g.startFight(); g.boss.passive = true; if (window.__duel.autoPlay && new URLSearchParams(location.search).get("play") === "1") window.__duel.autoPlay(true); });
await page.waitForTimeout(4000);
const dts = await page.evaluate(() => new Promise((res) => { const ts = []; const tick = (t) => { ts.push(t); if (ts.length < 360) requestAnimationFrame(tick); else res(ts.slice(1).map((x, i) => +(x - ts[i]).toFixed(1))); }; requestAnimationFrame(tick); }));
console.log(dts.slice(0, 120).join(" "));
const sorted = [...dts].sort((a, b) => a - b);
const long = dts.map((d, i) => [d, i]).filter(([d]) => d > 24).map(([d, i]) => `${i}:${d}`);
console.log("p50", sorted[sorted.length >> 1], "p90", sorted[Math.floor(sorted.length * 0.9)], "p99", sorted[Math.floor(sorted.length * 0.99)], "long(>24ms) idx:ms", long.join(" "));
await browser.close();