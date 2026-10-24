// Replays a recorded hand session (kioku-gesture-calibration.json from the training window) through the
// gesture tracker and reports, per step, what was recognised; then sweeps the swipe-speed threshold.
//   ../server/node_modules/.bin/tsx tools/gesture-replay.ts <file.json>
import { readFileSync } from "node:fs";
import { GESTURE, GestureTracker, type Hand } from "../src/input/gestureLogic";
import type { CalFile } from "../src/input/calibration";

const file = JSON.parse(readFileSync(process.argv[2] ?? "kioku-gesture-calibration.json", "utf8")) as CalFile;
const hands = (f: CalFile["frames"][number]): Hand[] => f.hands.map((h) => h.map(([x, y]) => ({ x, y })));

interface Run {
  per: Map<string, Map<string, number>>;
  stick: Map<string, { x: number[]; y: number[] }>;
}
function run(): Run {
  const tr = new GestureTracker();
  const per = new Map<string, Map<string, number>>();
  const stick = new Map<string, { x: number[]; y: number[] }>();
  for (const f of file.frames) {
    const ev = tr.update(hands(f), f.t);
    const m = per.get(f.step) ?? new Map<string, number>();
    for (const e of ev) if (e.type === "press") m.set(e.action, (m.get(e.action) ?? 0) + 1);
    per.set(f.step, m);
    const s = stick.get(f.step) ?? { x: [], y: [] };
    s.x.push(tr.axis.x);
    s.y.push(tr.axis.y);
    stick.set(f.step, s);
  }
  return { per, stick };
}

const avg = (a: number[]) => (a.length ? a.reduce((p, c) => p + c, 0) / a.length : 0);
const base = run();
console.log(`frames ${file.frames.length}, ${file.recordedAt}`);
for (const s of file.steps) {
  const m = base.per.get(s.id) ?? new Map();
  const st = base.stick.get(s.id) ?? { x: [], y: [] };
  const hs = file.frames.filter((f) => f.step === s.id);
  const seen = hs.length ? hs.filter((f) => f.hands.length).length / hs.length : 0;
  const peak = Math.max(0, ...hs.map((f) => f.speed));
  console.log(
    `${s.id.padEnd(8)} expect ${String(s.expect ?? "-").padEnd(8)} presses ${JSON.stringify(Object.fromEntries(m))}  stick avg (${avg(st.x).toFixed(2)}, ${avg(st.y).toFixed(2)})  hands seen ${(seen * 100).toFixed(0)}%  peak speed ${peak.toFixed(1)}`,
  );
}

// swipe threshold sweep: wanted presses in strike/step/jump vs unwanted presses in rest + the stick steps
const wanted = { strike: "attack", step: "dodge", jump: "jump" } as Record<string, string>;
const calm = ["rest", "forward", "back", "left", "right", "guard"];
console.log("\nswipeSpeed  hits(strike/step/jump)  wrong-kind  false(calm steps)");
const keep = GESTURE.swipeSpeed;
for (const v of [2.5, 3, 3.5, 4, 5, 6, 7, 8]) {
  GESTURE.swipeSpeed = v;
  const r = run();
  let hits = 0, wrong = 0, fals = 0;
  for (const [step, act] of Object.entries(wanted)) {
    const m = r.per.get(step) ?? new Map();
    for (const [a, n] of m) if (a === act) hits += n; else if (a !== "block") wrong += n;
  }
  for (const step of calm) for (const [a, n] of r.per.get(step) ?? new Map()) if (a !== "block" || step !== "guard") fals += n;
  console.log(`${v.toFixed(1).padStart(9)}  ${String(hits).padStart(20)}  ${String(wrong).padStart(10)}  ${String(fals).padStart(16)}`);
}
GESTURE.swipeSpeed = keep;
