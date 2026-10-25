// The pose trainer in a real browser on a fake camera: train three actions in a row, check every one is kept, a retrain replaces
// only its own action, one hand or two hands both fire, and everything survives a reload.
import { chromium } from "playwright";
const b = await chromium.launch({ channel: "chrome", headless: true, args: ["--use-angle=d3d11", "--use-gl=angle", "--enable-gpu", "--ignore-gpu-blocklist", "--mute-audio"] });
const p = await b.newPage({ viewport: { width: 1200, height: 800 } });
const errs = [];
p.on("pageerror", (e) => errs.push(e.message));
await p.goto((process.env.PERF_URL ?? "http://localhost:5410/") + "?name=PoseCheck", { waitUntil: "load" });
await p.waitForFunction(() => window.__duel && window.__duel.ready, null, { timeout: 90000 });
await p.evaluate(() => localStorage.removeItem("kioku-poses"));
await p.evaluate(() => {
  // synthetic hands: wrist at (x, .6), palm up, fingers curled by `curl`, fanned by `spread`; raw x 0.3 shows on the right of the picture
  window.mk = (curl, x = 0.3, spread = 0) => {
    const h = [{ x, y: 0.6, z: 0 }];
    for (let i = 1; i < 21; i++) { const f = Math.floor((i - 1) / 4), s = ((i - 1) % 4) + 1; h.push({ x: x + (f - 2) * 0.02 + spread * s * 0.01, y: 0.52 - (s - 1) * 0.03 * (1 - curl * 0.9) - (f === 2 ? 0.01 : 0), z: 0 }); }
    return h;
  };
  window.mirror = (h) => h.map((q) => ({ ...q, x: 2 * h[0].x - q.x }));
});
await p.evaluate(async () => { window.feed = await window.__duel.poseDemo(); });
let ok = true;
const check = (n, v, d = "") => { if (!v) ok = false; console.log(v ? "PASS" : "FAIL", n, d); };
const frames = async (hs, n, ms = 33) => { for (let i = 0; i < n; i++) { await p.evaluate((x) => window.feed(x.map((a) => a.m ? window.mirror(window.mk(...a.args)) : window.mk(...a.args))), hs); await p.waitForTimeout(ms); } };
const capture = async (action, hand) => {
  await p.selectOption("#poses select", action);
  await p.click("#poses [data-capture]");
  const t0 = Date.now();
  while (Date.now() - t0 < 3500) { await frames([hand], 1); }
  await p.waitForTimeout(200);
};
await capture("block", { args: [1] });
await capture("attack", { args: [0.5, 0.3, 4] });
await capture("jump", { args: [0.2, 0.3, -6] });
const stored = async () => (await p.evaluate(() => JSON.parse(localStorage.getItem("kioku-poses") ?? '{"poses":[]}'))).poses.map((x) => x.action).sort();
check("three captures keep three poses", JSON.stringify(await stored()) === JSON.stringify(["attack", "block", "jump"]), JSON.stringify(await stored()));
check("the list shows all of them", (await p.locator("#poses .list .item button[data-del]").count()) === 3);
await capture("attack", { args: [0.6, 0.3, 5] });
check("retraining an action replaces only that action", JSON.stringify(await stored()) === JSON.stringify(["attack", "block", "jump"]) && (await p.locator("#poses .list .item").count()) === 3, JSON.stringify(await stored()));
// both hands: left hand holds the block shape (mirrored), right hand does the attack shape
await p.waitForTimeout(5200); // the "Saved." notice shows for five seconds
await frames([{ args: [1, 0.3], m: false }], 6);
await p.waitForTimeout(100);
const now = await p.textContent("#poses .now");
check("the readout shows what each hand is doing", /Left hand:.*Right hand:/.test(now), now);
await p.evaluate(() => (window.feed([window.mirror(window.mk(1, 0.7)), window.mk(0.6, 0.3, 5)]), 0));
for (let i = 0; i < 5; i++) await frames([{ args: [1, 0.7], m: true }, { args: [0.6, 0.3, 5] }], 1);
const both = await p.textContent("#poses .now");
check("two hands are read at once", /Left hand: Guard.*Right hand: Strike/.test(both), both);
await p.screenshot({ path: new URL("../../docs/img/demo-poses.jpg", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1"), type: "jpeg", quality: 84 });
await p.click("#poses [data-done]");
await p.reload({ waitUntil: "load" });
await p.waitForFunction(() => window.__duel && window.__duel.ready, null, { timeout: 90000 });
check("the poses survive a reload", JSON.stringify(await stored()) === JSON.stringify(["attack", "block", "jump"]));
check("no page errors", errs.length === 0, errs.slice(0, 2).join(" | "));
await b.close();
process.exit(ok ? 0 : 1);
