/**
 * The Council: what the general learned about you, between fights. Plain DOM text (textContent
 * only), in the base's ink palette. Also the title extras: nickname field and the crowd banner.
 */
import type { HabitScore } from "@gr/shared";
import { LATIN_FONT } from "./brush";
import { formatIntel, habitBars, HABIT_LABEL, highMoves, sourceLine } from "./councilText";
import { getNickname, setNickname, type PlanResult } from "../learn/session";
import { BOSSES } from "../game/bosses";
import type { Progress } from "../game/progress";
import { BOSS_IDS, type BossId } from "@gr/shared";

const CSS = `
#council { position: absolute; left: 50%; top: 54vh; transform: translateX(-50%); width: min(80vw, 840px); box-sizing: border-box;
  padding: 18px 26px 14px; background: linear-gradient(90deg, rgba(14,10,12,0.78), rgba(14,10,12,0.55)); border-top: 1px solid rgba(179,38,26,0.85);
  color: #efe7da; font-family: ${LATIN_FONT}; opacity: 0; transition: opacity 0.5s ease; pointer-events: none; }
#council.on { opacity: 1; }
#council .c-head { display: flex; justify-content: space-between; align-items: baseline; letter-spacing: 0.28em; font-size: 12px; text-transform: uppercase; color: #cdbfa9; }
#council .c-line { margin-top: 8px; font-size: 19px; line-height: 1.3; }
#council .c-next { margin-top: 10px; font-size: 14px; letter-spacing: 0.12em; text-transform: uppercase; color: #e7b9a8; }
#council .c-taunt { margin-top: 8px; font-size: 16px; font-style: italic; color: #d8cdbb; }
#council .c-bars { margin-top: 10px; display: grid; grid-template-columns: 150px 1fr; gap: 3px 12px; font-size: 12px; color: #bfb29c; }
#council .bar { position: relative; height: 5px; background: rgba(255,255,255,0.08); align-self: center; }
#council .bar i { position: absolute; left: 0; top: 0; bottom: 0; }
#council .bar .p { background: rgba(200,190,170,0.45); height: 2px; top: 0; bottom: auto; }
#council .bar .n { background: #b3261a; height: 3px; top: 2px; bottom: auto; }
#council .c-src { margin-top: 10px; font-size: 11px; letter-spacing: 0.08em; color: #8f8472; }
#council .dots::after { content: ""; animation: cdots 1.2s steps(4) infinite; }
@keyframes cdots { 0% { content: ""; } 25% { content: "."; } 50% { content: ".."; } 75% { content: "..."; } }
#gr-title { position: absolute; top: 3.2vh; left: 0; right: 0; text-align: center; font-family: ${LATIN_FONT}; color: #e8dfd0; letter-spacing: 0.2em; font-size: 13px; text-transform: uppercase; opacity: 0; transition: opacity 0.6s ease; }
#gr-title.on { opacity: 1; }
#gr-title::before { content: ""; position: absolute; inset: -3.2vh 0 -2vh 0; z-index: -1; background: linear-gradient(180deg, rgba(12,9,12,0.72) 0%, rgba(12,9,12,0.5) 70%, rgba(12,9,12,0) 100%); }
#gr-title { z-index: 2; text-shadow: 0 1px 6px rgba(0,0,0,0.85); }
#gr-title .nick { pointer-events: auto; margin-top: 8px; }
#gr-title .chapters { display: flex; justify-content: center; gap: 10px; margin-top: 12px; pointer-events: auto; flex-wrap: wrap; padding: 0 12px; }
#gr-title .chip { cursor: pointer; padding: 7px 16px 8px; border: 1px solid rgba(239,231,218,0.28); background: rgba(14,10,12,0.45); color: #d9cdb9; letter-spacing: 0.14em; font-size: 12px; text-transform: none; transition: border-color 0.2s, background 0.2s; }
#gr-title .chip b { color: #e1a58f; font-weight: 600; margin-right: 8px; letter-spacing: 0.2em; }
#gr-title .chip:hover:not(.locked) { border-color: rgba(239,231,218,0.7); }
#gr-title .chip.cur { border-color: #c4372a; background: rgba(60,18,14,0.6); color: #fff3e4; }
#gr-title .chip.locked { cursor: default; opacity: 0.45; }
#gr-title .streak { margin-top: 8px; font-size: 12px; letter-spacing: 0.12em; color: #cdbfa9; text-transform: none; }
#gr-title input { background: transparent; border: 0; border-bottom: 1px solid #8f8472; color: #efe7da; font: inherit; letter-spacing: 0.12em; text-align: center; width: 190px; outline: none; text-transform: none; }
#gr-title input:focus { border-bottom-color: #b3261a; }
`;

const el = <K extends keyof HTMLElementTagNameMap>(tag: K, cls: string, parent?: HTMLElement, text?: string): HTMLElementTagNameMap[K] => {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text !== undefined) e.textContent = text;
  parent?.appendChild(e);
  return e;
};

export class Council {
  private readonly box: HTMLElement;
  private readonly title: HTMLElement;
  private readonly bannerEl: HTMLElement;
  private readonly chaptersEl: HTMLElement;
  private readonly streakEl: HTMLElement;

  constructor(root: HTMLElement) {
    const style = document.createElement("style");
    style.textContent = CSS;
    document.head.appendChild(style);
    this.box = el("div", "", root);
    this.box.id = "council";
    this.title = el("div", "", root);
    this.title.id = "gr-title";
    this.bannerEl = el("div", "", this.title);
    this.chaptersEl = el("div", "chapters", this.title);
    this.streakEl = el("div", "streak", this.title);
    // chips must never start the fight the way an ordinary click would
    for (const t of ["mousedown", "mouseup", "click"]) this.chaptersEl.addEventListener(t, (e) => e.stopPropagation());
    const nick = el("div", "nick", this.title);
    const input = el("input", "", nick);
    input.maxLength = 20;
    input.placeholder = "your name";
    input.value = getNickname();
    // The base starts a fight on any key or click: keep typing and clicking here to ourselves.
    for (const t of ["keydown", "keyup", "mousedown", "mouseup", "click"]) input.addEventListener(t, (e) => e.stopPropagation());
    input.addEventListener("input", () => setNickname(input.value.trim() || "Wanderer"));
    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === "Escape") input.blur();
    });
  }

  /** Title screen extras (banner, name field) on or off. */
  titleMode(on: boolean): void {
    this.title.classList.toggle("on", on);
  }

  /** Chapter chips on the title: unlocked ones can be picked, locked ones say what unlocks them. */
  setChapters(p: Progress, pick: (b: BossId) => void): void {
    this.chaptersEl.replaceChildren();
    for (const id of BOSS_IDS) {
      const d = BOSSES[id];
      const locked = id > p.unlocked;
      const chip = el("div", `chip${id === p.boss ? " cur" : ""}${locked ? " locked" : ""}`, this.chaptersEl);
      el("b", "", chip, d.chapter);
      chip.append(document.createTextNode(d.latin));
      if (locked) chip.title = `Beat ${BOSSES[(id - 1) as BossId].latin} ${BOSSES[(id - 1) as BossId].gate} times in a row to unlock`;
      else chip.addEventListener("click", () => pick(id));
    }
    const d = BOSSES[p.boss];
    this.streakEl.textContent = d.gate > 0 ? `Win streak ${p.streak} of ${d.gate} against ${d.latin}. A defeat resets it.` : p.cleared ? `You have beaten every general. Streak ${p.streak}.` : `The last duel. A defeat resets nothing here, but he remembers.`;
  }

  banner(text: string): void {
    this.bannerEl.textContent = text;
  }

  hide(): void {
    this.box.classList.remove("on");
  }

  /** A short host-only message under the council text (rule learned, etc.). */
  flash(text: string): void {
    const f = el("div", "c-src", this.box, text);
    f.style.color = "#e7b9a8";
    setTimeout(() => f.remove(), 6000);
  }

  /** The call is in flight: say so, never block. */
  thinking(): void {
    this.box.replaceChildren();
    const head = el("div", "c-head", this.box);
    el("span", "", head, "The General's council");
    const l = el("div", "c-line", this.box, "He is studying you");
    el("span", "dots", l);
    this.box.classList.add("on");
  }

  show(r: PlanResult, prev: HabitScore[], learned = ""): void {
    const b = this.box;
    b.replaceChildren();
    const head = el("div", "c-head", b);
    el("span", "", head, "The General's council");
    el("span", "", head, `Boss level ${r.bossLevel}${r.grudge ? ` · Grudge ${r.grudge}` : ""}`);
    for (const line of formatIntel(r.plan, r.intelLines)) el("div", "c-line", b, line);
    const moves = highMoves(r.plan);
    const opening = r.plan.opening_strings[0];
    if (moves.length || opening?.length) {
      const parts: string[] = [];
      if (moves.length) parts.push(`He favours ${moves.join(" · ")}`);
      if (opening?.length) parts.push(`opens ${opening.join(" → ")}`);
      el("div", "c-next", b, parts.join("  —  "));
    }
    if (learned) el("div", "c-next", b, learned);
    if (r.dossier) el("div", "c-line", b, `His notes on you: ${r.dossier}`);
    if (r.plan.taunt) el("div", "c-taunt", b, `“${r.plan.taunt}”`);
    const bars = habitBars(prev, r.habits);
    if (bars.length) {
      const g = el("div", "c-bars", b);
      for (const x of bars) {
        el("div", "", g, HABIT_LABEL[x.habit]);
        const bar = el("div", "bar", g);
        el("i", "p", bar).style.width = `${Math.round(x.prev * 100)}%`;
        el("i", "n", bar).style.width = `${Math.round(x.now * 100)}%`;
      }
    }
    el("div", "c-src", b, sourceLine(r));
    b.classList.add("on");
  }
}
