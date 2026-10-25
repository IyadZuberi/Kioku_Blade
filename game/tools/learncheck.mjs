// End to end: real fights (the bot plays and wins or loses), the real server and Mubit, then what the
// General became for the next duel. Needs: server on 8787 (MUBIT_LIVE=1 for real plans) and the preview on 5410.
//   DUEL_URL="http://localhost:5410/?boss=1&name=LC1" node tools/learncheck.mjs [duels=3] [win|lose|mix]
import { launch } from "./gpu.mjs";
const duels = +(process.argv[2] ?? 3), mode = process.argv[3] ?? "mix";
const { browser, page } = await launch({ width: 640, height: 360 });
const rows = [];
for (let n = 0; n < duels; n++) {
  const win = mode === "win" || (mode === "mix" && n % 2 === 1);
  await page.evaluate((win) => {
    const d = window.__duel, g = d.game;
    g.pause(); g.startFight(); d.autoPlay(win);
    // a lost duel: the bot stands still and takes it
    g.bot.play = win; g.bot.deflect = win;
    for (let i = 0; i < 60 * 150 && g.state !== "victory" && g.state !== "defeat"; i++) {
      g.step(1 / 60);
      if (g.state === "dying" && g.input.promptArmed) { g.step(0.6); g.input.promptPress("Enter"); }
    }
  }, win);
  const r = await page.evaluate(async () => {
    const g = window.__duel.game;
    g.resume();
    await new Promise((res) => { const t0 = performance.now(); const id = setInterval(() => { if (g.learn.state === "ready" || performance.now() - t0 > 15000) { clearInterval(id); res(); } }, 100); });
    g.pause();
    const res = g.learn.result;
    return { state: g.state, source: res?.source, valid: res?.valid, level: res?.bossLevel, req: res?.requestId, intel: res?.plan?.intel, taunt: res?.plan?.taunt, focus: res?.plan?.focus_habit, opens: res?.plan?.opening_strings, model: res?.model, lines: res?.lines, dossier: res?.dossier, tempo: res?.plan?.tempo_step, gap: res?.plan?.gap_step, mem: { ...g.mem } };
  });
  // the next duel's General, as the game would build him
  const next = await page.evaluate(() => {
    const g = window.__duel.game;
    g.startFight();
    const D = window.__duel.rules.DIFFICULTY;
    return { parry3: D.bossDeflect[3], counterDelay: +D.counterDelay.toFixed(2), recover: D.recoverAfterAttack.map((x) => +x.toFixed(2)), tempoP2: D.tempo[1], gapP1: D.gap.p1.map((x) => +x.toFixed(2)), opening: g.boss.__q ?? undefined };
  });
  rows.push({ duel: n + 1, result: win ? "WIN" : "LOSS", ...r, next });
  if (n < duels - 1) await page.waitForTimeout(+(process.env.GAP_MS ?? 22000)); // Groq free tier: ~8k tokens a minute
}
for (const r of rows) {
  console.log(`\nduel ${r.duel} ${r.result}  plan from ${r.source}${r.valid ? "" : " (invalid)"}  level ${r.level}  req ${r.req ?? "-"}`);
  console.log(`  he read: ${r.focus}  opens ${JSON.stringify(r.opens)}  tempo ${r.tempo} gap ${r.gap}`);
  console.log(`  intel: ${r.intel}`);
  console.log(`  taunt: ${r.taunt}`);
  console.log(`  model: ${r.model ?? "-"}   his words next duel: ${r.lines?.source === "mubit" ? JSON.stringify({ greeting: r.lines.greeting, parry: r.lines.parry, fall: r.lines.fall, win: r.lines.win }) : "(canned)"}`);
  console.log(`  his notes on you: ${r.dossier ?? "-"}`);
  console.log(`  remembers: ${JSON.stringify(r.mem)}`);
  console.log(`  next duel: parries a 3-cut string ${Math.round(r.next.parry3 * 100)}%, answers after ${r.next.counterDelay}s, openings ${r.next.recover}, tempo p2 ${r.next.tempoP2}, gap p1 ${r.next.gapP1}`);
}
await browser.close();
