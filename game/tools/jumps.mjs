// Pose discontinuities: steps the fight at 60 Hz with the deflect bot and reports frames where the
// boss's (or player's) hips / chest / sword tip jump further than motion allows.
//   DUEL_URL=...?boss=N node tools/jumps.mjs [who=boss] [seconds=20]
import { launch } from "./gpu.mjs";
const who = process.argv[2] ?? "boss", secs = +(process.argv[3] ?? 20);
const { browser, page } = await launch({ width: 640, height: 360 });
const out = await page.evaluate(([who, secs]) => {
  const d = window.__duel, g = d.game;
  g.pause(); g.startFight(); d.autoPlay(true);
  const f = who === "boss" ? g.boss : g.player;
  const r = f.ch.rig;
  let prev = null;
  const res = [];
  for (let i = 0; i < secs * 60; i++) {
    g.step(1 / 60);
    const cur = { h: r.hipsW.clone(), c: r.chestW.clone(), t: r.tipW.clone(), p: f.pos.clone(), y: f.yaw };
    if (prev) {
      const dp = cur.p.distanceTo(prev.p);
      const dh = cur.h.distanceTo(prev.h) - dp;
      const dc = cur.c.distanceTo(prev.c) - dp;
      const dt = cur.t.distanceTo(prev.t);
      let dy = Math.abs(cur.y - prev.y); if (dy > Math.PI) dy = 2 * Math.PI - dy;
      if (dh > 0.09 || dc > 0.11 || dt > 0.9 || dy > 0.35 || dp > 0.25)
        res.push(`${(i / 60).toFixed(2)}s ${f.state}${f.attack ? ":" + f.attack.name : ""} t=${f.stateT.toFixed(2)} clip=${f.ch.clipName} dpos=${dp.toFixed(2)} dhips=${dh.toFixed(2)} dchest=${dc.toFixed(2)} dtip=${dt.toFixed(2)} dyaw=${dy.toFixed(2)}`);
    }
    prev = cur;
    if (g.state !== "fight" && g.state !== "deathblow" && g.state !== "finisher") break;
  }
  return res;
}, [who, secs]);
console.log(out.slice(0, 60).join("\n") || "no jumps");
console.log(out.length, "jumps");
await browser.close();
