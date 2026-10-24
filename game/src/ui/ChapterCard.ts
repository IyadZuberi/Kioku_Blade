/**
 * The chapter title card: a dark ink wash with the boss's name, shown for a couple of seconds
 * whenever a new general (and arena) is about to load. The swap happens while the card is opaque,
 * so any one-off hitch (new scenery, shaders) is never seen.
 */
import { LATIN_FONT } from "./brush";
import type { BossDef } from "../game/bosses";
import { ARENA_NAMES } from "./arenaNames";

const CSS = `
#chapter { position: fixed; inset: 0; z-index: 45; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 1.6vmin;
  background: radial-gradient(110% 90% at 50% 100%, rgba(80,40,34,0.96) 0%, rgba(13,12,16,0.99) 62%); color: #efe7da; opacity: 0; pointer-events: none; transition: opacity 0.45s ease; }
#chapter.on { opacity: 1; }
#chapter .num { font: 600 2.4vmin/1 ${LATIN_FONT}; letter-spacing: 0.5em; margin-right: -0.5em; color: #e1a58f; }
#chapter .name { margin: 0; font: 600 11vmin/1.05 ${LATIN_FONT}; letter-spacing: 0.08em; text-shadow: 0 0 3vmin rgba(0,0,0,0.6); }
#chapter .latin { margin: 0; font: 600 3.4vmin/1.1 ${LATIN_FONT}; letter-spacing: 0.3em; margin-right: -0.3em; }
#chapter .epi { margin: 0; font: italic 2.6vmin/1.3 ${LATIN_FONT}; color: #d9cdb9; }
#chapter .place { margin-top: 3vmin; font: 2vmin/1.4 ${LATIN_FONT}; color: #a99d89; max-width: 60ch; text-align: center; padding: 0 6vw; }
@media (prefers-reduced-motion: reduce) { #chapter { transition: none; } }
`;

const el = (tag: string, cls: string, parent: HTMLElement, text?: string): HTMLElement => {
  const e = document.createElement(tag);
  e.className = cls;
  if (text !== undefined) e.textContent = text;
  parent.appendChild(e);
  return e;
};

export class ChapterCard {
  private readonly box: HTMLElement;
  private timers: number[] = [];

  constructor(root: HTMLElement) {
    const style = document.createElement("style");
    style.textContent = CSS;
    document.head.appendChild(style);
    this.box = el("div", "", root);
    this.box.id = "chapter";
    this.box.setAttribute("aria-live", "polite");
  }

  /** `covered` runs while the card is fully opaque (swap the arena and boss there); `done` after it has faded out. */
  show(def: BossDef, covered: () => void, done: () => void, holdMs = 2300): void {
    for (const t of this.timers) clearTimeout(t);
    this.timers = [];
    this.box.replaceChildren();
    el("div", "num", this.box, `Chapter ${def.chapter}`);
    el("h2", "name", this.box, def.latin);
    el("p", "epi", this.box, def.epithet);
    el("p", "place", this.box, `${ARENA_NAMES[def.arena].name}. ${ARENA_NAMES[def.arena].line}`);
    void this.box.offsetWidth;
    this.box.classList.add("on");
    this.timers.push(
      window.setTimeout(covered, 520),
      window.setTimeout(() => this.box.classList.remove("on"), 520 + holdMs),
      window.setTimeout(done, 520 + holdMs + 480),
    );
  }
}
