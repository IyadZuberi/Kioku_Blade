/**
 * The Settings window: controls (keyboard and mouse, controller, hand poses), the moves list and
 * sound (volumes, mute), all listed from controlsData.ts. Opens from the chip on the title / end screens or with F1; Esc closes it. While
 * it is open every key and click stays inside it (the game never sees them).
 */
import { Voice } from "./Voice";
import { LATIN_FONT } from "./brush";
import { BOSS_MOVES_LIST, CONTROLS, PLAYER_MOVES, type ControlRow } from "./controlsData";

export interface SoundSettings {
  get(): { master: number; music: number; sfx: number; muted: boolean };
  set(v: { master: number; music: number; sfx: number; muted: boolean }): void;
}

type Tab = "keyboard" | "pad" | "hands" | "moves" | "sound";
const TABS: { id: Tab; label: string; blurb: string }[] = [
  { id: "keyboard", label: "Keyboard and mouse", blurb: "The default. Pointer lock hides the cursor in a duel." },
  { id: "pad", label: "Controller", blurb: "Plug in or pair any standard pad (Xbox, PlayStation, Switch Pro). It is picked up automatically." },
  { id: "hands", label: "Hands", blurb: "Webcam control. Press G to start. Your left hand walks, your right hand makes the poses you trained." },
  { id: "moves", label: "Moves", blurb: "What Kaede can do, and how each general fights and how to answer him." },
  { id: "sound", label: "Sound", blurb: "Volumes are remembered in this browser. M mutes at any time." },
];

const CSS = `
#ctl-chip { position: fixed; right: 18px; bottom: 16px; z-index: 12; padding: 8px 14px 9px; border: 1px solid rgba(239,231,218,0.35); background: rgba(14,10,12,0.55); color: #e8dfd0;
  font: 13px/1 ${LATIN_FONT}; letter-spacing: 0.1em; cursor: pointer; display: none; pointer-events: auto; }
#ctl-chip.on { display: block; }
#ctl-chip kbd { margin-left: 8px; padding: 1px 6px; border: 1px solid rgba(239,231,218,0.4); border-radius: 3px; font: 11px ${LATIN_FONT}; color: #d9cdb9; }
#ctl-chip:hover { border-color: rgba(239,231,218,0.85); }
#ctl { pointer-events: auto; position: fixed; inset: 0; z-index: 68; display: none; align-items: center; justify-content: center; background: rgba(8,6,9,0.78); }
#ctl.on { display: flex; }
#ctl .win { width: min(92vw, 880px); max-height: 88vh; display: flex; flex-direction: column; background: linear-gradient(180deg, #17121a 0%, #100d12 100%); color: #efe7da; font-family: ${LATIN_FONT};
  border-top: 1px solid rgba(196,55,42,0.9); box-shadow: 0 24px 80px rgba(0,0,0,0.6); }
#ctl header { display: flex; align-items: baseline; gap: 16px; padding: 20px 28px 0; }
#ctl h2 { margin: 0; font: 700 30px/1 ${LATIN_FONT}; }
#ctl h3 { margin: 18px 0 2px; font: 600 18px/1.3 ${LATIN_FONT}; color: #f1d9c4; }
#ctl .style { color: #a99d89; font-size: 13.5px; margin-bottom: 4px; }
#ctl .mrow { display: grid; grid-template-columns: minmax(140px, 1fr) minmax(150px, 1fr) minmax(0, 1.6fr); gap: 4px 16px; padding: 9px 0; border-bottom: 1px solid rgba(239,231,218,0.08); font-size: 14.5px; }
#ctl .mrow .how2 { color: #e1a58f; }
#ctl .mrow .tip2 { color: #a99d89; font-size: 13.5px; }
@media (max-width: 640px) { #ctl .mrow { grid-template-columns: 1fr; } }
#ctl .snd { display: grid; grid-template-columns: 120px 1fr 48px; gap: 16px; align-items: center; padding: 12px 0; font-size: 15px; }
#ctl .snd input[type=range] { width: 100%; accent-color: #c4372a; }
#ctl .snd output { color: #a99d89; text-align: right; }
#ctl label.mute { display: flex; gap: 10px; align-items: center; padding: 14px 0; font-size: 15px; cursor: pointer; }
#ctl label.mute input { width: 18px; height: 18px; accent-color: #c4372a; }
#ctl header span { color: #a99d89; font-size: 14px; }
#ctl header button { margin-left: auto; align-self: center; background: none; border: 1px solid rgba(239,231,218,0.3); color: #d9cdb9; font: 13px ${LATIN_FONT}; padding: 6px 12px; cursor: pointer; }
#ctl header button:hover { border-color: rgba(239,231,218,0.8); }
#ctl nav { display: flex; gap: 4px; padding: 16px 28px 0; border-bottom: 1px solid rgba(239,231,218,0.12); }
#ctl nav button { background: none; border: 0; border-bottom: 2px solid transparent; color: #a99d89; font: 15px ${LATIN_FONT}; padding: 8px 14px 10px; cursor: pointer; }
#ctl nav button[aria-selected="true"] { color: #fff3e4; border-bottom-color: #c4372a; }
#ctl nav button:hover { color: #efe7da; }
#ctl .blurb { padding: 14px 28px 4px; color: #a99d89; font-size: 14px; line-height: 1.5; }
#ctl .practice { margin: 10px 0 4px; padding: 9px 16px; border: 1px solid #c4372a; background: rgba(120,28,20,0.45); color: #fff3e4; font: 14px ${LATIN_FONT}; cursor: pointer; }
#ctl .practice:hover { background: rgba(150,36,26,0.6); }
#ctl .rows { overflow: auto; padding: 6px 28px 24px; }
#ctl .row { display: grid; grid-template-columns: 54px minmax(150px, 1fr) minmax(0, 1.25fr); gap: 4px 18px; padding: 13px 0; border-bottom: 1px solid rgba(239,231,218,0.08); align-items: start; }
#ctl .row:last-child { border-bottom: 0; }
#ctl .ico { width: 44px; height: 44px; color: #e1a58f; }
#ctl .name { font-size: 17px; line-height: 1.25; }
#ctl .tip { grid-column: 2 / 4; color: #a99d89; font-size: 13.5px; line-height: 1.5; max-width: 62ch; }
#ctl .how { display: flex; flex-wrap: wrap; gap: 6px; justify-content: flex-start; align-items: center; }
#ctl .cap { padding: 3px 9px 4px; border: 1px solid rgba(239,231,218,0.35); border-bottom-width: 2px; border-radius: 4px; background: rgba(239,231,218,0.06); font-size: 13.5px; white-space: nowrap; }
#ctl .cap.words { border-style: dashed; background: none; white-space: normal; }
@media (max-width: 640px) { #ctl .row { grid-template-columns: 44px 1fr; } #ctl .how, #ctl .tip { grid-column: 2; } }
@media (prefers-reduced-motion: no-preference) { #ctl.on .win { animation: ctl-in 0.18s ease-out; } @keyframes ctl-in { from { opacity: 0; transform: translateY(6px); } } }
`;

/** Small line pictograms: a stick with arrows, a fist, a swipe. */
const ICON = {
  stick: `<svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="24" cy="24" r="6"/><path d="M24 4v8M20 8l4-4 4 4M24 44v-8M20 40l4 4 4-4M4 24h8M8 20l-4 4 4 4M44 24h-8M40 20l4 4-4 4"/></svg>`,
  fist: `<svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 22v-5a3 3 0 016 0v-2a3 3 0 016 0v1a3 3 0 016 0v3a3 3 0 016 0v10c0 7-5 12-12 12h-3c-6 0-9-4-11-9l-3-7a3 3 0 015-3z"/></svg>`,
  swipe: `<svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 24h30M28 15l9 9-9 9M6 14h14M6 34h14"/></svg>`,
  down: `<svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M24 6v30M15 28l9 9 9-9M14 6h20"/></svg>`,
  up: `<svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M24 42V12M15 20l9-9 9 9M14 42h20"/></svg>`,
  key: `<svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="8" y="12" width="32" height="24" rx="4"/><path d="M16 28h16"/></svg>`,
  pad: `<svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 14h20c5 0 8 5 9 12l1 8c0 3-3 5-6 3l-6-5H16l-6 5c-3 2-6 0-6-3l1-8c1-7 4-12 9-12z"/><path d="M15 21v6M12 24h6"/><circle cx="32" cy="21" r="1.5"/><circle cx="35" cy="25" r="1.5"/></svg>`,
};

function iconFor(tab: Tab, r: ControlRow): string {
  if (tab === "hands") {
    if (r.actions.includes("move")) return ICON.stick;
    if (r.actions.includes("block")) return ICON.fist;
    if (r.actions.includes("attack")) return ICON.swipe;
    if (r.actions.includes("dodge")) return ICON.down;
    if (r.actions.includes("jump")) return ICON.up;
    return ICON.fist;
  }
  if (r.actions.includes("move")) return ICON.stick;
  return tab === "pad" ? ICON.pad : ICON.key;
}

export class ControlsPanel {
  private readonly chip: HTMLButtonElement;
  private readonly root: HTMLElement;
  private readonly rows: HTMLElement;
  private readonly blurb: HTMLElement;
  private readonly tabs = new Map<Tab, HTMLButtonElement>();
  private tab: Tab = "keyboard";
  /** Set by main: the game's audio volumes. */
  sound: SoundSettings | null = null;
  /** Spoken voices (Settings > Sound). */
  voice: Voice | null = null;
  private opened = false;
  /** Set by main: opens the hand-training window. */
  onPractice: () => void = () => {};
  private onKey = (e: KeyboardEvent): void => {
    // While open, nothing reaches the game; Esc and F1 close, Tab / arrows move between tabs.
    if (e.code === "Escape" || e.code === "F1") this.close();
    else if (e.code === "ArrowRight" || e.code === "ArrowLeft") {
      const ids = TABS.map((t) => t.id);
      this.select(ids[(ids.indexOf(this.tab) + (e.code === "ArrowRight" ? 1 : ids.length - 1)) % ids.length]);
    } else if (e.code === "Tab") return; // let focus move
    e.preventDefault();
    e.stopImmediatePropagation();
  };

  constructor(host: HTMLElement, private readonly canOpen: () => boolean) {
    const style = document.createElement("style");
    style.textContent = CSS;
    document.head.appendChild(style);

    this.chip = document.createElement("button");
    this.chip.id = "ctl-chip";
    this.chip.type = "button";
    this.chip.innerHTML = `Settings<kbd>F1</kbd>`;
    host.appendChild(this.chip);
    for (const t of ["mousedown", "mouseup"] as const) this.chip.addEventListener(t, (e) => e.stopPropagation());
    this.chip.addEventListener("click", (e) => {
      e.stopPropagation();
      this.open();
    });

    this.root = document.createElement("div");
    this.root.id = "ctl";
    this.root.setAttribute("role", "dialog");
    this.root.setAttribute("aria-modal", "true");
    this.root.setAttribute("aria-label", "Settings");
    this.root.innerHTML = `<div class="win"><header><h2>Settings</h2><span>Controls, moves and sound</span><button type="button" data-close>Close <kbd>Esc</kbd></button></header><nav role="tablist"></nav><div class="blurb"></div><div class="rows"></div></div>`;
    host.appendChild(this.root);
    const nav = this.root.querySelector("nav") as HTMLElement;
    this.blurb = this.root.querySelector(".blurb") as HTMLElement;
    this.rows = this.root.querySelector(".rows") as HTMLElement;
    for (const t of TABS) {
      const b = document.createElement("button");
      b.type = "button";
      b.role = "tab";
      b.textContent = t.label;
      b.addEventListener("click", () => this.select(t.id));
      nav.appendChild(b);
      this.tabs.set(t.id, b);
    }
    this.root.addEventListener("mousedown", (e) => e.stopPropagation());
    this.root.addEventListener("mouseup", (e) => e.stopPropagation());
    this.root.addEventListener("click", (e) => {
      e.stopPropagation();
      if (e.target === this.root || (e.target as HTMLElement).closest("[data-close]")) this.close();
    });
    window.addEventListener("keydown", (e) => {
      if (e.code === "F1" && !e.repeat) {
        e.preventDefault();
        if (this.opened) this.close();
        else if (this.canOpen()) this.open();
      }
    });
    this.render();
  }

  /** Show the corner chip (title and end screens only). */
  showChip(on: boolean): void {
    this.chip.classList.toggle("on", on && !this.opened);
  }

  open(): void {
    if (this.opened) return;
    this.opened = true;
    this.root.classList.add("on");
    this.chip.classList.remove("on");
    window.addEventListener("keydown", this.onKey, true);
    window.addEventListener("keyup", this.onKey, true);
    (this.tabs.get(this.tab) as HTMLElement).focus();
  }

  close(): void {
    if (!this.opened) return;
    this.opened = false;
    this.root.classList.remove("on");
    window.removeEventListener("keydown", this.onKey, true);
    window.removeEventListener("keyup", this.onKey, true);
    this.chip.classList.add("on");
  }

  get isOpen(): boolean {
    return this.opened;
  }

  /** Jump to a tab (the gesture start-up shows the hands tab). */
  select(t: Tab): void {
    this.tab = t;
    this.render();
  }

  private render(): void {
    for (const [id, b] of this.tabs) b.setAttribute("aria-selected", String(id === this.tab));
    this.blurb.textContent = TABS.find((t) => t.id === this.tab)!.blurb;
    this.rows.replaceChildren();
    if (this.tab === "moves") return this.renderMoves();
    if (this.tab === "sound") return this.renderSound();
    if (this.tab === "hands") {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "practice";
      b.textContent = "Train my poses";
      b.addEventListener("click", () => {
        this.close();
        this.onPractice();
      });
      this.rows.appendChild(b);
    }
    for (const r of CONTROLS[this.tab]) {
      const row = document.createElement("div");
      row.className = "row";
      const ico = document.createElement("div");
      ico.className = "ico";
      ico.innerHTML = iconFor(this.tab, r);
      const name = document.createElement("div");
      name.className = "name";
      name.textContent = r.name;
      const how = document.createElement("div");
      how.className = "how";
      for (const h of r.how) {
        const c = document.createElement("span");
        c.className = `cap${h.length > 22 ? " words" : ""}`;
        c.textContent = h;
        how.appendChild(c);
      }
      const tip = document.createElement("div");
      tip.className = "tip";
      tip.textContent = r.tip;
      row.append(ico, name, how, tip);
      this.rows.appendChild(row);
    }
  }

  private mrow(m: { name: string; how: string; tip: string }): HTMLElement {
    const r = document.createElement("div");
    r.className = "mrow";
    for (const [cls, t] of [["", m.name], ["how2", m.how], ["tip2", m.tip]]) {
      const d = document.createElement("div");
      if (cls) d.className = cls;
      d.textContent = t;
      r.appendChild(d);
    }
    return r;
  }

  private renderMoves(): void {
    const h = (t: string) => {
      const e = document.createElement("h3");
      e.textContent = t;
      this.rows.appendChild(e);
    };
    h("Kaede");
    for (const m of PLAYER_MOVES) this.rows.appendChild(this.mrow(m));
    for (const b of BOSS_MOVES_LIST) {
      h(b.boss);
      const s = document.createElement("div");
      s.className = "style";
      s.textContent = b.style;
      this.rows.appendChild(s);
      for (const m of b.moves) this.rows.appendChild(this.mrow(m));
    }
  }

  private renderSound(): void {
    const s = this.sound;
    if (!s) return;
    const v = s.get();
    for (const [key, label] of [["master", "Master"], ["music", "Music"], ["sfx", "Effects"]] as const) {
      const row = document.createElement("label");
      row.className = "snd";
      const name = document.createElement("span");
      name.textContent = label;
      const input = document.createElement("input");
      input.type = "range";
      input.min = "0";
      input.max = "100";
      input.value = String(Math.round(v[key] * 100));
      input.setAttribute("aria-label", `${label} volume`);
      const out = document.createElement("output");
      out.textContent = `${input.value}%`;
      input.addEventListener("input", () => {
        out.textContent = `${input.value}%`;
        s.set({ ...s.get(), [key]: +input.value / 100 });
      });
      row.append(name, input, out);
      this.rows.appendChild(row);
    }
    const mute = document.createElement("label");
    mute.className = "mute";
    const box = document.createElement("input");
    box.type = "checkbox";
    box.checked = v.muted;
    box.addEventListener("change", () => s.set({ ...s.get(), muted: box.checked }));
    mute.append(box, document.createTextNode("Mute everything (M)"));
    this.rows.appendChild(mute);
    const vc = this.voice;
    if (vc) {
      const row = document.createElement("label");
      row.className = "snd";
      const name = document.createElement("span");
      name.textContent = "Voices";
      const input = document.createElement("input");
      input.type = "range";
      input.min = "0";
      input.max = "100";
      input.value = String(vc.enabled ? Math.round(vc.volume * 100) : 0);
      input.setAttribute("aria-label", "Voices volume");
      const out = document.createElement("output");
      out.textContent = `${input.value}%`;
      input.addEventListener("input", () => {
        out.textContent = `${input.value}%`;
        vc.set(+input.value > 0, +input.value / 100);
      });
      input.addEventListener("change", () => vc.speak("My memory ends here.", "masatora", undefined, "f1-1"));
      row.append(name, input, out);
      this.rows.appendChild(row);
    }
  }
}
