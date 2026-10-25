/**
 * The pause menu: Esc (or the Pause button in the corner) during a duel freezes the fight and opens it.
 * Resume, switch how you fight (keyboard and mouse, or your hands), the four volumes, the full controls and moves,
 * and the way back to the main menu, which forfeits the duel (it counts as a defeat and he learns from it).
 */
import { LATIN_FONT } from "./brush";

export interface PauseHooks {
  /** True while a duel is being fought (the only time the menu may open). */
  canPause: () => boolean;
  pause: () => void;
  resume: () => void;
  forfeit: () => void;
  hands: { on: () => boolean; toggle: () => Promise<void>; train: () => void };
  /** Volumes 0..1: master, music, effects (sound), and the voices. */
  volumes: { get: () => { master: number; music: number; sfx: number; voice: number; muted: boolean }; set: (v: { master: number; music: number; sfx: number; voice: number; muted: boolean }) => void };
  openControls: () => void;
}

const CSS = `
#pausechip { pointer-events: auto; position: fixed; right: 18px; top: 14px; z-index: 12; display: none; padding: 7px 14px 8px; border: 1px solid rgba(239,231,218,0.35); background: rgba(14,10,12,0.55); color: #e8dfd0; font: 13px ${LATIN_FONT}; letter-spacing: 0.08em; cursor: pointer; }
#pausechip.on { display: block; }
#pausechip kbd { margin-left: 8px; padding: 1px 6px; border: 1px solid rgba(239,231,218,0.4); border-radius: 3px; font: 11px ${LATIN_FONT}; color: #d9cdb9; }
#pausechip:hover { border-color: rgba(239,231,218,0.85); }
#pause { pointer-events: auto; position: fixed; inset: 0; z-index: 65; display: none; align-items: center; justify-content: center; background: rgba(8,6,9,0.72); font-family: ${LATIN_FONT}; color: #efe7da; }
#pause.on { display: flex; }
#pause .win { width: min(92vw, 460px); background: linear-gradient(180deg, #17121a 0%, #100d12 100%); border-top: 1px solid rgba(196,55,42,0.9); box-shadow: 0 24px 80px rgba(0,0,0,0.6); padding: 22px 26px 24px; }
#pause h2 { margin: 0 0 14px; font-size: 24px; font-weight: 600; letter-spacing: 0.06em; }
#pause button { display: block; width: 100%; margin-top: 8px; padding: 10px 14px; background: none; border: 1px solid rgba(239,231,218,0.3); color: #d9cdb9; font: 15px ${LATIN_FONT}; cursor: pointer; text-align: left; }
#pause button:hover { border-color: rgba(239,231,218,0.85); color: #fff; }
#pause button.primary { border-color: #c4372a; background: rgba(120,28,20,0.45); color: #fff3e4; }
#pause button.danger { border-color: rgba(196,55,42,0.55); color: #f0a094; }
#pause button.danger.sure { background: rgba(160,30,20,0.6); color: #fff; }
#pause .sec { margin-top: 16px; font-size: 12px; letter-spacing: 0.18em; text-transform: uppercase; color: #a99d89; }
#pause .seg { display: flex; gap: 8px; }
#pause .seg button { margin-top: 8px; text-align: center; }
#pause .seg button.on { border-color: #6fc7c0; color: #fff; background: rgba(111,199,192,0.14); }
#pause label.snd { display: grid; grid-template-columns: 78px 1fr 44px; gap: 10px; align-items: center; margin-top: 8px; font-size: 14px; color: #cfc4b0; }
#pause label.snd output { text-align: right; color: #a99d89; font-size: 13px; }
#pause label.snd input { width: 100%; accent-color: #c4372a; }
`;

export class PauseMenu {
  private readonly chip: HTMLButtonElement;
  private readonly root: HTMLElement;
  private readonly body: HTMLElement;
  private opened = false;
  private sure = false;
  private readonly onKey = (e: KeyboardEvent): void => {
    if (!this.opened || document.querySelector("#ctl.on, #poses.on, #dojo.on")) return; // the Settings or pose window above handles its own keys
    if (e.code === "Escape") {
      if (e.type === "keydown" && !e.repeat) this.close();
    }
    e.preventDefault();
    e.stopImmediatePropagation();
  };

  constructor(host: HTMLElement, private readonly h: PauseHooks) {
    const style = document.createElement("style");
    style.textContent = CSS;
    document.head.appendChild(style);
    this.chip = document.createElement("button");
    this.chip.id = "pausechip";
    this.chip.type = "button";
    this.chip.innerHTML = `Pause<kbd>Esc</kbd>`;
    this.chip.addEventListener("click", (e) => {
      e.stopPropagation();
      this.open();
    });
    this.chip.addEventListener("mousedown", (e) => e.stopPropagation());
    this.root = document.createElement("div");
    this.root.id = "pause";
    this.root.setAttribute("role", "dialog");
    this.root.setAttribute("aria-modal", "true");
    this.root.setAttribute("aria-label", "Paused");
    this.root.innerHTML = `<div class="win"><h2>Paused</h2><div data-body></div></div>`;
    this.body = this.root.querySelector("[data-body]") as HTMLElement;
    for (const t of ["mousedown", "mouseup"] as const) this.root.addEventListener(t, (e) => e.stopPropagation());
    host.append(this.chip, this.root);
    // Esc opens the menu during a duel (capture phase, before the game sees it)
    window.addEventListener(
      "keydown",
      (e) => {
        if (e.code === "Escape" && !e.repeat && !this.opened && this.h.canPause() && !document.querySelector("#ctl.on, #dojo.on, #poses.on")) {
          e.preventDefault();
          e.stopImmediatePropagation();
          this.open();
        }
      },
      true,
    );
    setInterval(() => this.chip.classList.toggle("on", !this.opened && this.h.canPause()), 250);
  }

  get isOpen(): boolean {
    return this.opened;
  }

  open(): void {
    if (this.opened || !this.h.canPause()) return;
    this.opened = true;
    this.sure = false;
    this.h.pause();
    if (document.pointerLockElement) document.exitPointerLock();
    window.addEventListener("keydown", this.onKey, true);
    window.addEventListener("keyup", this.onKey, true);
    this.root.classList.add("on");
    this.render();
  }

  close(): void {
    if (!this.opened) return;
    this.opened = false;
    this.root.classList.remove("on");
    window.removeEventListener("keydown", this.onKey, true);
    window.removeEventListener("keyup", this.onKey, true);
    this.h.resume();
  }

  private btn(label: string, cls: string, fn: () => void): HTMLButtonElement {
    const b = document.createElement("button");
    b.type = "button";
    b.className = cls;
    b.textContent = label;
    b.addEventListener("click", (e) => {
      e.stopPropagation();
      fn();
    });
    return b;
  }

  private render(): void {
    const b = this.body;
    b.replaceChildren();
    b.append(this.btn("Resume", "primary", () => this.close()));

    const sec = (t: string) => {
      const d = document.createElement("div");
      d.className = "sec";
      d.textContent = t;
      b.appendChild(d);
    };
    sec("How you fight");
    const seg = document.createElement("div");
    seg.className = "seg";
    const hands = this.h.hands.on();
    const kb = this.btn("Keyboard and mouse", hands ? "" : "on", () => void (hands ? this.h.hands.toggle().then(() => this.render()) : 0));
    const hd = this.btn("Hand poses", hands ? "on" : "", () => void (hands ? 0 : this.h.hands.toggle().then(() => this.render())));
    seg.append(kb, hd);
    b.appendChild(seg);
    if (hands) b.append(this.btn("Train my poses", "", () => this.h.hands.train()));

    sec("Volume");
    const v = this.h.volumes.get();
    for (const [key, label] of [["master", "Master"], ["music", "Music"], ["sfx", "Effects"], ["voice", "Voices"]] as const) {
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
        this.h.volumes.set({ ...this.h.volumes.get(), [key]: +input.value / 100 });
      });
      row.append(name, input, out);
      b.appendChild(row);
    }

    b.append(this.btn("Controls and moves", "", () => this.h.openControls()));

    sec("Leave");
    const leave = this.btn(this.sure ? "Really leave? This counts as a defeat." : "Main menu (forfeits this duel)", `danger${this.sure ? " sure" : ""}`, () => {
      if (!this.sure) {
        this.sure = true;
        this.render();
        return;
      }
      this.opened = false;
      this.root.classList.remove("on");
      window.removeEventListener("keydown", this.onKey, true);
      window.removeEventListener("keyup", this.onKey, true);
      this.h.resume();
      this.h.forfeit();
    });
    b.appendChild(leave);
  }
}
