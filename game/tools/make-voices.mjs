// Renders every fixed spoken line with Kokoro (open-source neural TTS, Apache-2.0) in headless Chrome into
// public/assets/voice/<line id>.wav + manifest.json. Run once; the files are committed.
//   pnpm exec vite --root tools/voice-render --port 5420 &   then   node tools/make-voices.mjs
import { chromium } from "playwright";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { execSync } from "node:child_process";

/** Kokoro's WAV is 32-bit float; 16-bit PCM is half the size and plays everywhere. */
function toInt16Wav(b) {
  if (b.readUInt16LE(20) !== 3) return b;
  const ch = b.readUInt16LE(22), sr = b.readUInt32LE(24);
  let i = 12;
  while (b.toString("ascii", i, i + 4) !== "data") i += 8 + b.readUInt32LE(i + 4);
  const n = b.readUInt32LE(i + 4) / 4;
  const pcm = Buffer.alloc(n * 2);
  for (let k = 0; k < n; k++) pcm.writeInt16LE(Math.max(-32768, Math.min(32767, Math.round(b.readFloatLE(i + 8 + k * 4) * 32767))), k * 2);
  const h = Buffer.alloc(44);
  h.write("RIFF", 0); h.writeUInt32LE(36 + pcm.length, 4); h.write("WAVEfmt ", 8); h.writeUInt32LE(16, 16); h.writeUInt16LE(1, 20);
  h.writeUInt16LE(ch, 22); h.writeUInt32LE(sr, 24); h.writeUInt32LE(sr * ch * 2, 28); h.writeUInt16LE(ch * 2, 32); h.writeUInt16LE(16, 34);
  h.write("data", 36); h.writeUInt32LE(pcm.length, 40);
  return Buffer.concat([h, pcm]);
}

const VOICES = { narrator: ["bm_fable", 0.92], kaede: ["af_heart", 1], masatora: ["bm_george", 0.9], kazemaru: ["am_puck", 1.05], kurogane: ["am_onyx", 0.82] };
const story = await import("../src/game/story.ts");
const lines = [];
const walk = (v) => (Array.isArray(v) ? v.forEach(walk) : v && typeof v === "object" ? (v.id && v.text ? lines.push(v) : Object.values(v).forEach(walk)) : 0);
walk(Object.values(story));
const uniq = [...new Map(lines.map((l) => [l.id, l])).values()];
console.log(uniq.length, "lines");
const out = new URL("../public/assets/voice/", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");
mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ channel: "chrome", headless: true });
const page = await browser.newPage();
page.on("console", (m) => m.type() === "error" && console.log("console:", m.text()));
await page.goto(process.env.RENDER_URL ?? "http://localhost:5420/");
await page.waitForFunction(() => window.ready, null, { timeout: 60000 });
console.log("voices:", await page.evaluate(() => window.load()));
const manifest = existsSync(`${out}manifest.json`) && !process.argv.includes("--all") ? JSON.parse(readFileSync(`${out}manifest.json`, "utf8")) : {};
for (const l of uniq) {
  if (manifest[l.id] && manifest[l.id].text === l.text && existsSync(`${out}${l.id}.wav`)) continue; // already rendered (pass --all to redo every line)
  const [v, speed] = VOICES[l.who];
  const b64 = await page.evaluate(([t, vo, sp]) => window.say(t, vo, sp), [l.text, v, speed]);
  const buf = toInt16Wav(Buffer.from(b64, "base64"));
  writeFileSync(`${out}${l.id}.wav`, buf);
  manifest[l.id] = { file: `${l.id}.wav`, text: l.text };
  console.log(l.id, v, buf.length);
}
writeFileSync(`${out}manifest.json`, JSON.stringify(manifest, null, 1));
await browser.close();
