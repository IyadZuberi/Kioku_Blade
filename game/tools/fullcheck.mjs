// A full pass through the game in a real browser, with the bot fighting: title, Settings, prologue (narrated),
// chapter card (narrated), parley, a duel with real keyboard movement, the shield banner, pause, finisher, victory,
// the council screen (needs the server), the gate (narrated) and the next chapter. Prints PASS/FAIL per feature and
// writes demo screenshots to ../docs/img/demo-*.jpg and a silent video to the folder given.
//   PERF_URL=http://localhost:5410/ node tools/fullcheck.mjs [videoDir]
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";

const BASE = process.env.PERF_URL ?? "http://localhost:5410/";
const out = new URL("../../docs/img/", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");
mkdirSync(out, { recursive: true });
const videoDir = process.argv[2];
const browser = await chromium.launch({ channel: "chrome", headless: true, args: ["--use-angle=d3d11", "--use-gl=angle", "--enable-gpu", "--ignore-gpu-blocklist", "--mute-audio", "--autoplay-policy=no-user-gesture-required"] });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 }, ...(videoDir ? { recordVideo: { dir: videoDir, size: { width: 1280, height: 720 } } } : {}) });
const page = await ctx.newPage();
const errs = [];
page.on("pageerror", (e) => errs.push(e.message));
page.on("console", (m) => m.type() === "error" && !/502|Failed to load resource/.test(m.text()) && errs.push(m.text()));
let fails = 0;
const check = (name, ok, detail = "") => {
  if (!ok) fails++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? "  — " + detail : ""}`);
};
const shot = (n) => page.screenshot({ path: `${out}demo-${n}.jpg`, type: "jpeg", quality: 84 });
const G = (fn, arg) => page.evaluate(fn, arg);
const state = () => G(() => window.__duel.game.state);
/** Skip narration and cards without ever pressing Esc inside a duel (Esc there opens the pause menu). */
async function skipScenes(untilState = "fight", max = 14) {
  for (let i = 0; i < max; i++) {
    if ((await state()) === untilState) return;
    const busy = await G(() => window.__duel.game.subs.playing || document.getElementById("chapter")?.classList.contains("on"));
    if (busy && (await G(() => window.__duel.game.subs.playing))) await page.keyboard.press("Escape");
    await page.waitForTimeout(700);
  }
}

// seed a brain that has already learned a lot, so the new systems are in play (shield, combos, tactic, new moves)
await page.addInitScript(() => {
  localStorage.removeItem("kioku.story");
  localStorage.setItem("kioku.brain.Ronin.1", JSON.stringify({ v: 1, duels: 5, wins: 2, level: 11, style: { aggression: 0.3, guard: 0.1, deflect: 0.6, dodge: 0.1, jump: 0.1, heal: 0 }, moves: { thrust: { used: 8, hit: 5 }, sweep: { used: 6, hit: 0 } }, cond: "afterDodge", condRun: 0, seed: 11, range: { nearT: 60, farT: 6, hitNear: 6, hitFar: 0 } }));
  window.__voiceCalls = [];
});
await page.goto(`${BASE}?name=Ronin`, { waitUntil: "load" });
await page.waitForFunction(() => window.__duel && window.__duel.ready, null, { timeout: 120000 });
await G(() => { const v = window.__duel.game.subs.voice, s = v.speak.bind(v); v.speak = (t, w, e, id) => (window.__voiceCalls.push(id || "(live)"), s(t, w, e, id)); });
await page.waitForTimeout(1800);

// ---- title and settings
check("title screen", (await state()) === "title");
const titleInfo = await G(() => ({ opts: document.querySelectorAll("#title .diff .opt").length, text: document.body.innerText.replace(/\s+/g, " ").slice(0, 240) }));
check("title names the three generals and the difficulty choice", titleInfo.opts === 3 && /Masatora/.test(titleInfo.text) && /Kurogane/.test(titleInfo.text), titleInfo.text);
await shot("title");
await page.keyboard.press("F1");
await page.waitForTimeout(500);
let opened = await G(() => document.getElementById("ctl").classList.contains("on"));
if (!opened) { await page.locator("#ctl-chip").click({ timeout: 3000 }).catch(() => {}); await page.waitForTimeout(400); opened = await G(() => document.getElementById("ctl").classList.contains("on")); }
check("Settings opens (F1 or the chip)", opened);
for (const tab of ["keyboard", "pad", "hands", "moves", "sound"]) {
  await G((t) => document.querySelector(`#ctl [role=tab]#tab-${t}, #ctl nav button[data-tab="${t}"]`)?.click(), tab);
}
const tabs = await G(() => [...document.querySelectorAll("#ctl nav button")].map((b) => b.textContent.trim()));
check("Settings has Keyboard, Controller, Hands, Moves and Sound tabs", tabs.length >= 5, tabs.join(", "));
await G(() => [...document.querySelectorAll("#ctl nav button")].find((b) => /Moves/i.test(b.textContent))?.click());
await page.waitForTimeout(300);
check("the moves list is filled in", await G(() => document.querySelectorAll("#ctl .rows > *").length > 6));
await shot("settings-moves");
await G(() => [...document.querySelectorAll("#ctl nav button")].find((b) => /Sound/i.test(b.textContent))?.click());
await page.waitForTimeout(300);
check("Sound tab: master, music, effects, voices and mute", await G(() => document.querySelectorAll("#ctl input[type=range]").length >= 4));
await shot("settings-sound");
await page.keyboard.press("Escape");

// ---- prologue, chapter card, parley
await page.keyboard.press("Enter");
await page.waitForTimeout(1500);
check("the prologue plays, narrated", await G(() => document.getElementById("subs").classList.contains("on")) && (await G(() => window.__voiceCalls.includes("pro-1"))));
await shot("prologue");
await page.keyboard.press("Escape");
await page.waitForTimeout(1800);
check("the chapter card is narrated", await G(() => window.__voiceCalls.includes("card-1")));
await shot("chapter-card");
await page.waitForFunction(() => window.__duel.game.state === "parley" || window.__duel.game.state === "fight", null, { timeout: 20000 }).catch(() => {});
await page.waitForTimeout(900);
check("the parley before the duel plays", (await state()) === "parley", await state());
await shot("parley");
await skipScenes("fight");
check("the duel starts", (await state()) === "fight");
await page.waitForTimeout(2500); // the opening leap

// ---- the duel with real keyboard movement
const pos = () => G(() => { const p = window.__duel.game.player.pos; return [p.x, p.z]; });
const p0 = await pos();
await page.keyboard.down("KeyD");
await page.waitForTimeout(700);
await page.keyboard.up("KeyD");
const p1 = await pos();
check("D strafes (keyboard movement)", Math.hypot(p1[0] - p0[0], p1[1] - p0[1]) > 0.3, `moved ${Math.hypot(p1[0] - p0[0], p1[1] - p0[1]).toFixed(2)} m`);
await page.keyboard.down("KeyS");
await page.waitForTimeout(500);
await page.keyboard.up("KeyS");
const p2 = await pos();
check("S walks back", Math.hypot(p2[0] - p1[0], p2[1] - p1[1]) > 0.2);
check("the shield banner shows the condition he hides behind", await G(() => /Shielded/.test(document.getElementById("cond")?.textContent ?? "")));
check("the pause button is on screen", await G(() => document.getElementById("pausechip").classList.contains("on")) || (await page.waitForTimeout(400), await G(() => document.getElementById("pausechip").classList.contains("on"))));
await shot("fight-shield");
await G(() => { const g = window.__duel.game; g.progress = { boss: 1, streak: 2, unlocked: 1, cleared: false }; window.__duel.autoPlay(true); }); // two wins behind him: the next win opens the gate
await page.waitForTimeout(14000);
const st = await G(() => { const g = window.__duel.game; return { deflects: g.stats.deflects, hits: g.stats.playerHits, taken: g.stats.hitsTaken, tactic: g.boss.brain?.tactic, named: g.boss.brain?.named.map((c) => c.name), extras: g.boss.extras, used: g.boss.usedMoves }; });
check("he fights back (attacks started)", Object.keys(st.used).length >= 3, JSON.stringify(st.used));
check("the player deflects and cuts", st.deflects > 3 && st.hits > 3, `deflects ${st.deflects}, cuts ${st.hits}, hits taken ${st.taken}`);
check("he plays learned combos, a tactic and new moves", (st.named?.length ?? 0) > 0 && !!st.tactic && st.extras.length > 1, `${st.tactic}; ${st.named?.join(", ")}; ${st.extras.join(", ")}`);
await shot("fight-deflect");

// ---- pause in a duel
await page.keyboard.press("Escape");
await page.waitForTimeout(400);
check("Esc pauses the duel", await G(() => document.getElementById("pause").classList.contains("on")));
await shot("pause");
await page.keyboard.press("Escape");
await page.waitForTimeout(500);

// ---- break him, finisher, victory
await G(() => { const g = window.__duel.game; window.__duel.autoPlay(false); g.boss.posture = 100; g.boss.markers = 1; });
await page.waitForFunction(() => window.__duel.game.state !== "fight", null, { timeout: 20000 }).catch(() => {});
await G(() => window.__duel.game.state === "deathblow" || window.__duel.game.startFinisher());
await page.waitForTimeout(900);
check("the finisher plays", (await state()) === "finisher" || (await state()) === "deathblow", await state());
await shot("finisher");
await page.waitForFunction(() => window.__duel.game.state === "victory", null, { timeout: 25000 }).catch(() => {});
check("victory", (await state()) === "victory");
await page.waitForTimeout(8000);
check("the council screen shows what he learned", await G(() => /He has fought you/.test(document.body.textContent)), await G(() => (document.body.textContent.match(/Level [\d.]+[^.]*\./) ?? [""])[0]));
await shot("council");
const brain = await G(() => JSON.parse(localStorage.getItem("kioku.brain.Ronin.1")));
check("his brain levelled up and was saved", brain && brain.duels === 6 && brain.level > 11, brain && `level ${brain.level.toFixed(1)}`);

// ---- the gate and the next chapter
await page.keyboard.press("Enter");
await page.waitForTimeout(2500);
check("the gate walk is narrated", await G(() => window.__voiceCalls.includes("gate-1")), await state());
await shot("gate");
await page.waitForFunction(() => window.__duel.game.state !== "gate", null, { timeout: 30000 }).catch(() => {});
await page.waitForTimeout(1800);
check("the next chapter's card is narrated", await G(() => window.__voiceCalls.includes("card-2")));
await shot("chapter-2");
await skipScenes("fight", 20);
check("the second general's duel starts on the rooftop", (await state()) === "fight" && (await G(() => window.__duel.game.bossDef.id)) === 2);
await page.waitForTimeout(1500);
await shot("fight-2");

const fps = await G(() => window.__duel.stats().fps ?? null);
check("no page errors in the whole run", errs.length === 0, errs.slice(0, 3).join(" | "));
console.log(fails ? `\n${fails} FAILED` : "\nall checks passed");
await ctx.close();
await browser.close();
process.exit(fails ? 1 : 0);
