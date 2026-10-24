/**
 * Spoken lines: the prologue (full screen, over ink) and the dialogue before and after each duel
 * (subtitles under the letterbox). A line plays its voice file when one exists and waits for it to
 * end; otherwise it stays up long enough to read. Enter / Space / click: next line; Esc: skip all.
 */
import { VOICED } from "../audio/voiceLines";
import { SPEAKER_NAME, type Line, type Speaker } from "../game/story";
import { LATIN_FONT } from "./brush";

const BASE = (import.meta as { env?: { BASE_URL?: string } }).env?.BASE_URL ?? "/";

const COLOR: Record<Speaker, string> = { narrator: "#efe7da", kaede: "#9fd0d8", masatora: "#e8b07a", kazemaru: "#8fc4cf", kurogane: "#e0786a" };

const CSS = `
#subs { position: fixed; left: 0; right: 0; bottom: 9vh; z-index: 44; display: flex; flex-direction: column; align-items: center; gap: 0.6vh; pointer-events: none;
  opacity: 0; transition: opacity 0.35s ease; font-family: ${LATIN_FONT}; text-align: center; padding: 0 8vw; }
#subs.on { opacity: 1; }
#subs .who { font: 600 2vmin/1 ${LATIN_FONT}; letter-spacing: 0.32em; text-transform: uppercase; }
#subs .text { font: 2.9vmin/1.4 ${LATIN_FONT}; color: #f4ede2; max-width: 62ch; text-shadow: 0 2px 8px rgba(0,0,0,0.95), 0 0 2px #000; }
#subs .skip { margin-top: 0.8vh; font: 1.5vmin/1 ${LATIN_FONT}; color: rgba(239,231,218,0.55); letter-spacing: 0.12em; }
#subs.prologue { inset: 0; bottom: 0; justify-content: center; background: radial-gradient(120% 90% at 50% 100%, rgba(70,30,24,0.96), rgba(9,8,11,0.995) 65%); gap: 2vh; }
#subs.prologue .text { font: italic 3.4vmin/1.55 ${LATIN_FONT}; color: #e9e0d2; }
#subs.prologue .text { animation: subIn 0.9s ease both; }
@keyframes subIn { from { opacity: 0; transform: translateY(0.8vh); } to { opacity: 1; transform: none; } }
#fincap { position: fixed; left: 0; right: 0; top: 16vh; z-index: 44; text-align: center; pointer-events: none; opacity: 0; font: italic 600 5.2vmin/1 ${LATIN_FONT};
  letter-spacing: 0.14em; color: #f4ede2; text-shadow: 0 0 2.4vmin rgba(160,20,10,0.8), 0 2px 6px #000; transition: opacity 0.5s ease, letter-spacing 2.4s ease; }
#fincap.on { opacity: 1; letter-spacing: 0.3em; }
@media (prefers-reduced-motion: reduce) { #subs, #subs.prologue .text { transition: none; animation: none; } }
`;

export class Subtitles {
  private readonly box: HTMLElement;
  private readonly who: HTMLElement;
  private readonly text: HTMLElement;
  private readonly cap: HTMLElement;
  private capTimer = 0;
  private lines: Line[] = [];
  private i = -1;
  private timer = 0;
  private audio: HTMLAudioElement | null = null;
  private done: (() => void) | null = null;
  /** Called with true while a voice is speaking (the game ducks the music). */
  onSpeaking: ((on: boolean) => void) | null = null;
  volume = 1;

  private readonly onKey = (e: KeyboardEvent): void => {
    if (!this.playing) return;
    if (e.code === "Escape") this.finish();
    else if (e.code === "Enter" || e.code === "Space" || e.code === "KeyE") this.advance();
    else return;
    e.preventDefault();
    e.stopImmediatePropagation();
  };
  private readonly onClick = (e: MouseEvent): void => {
    if (!this.playing) return;
    e.preventDefault();
    e.stopImmediatePropagation();
    if (e.type === "mousedown") this.advance();
  };

  constructor(root: HTMLElement) {
    const style = document.createElement("style");
    style.textContent = CSS;
    document.head.appendChild(style);
    this.box = document.createElement("div");
    this.box.id = "subs";
    this.box.setAttribute("aria-live", "polite");
    this.who = document.createElement("div");
    this.who.className = "who";
    this.text = document.createElement("div");
    this.text.className = "text";
    const skip = document.createElement("div");
    skip.className = "skip";
    skip.textContent = "Enter  next          Esc  skip";
    this.box.append(this.who, this.text, skip);
    root.appendChild(this.box);
    this.cap = document.createElement("div");
    this.cap.id = "fincap";
    root.appendChild(this.cap);
    window.addEventListener("keydown", this.onKey, true);
    window.addEventListener("mousedown", this.onClick, true);
    window.addEventListener("mouseup", this.onClick, true);
  }

  get playing(): boolean {
    return this.i >= 0;
  }

  /** Play `lines`; `done` runs after the last one (or a skip). `prologue`: full screen over ink. */
  play(lines: Line[], done: () => void, prologue = false): void {
    this.stop();
    if (!lines.length) return done();
    this.lines = lines;
    this.done = done;
    this.box.classList.toggle("prologue", prologue);
    this.box.classList.add("on");
    this.i = -1;
    this.advance();
  }

  private advance(): void {
    this.clearLine();
    this.i++;
    if (this.i >= this.lines.length) return this.finish();
    const l = this.lines[this.i];
    this.who.textContent = SPEAKER_NAME[l.who];
    this.who.style.color = COLOR[l.who];
    this.text.textContent = l.text;
    // restart the fade-in for the next line
    this.text.style.animation = "none";
    void this.text.offsetWidth;
    this.text.style.animation = "";
    const read = Math.max(2.4, l.text.length * 0.058 + 1.1) * 1000;
    if (VOICED.has(l.id) && this.volume > 0) {
      const a = new Audio(`${BASE}assets/voice/${l.id}.mp3`);
      a.volume = this.volume;
      this.audio = a;
      this.onSpeaking?.(true);
      a.addEventListener("ended", () => {
        if (this.audio === a) this.timer = window.setTimeout(() => this.advance(), 450);
      });
      a.play().catch(() => (this.timer = window.setTimeout(() => this.advance(), read)));
      // never hang on a file that does not report its end
      this.timer = window.setTimeout(() => this.advance(), read + 6000);
    } else this.timer = window.setTimeout(() => this.advance(), read);
  }

  private clearLine(): void {
    clearTimeout(this.timer);
    if (this.audio) {
      this.audio.pause();
      this.audio = null;
      this.onSpeaking?.(false);
    }
  }

  /** The finisher's name, large over the slow motion. */
  caption(text: string, ms = 2200): void {
    clearTimeout(this.capTimer);
    this.cap.textContent = text;
    this.cap.classList.remove("on");
    void this.cap.offsetWidth;
    this.cap.classList.add("on");
    this.capTimer = window.setTimeout(() => this.cap.classList.remove("on"), ms);
  }

  /** End now (skip): runs the pending `done`. */
  finish(): void {
    const d = this.done;
    this.stop();
    d?.();
  }

  /** End now without running `done` (the game moved on). */
  stop(): void {
    this.clearLine();
    this.i = -1;
    this.done = null;
    this.box.classList.remove("on");
  }
}
