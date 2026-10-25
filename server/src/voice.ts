import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { makeGate } from "./rateGate";

/** Each speaker's Kokoro voice and pace (kept in step with game/src/ui/Voice.ts and game/tools/make-voices.mjs). */
export const SPEAKERS: Record<string, { voice: string; speed: number }> = {
  narrator: { voice: "bm_fable", speed: 0.92 },
  kaede: { voice: "af_heart", speed: 1 },
  masatora: { voice: "bm_george", speed: 0.9 },
  kazemaru: { voice: "am_puck", speed: 1.05 },
  kurogane: { voice: "am_onyx", speed: 0.82 },
};

export type Say = (who: string, text: string) => Promise<Buffer | null>;

/**
 * Speech for the lines the model writes: the local Kokoro sidecar (server/voice/tts_server.py), cached on
 * disk by text so a repeated line costs nothing. Returns null when the sidecar is not running, so the
 * game just shows subtitles. Capped per minute: anyone on the network can post.
 */
export function makeSay(o: { url?: string; cacheDir?: string; perMinute?: number; fetchFn?: typeof fetch } = {}): Say {
  const url = o.url ?? process.env.TTS_URL ?? "http://127.0.0.1:8788/say";
  const dir = o.cacheDir ?? join(process.cwd(), "..", "data", "voice-cache");
  const f = o.fetchFn ?? fetch;
  const gate = makeGate(o.perMinute ?? 30);
  return async (who, text) => {
    const sp = SPEAKERS[who];
    const t = text.replace(/\s+/g, " ").trim().slice(0, 240);
    if (!sp || !t) return null;
    const file = join(dir, `${createHash("sha1").update(`${sp.voice}|${sp.speed}|${t}`).digest("hex")}.wav`);
    if (existsSync(file)) return readFileSync(file);
    if (gate()) return null;
    try {
      const r = await f(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ ...sp, text: t }), signal: AbortSignal.timeout(25000) });
      if (!r.ok) return null;
      const wav = Buffer.from(await r.arrayBuffer());
      mkdirSync(dir, { recursive: true });
      writeFileSync(file, wav);
      return wav;
    } catch {
      return null; // sidecar not running or too slow
    }
  };
}
