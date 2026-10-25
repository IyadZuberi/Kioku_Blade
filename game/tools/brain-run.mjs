// A real-browser run against a high-level general: does he play his learned moves, feint, rage, and stay playable (bot fights him)?
//   PERF_URL=http://localhost:5410/ node tools/brain-run.mjs [level=14]
import { chromium } from "playwright";
const BASE = process.env.PERF_URL ?? "http://localhost:5410/";
const level = Number(process.argv[2] ?? 14);
const brain = { v: 1, duels: 6, wins: 3, level, style: { aggression: 0.3, guard: 0.1, deflect: 0.6, dodge: 0.1, jump: 0.1, heal: 0 }, moves: { thrust: { used: 8, hit: 5 }, sweep: { used: 6, hit: 0 } }, cond: "afterDodge", condRun: 0, seed: 11, range: { nearT: 60, farT: 6, hitNear: 6, hitFar: 0 }, taught: ["windSlash", "lunge"] };
const browser = await chromium.launch({ channel: "chrome", headless: true, args: ["--use-angle=d3d11", "--use-gl=angle", "--enable-gpu", "--ignore-gpu-blocklist", "--mute-audio"] });
for (const boss of [1, 2, 3]) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  const errs = [];
  page.on("pageerror", (e) => errs.push(e.message));
  page.on("console", (m) => m.type() === "error" && !/502|Failed to load/.test(m.text()) && errs.push(m.text()));
  await page.addInitScript(([b, n]) => localStorage.setItem(`kioku.brain.Run.${n}`, JSON.stringify(b)), [brain, boss]);
  await page.goto(`${BASE}?name=Run&boss=${boss}`, { waitUntil: "load" });
  await page.waitForFunction(() => window.__duel && window.__duel.ready, null, { timeout: 90000 });
  await page.evaluate(() => { window.__duel.game.startFight(); window.__duel.autoPlay(true); });
  await page.waitForTimeout(40000);
  const r = await page.evaluate(() => {
    const g = window.__duel.game, b = g.boss;
    return { state: g.state, bossHealth: Math.round(b.health), playerHealth: Math.round(g.player.health), rage: b.rage, used: b.usedMoves, extras: b.extras, tactic: b.brain?.tactic, chains: b.brain?.chains.length, cond: b.brain?.cond, named: b.brain?.named.map((c) => c.name), stats: { hitsTaken: g.stats.hitsTaken, deflects: g.stats.deflects, dodged: g.stats.dodged, playerHits: g.stats.playerHits } };
  });
  console.log(`boss ${boss}:`, JSON.stringify(r), errs.length ? "ERRORS " + errs.slice(0, 3).join(" | ") : "no errors");
  await page.close();
}
await browser.close();
