/**
 * Spoken voices for the characters, with the browser's own speech synthesis (free, offline, no
 * files shipped). Each speaker gets a pitch and pace; the lines are the subtitles, including the
 * ones the model writes. Off when sound is muted or the player turns voices off in Settings > Sound.
 */
import type { Speaker } from "../game/story";

/** pitch 0..2, rate 0.1..10 (1 = normal). Deep and slow for the shogun, quick and sharp for the spear fighter. */
const PROFILE: Record<Speaker, { pitch: number; rate: number; male: boolean }> = {
  narrator: { pitch: 0.75, rate: 0.9, male: true },
  kaede: { pitch: 1.05, rate: 1, male: false },
  masatora: { pitch: 0.6, rate: 0.85, male: true },
  kazemaru: { pitch: 1.0, rate: 1.08, male: true },
  kurogane: { pitch: 0.2, rate: 0.72, male: true },
};
const KEY = "kioku.voice";
const MALE = /david|mark|daniel|alex|james|george|google uk english male|male|fred|thomas|guy/i;
const FEMALE = /zira|susan|samantha|female|hazel|karen|victoria|fiona|moira/i;

export class Voice {
  /** Set by main: true while all sound is muted. */
  muted: () => boolean = () => false;
  private on = true;
  private vol = 0.9;
  private voices: SpeechSynthesisVoice[] = [];
  private readonly synth: SpeechSynthesis | null = typeof speechSynthesis === "undefined" ? null : speechSynthesis;
  private token = 0;

  constructor() {
    try {
      const s = JSON.parse(localStorage.getItem(KEY) ?? "null") as { on: boolean; vol: number } | null;
      if (s) (this.on = !!s.on), (this.vol = Math.min(1, Math.max(0, s.vol)));
    } catch {
      /* storage blocked: defaults */
    }
    const load = () => (this.voices = (this.synth?.getVoices() ?? []).filter((v) => /^en/i.test(v.lang)));
    load();
    this.synth?.addEventListener?.("voiceschanged", load);
  }

  get supported(): boolean {
    return !!this.synth;
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

  private pick(male: boolean): SpeechSynthesisVoice | undefined {
    const want = male ? MALE : FEMALE;
    const skip = male ? FEMALE : MALE;
    return this.voices.find((v) => want.test(v.name) && !skip.test(v.name)) ?? this.voices.find((v) => !skip.test(v.name)) ?? this.voices[0];
  }

  /** Speak one line. `end` runs when it finishes (or at once if there is no voice); returns false when nothing will be spoken. */
  speak(text: string, who: Speaker, end?: () => void): boolean {
    this.stop();
    if (!this.synth || !this.on || this.vol <= 0 || this.muted() || !text) return false;
    const p = PROFILE[who];
    const u = new SpeechSynthesisUtterance(text);
    const v = this.pick(p.male);
    if (v) u.voice = v;
    u.pitch = p.pitch;
    u.rate = p.rate;
    u.volume = this.vol;
    const me = ++this.token;
    const done = () => me === this.token && end?.();
    u.onend = done;
    u.onerror = done;
    this.synth.speak(u);
    return true;
  }

  stop(): void {
    this.token++;
    this.synth?.cancel();
  }
}
