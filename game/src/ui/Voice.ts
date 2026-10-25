/**
 * Character voices: real human-sounding speech from Kokoro (open-source neural TTS, Apache-2.0).
 *  - Every fixed story line is pre-rendered (tools/make-voices.mjs) into public/assets/voice/<line id>.wav.
 *  - Lines the model writes are spoken by the same voices, made by the local server (POST /api/voice, which
 *    runs server/voice/tts_server.py). If that is not running, those lines are subtitles only.
 * No robotic browser speech anywhere. Off when sound is muted or voices are turned off in Settings > Sound.
 */
import type { Speaker } from "../game/story";

const BASE = (import.meta as { env?: { BASE_URL?: string } }).env?.BASE_URL ?? "/";
const API = (import.meta as { env?: { VITE_API?: string } }).env?.VITE_API ?? "";
const KEY = "kioku.voice";
const GAIN = 1.8; // the renders peak near 0.5

export class Voice {
  /** Set by main: true while all sound is muted. */
  muted: () => boolean = () => false;
  private on = true;
  private vol = 0.9;
  private manifest: Record<string, { file: string }> | null = null;
  private ctx: AudioContext | null = null;
  private src: AudioBufferSourceNode | null = null;
  private made = new Map<string, Promise<AudioBuffer | null>>();
  private token = 0;

  constructor() {
    try {
      const s = JSON.parse(localStorage.getItem(KEY) ?? "null") as { on: boolean; vol: number } | null;
      if (s) {
        this.on = !!s.on;
        this.vol = Math.min(1, Math.max(0, s.vol));
      }
    } catch {
      /* storage blocked: defaults */
    }
    void fetch(`${BASE}assets/voice/manifest.json`)
      .then((r) => r.json())
      .then((m) => (this.manifest = m))
      .catch(() => {});
  }

  get enabled(): boolean {
    return this.on;
  }
  get volume(): number {
    return this.vol;
  }
  set(on: boolean, vol: number): void {
    this.on = on;
    this.vol = vol;
    if (!on) this.stop();
    try {
      localStorage.setItem(KEY, JSON.stringify({ on, vol }));
    } catch {
      /* storage blocked */
    }
  }

  private context(): AudioContext {
    return (this.ctx ??= new AudioContext());
  }

  /** Fetch (pre-rendered) or ask the server for (model-written) one line; cached, so a line prepared early plays at once. */
  private render(text: string, who: Speaker, id: string): Promise<AudioBuffer | null> {
    const key = id || `${who}|${text}`;
    let p = this.made.get(key);
    if (!p) {
      p = (async () => {
        const f = id && this.manifest?.[id]?.file;
        const r = f
          ? await fetch(`${BASE}assets/voice/${f}`)
          : await fetch(`${API}/api/voice`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ who, text }), signal: AbortSignal.timeout(30000) });
        if (r.status !== 200) return null; // 204: no voice server running
        return this.context().decodeAudioData(await r.arrayBuffer());
      })().catch(() => null);
      this.made.set(key, p);
    }
    return p;
  }

  /** Have a model-written line synthesized in the background, so it plays at once when he says it. */
  prefetch(text: string, who: Speaker): void {
    if (text && this.on) void this.render(text, who, "");
  }

  /** Speak one line; `end` runs when it finishes (or at once if there is no voice for it). Returns false when nothing will be spoken. */
  speak(text: string, who: Speaker, end?: () => void, id = ""): boolean {
    this.stop();
    if (!this.on || this.vol <= 0 || this.muted() || !text) return false;
    const me = ++this.token;
    void this.render(text, who, id).then((buf) => {
      if (me !== this.token) return;
      if (!buf) return end?.();
      const c = this.context();
      void c.resume();
      const s = c.createBufferSource();
      s.buffer = buf;
      const g = c.createGain();
      g.gain.value = this.vol * GAIN;
      s.connect(g).connect(c.destination);
      s.onended = () => me === this.token && end?.();
      this.src = s;
      s.start();
    });
    return true;
  }

  stop(): void {
    this.token++;
    try {
      this.src?.stop();
    } catch {
      /* already stopped */
    }
    this.src = null;
  }
}
