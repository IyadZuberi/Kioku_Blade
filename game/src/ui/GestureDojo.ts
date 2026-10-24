/**
 * Hand Training: a window that shows the camera with each hand labelled (left = move, right =
 * fight), a live stick and swipe-speed meter, and a checklist that ticks off every gesture as it is
 * recognised. While it is open the hands drive nothing in the game (GestureHandle.hold).
 */
import { LATIN_FONT } from "./brush";
import type { GestureFrame, GestureHandle } from "../input/gestures";
import { GESTURE } from "../input/gestureLogic";
import { LESSONS, LessonTracker, type LessonId } from "../input/lessons";

const W = 420;
const H = 315;
const BONES: [number, number][] = [[0, 1], [1, 2], [2, 3], [3, 4], [0, 5], [5, 6], [6, 7], [7, 8], [5, 9], [9, 10], [10, 11], [11, 12], [9, 13], [13, 14], [14, 15], [15, 16], [13, 17], [17, 18], [18, 19], [19, 20], [0, 17]];
const MOVE = "#6fc7c0";
const FIGHT = "#ef6a52";

const CSS = `
#dojo { position: fixed; inset: 0; z-index: 60; display: none; align-items: center; justify-content: center; background: rgba(8,6,9,0.82); font-family: ${LATIN_FONT}; color: #efe7da; pointer-events: auto; }
#dojo.on { display: flex; }
#dojo .win { width: min(94vw, 960px); max-height: 92vh; overflow: auto; background: linear-gradient(180deg, #17121a 0%, #100d12 100%); border-top: 1px solid rgba(196,55,42,0.9); box-shadow: 0 24px 80px rgba(0,0,0,0.6); padding: 20px 26px 22px; }
#dojo header { display: flex; align-items: baseline; gap: 14px; }
#dojo h2 { margin: 0; font-size: 26px; font-weight: 600; }
#dojo header span { color: #a99d89; font-size: 14px; }
#dojo header button { margin-left: auto; align-self: center; }
#dojo button { background: none; border: 1px solid rgba(239,231,218,0.3); color: #d9cdb9; font: 13px ${LATIN_FONT}; padding: 7px 14px; cursor: pointer; }
#dojo button:hover { border-color: rgba(239,231,218,0.85); color: #fff; }
#dojo button.primary { border-color: #c4372a; background: rgba(120,28,20,0.45); color: #fff3e4; }
#dojo .body { display: grid; grid-template-columns: ${W}px minmax(260px, 1fr); gap: 22px; margin-top: 16px; }
@media (max-width: 860px) { #dojo .body { grid-template-columns: 1fr; } }
#dojo canvas { width: 100%; max-width: ${W}px; aspect-ratio: ${W} / ${H}; background: #0b090c; border: 1px solid rgba(239,231,218,0.25); display: block; }
#dojo .gauges { display: grid; grid-template-columns: 96px 1fr; gap: 14px; margin-top: 12px; align-items: center; max-width: ${W}px; }
#dojo .stick { position: relative; width: 96px; height: 96px; border: 1px solid rgba(239,231,218,0.3); border-radius: 50%; background: radial-gradient(circle, rgba(111,199,192,0.12), transparent 70%); }
#dojo .stick i { position: absolute; width: 14px; height: 14px; margin: -7px 0 0 -7px; border-radius: 50%; background: ${MOVE}; left: 50%; top: 50%; }
#dojo .stick b { position: absolute; left: 50%; top: 50%; width: 1px; height: 100%; background: rgba(239,231,218,0.12); transform: translate(-50%, -50%); }
#dojo .stick b + b { width: 100%; height: 1px; }
#dojo .meter { font-size: 12.5px; color: #a99d89; }
#dojo .meter .bar { position: relative; height: 10px; margin: 6px 0 8px; background: rgba(239,231,218,0.1); }
#dojo .meter .bar i { position: absolute; left: 0; top: 0; bottom: 0; background: ${FIGHT}; width: 0; }
#dojo .meter .bar u { position: absolute; top: -3px; bottom: -3px; width: 2px; background: #efe7da; }
#dojo .meter .tag { display: flex; justify-content: space-between; }
#dojo .list { display: flex; flex-direction: column; gap: 6px; }
#dojo .item { display: grid; grid-template-columns: 26px 1fr; gap: 2px 12px; padding: 9px 12px; border: 1px solid rgba(239,231,218,0.12); opacity: 0.55; }
#dojo .item .dot { width: 20px; height: 20px; border-radius: 50%; border: 1.5px solid rgba(239,231,218,0.45); display: grid; place-items: center; font-size: 13px; }
#dojo .item.cur { opacity: 1; border-color: rgba(196,55,42,0.8); background: rgba(60,18,14,0.35); }
#dojo .item.done { opacity: 1; border-color: rgba(111,199,192,0.45); }
#dojo .item.done .dot { background: ${MOVE}; border-color: ${MOVE}; color: #0b0d0d; }
#dojo .item .t { font-size: 16px; }
#dojo .item .t em { font-style: normal; font-size: 11.5px; letter-spacing: 0.08em; margin-left: 8px; color: #a99d89; }
#dojo .item .h { grid-column: 2; font-size: 13.5px; line-height: 1.45; color: #b6aa95; display: none; }
#dojo .item.cur .h { display: block; }
#dojo .foot { display: flex; align-items: center; gap: 12px; margin-top: 16px; }
#dojo .foot .msg { color: #a99d89; font-size: 14px; }
#dojo .foot .msg.ok { color: ${MOVE}; }
#dojo .foot button { margin-left: auto; }
#dojo .foot button + button { margin-left: 0; }
#dojo .hint { margin-top: 10px; font-size: 12.5px; color: #8f8472; max-width: ${W}px; line-height: 1.5; }
`;

export class GestureDojo {
  private readonly root: HTMLElement;
  private readonly canvas: HTMLCanvasElement;
  private readonly ctx: CanvasRenderingContext2D;
  private readonly stick: HTMLElement;
  private readonly bar: HTMLElement;
  private readonly speedTxt: HTMLElement;
  private readonly items = new Map<LessonId, HTMLElement>();
  private readonly msg: HTMLElement;
  private readonly lessons = new LessonTracker();
  private handle: GestureHandle | null = null;
  private off: (() => void) | null = null;
  private opened = false;
  private onKey = (e: KeyboardEvent): void => {
    if (e.code === "Escape") this.close();
    if (e.code !== "Tab") {
      e.preventDefault();
      e.stopImmediatePropagation();
    }
  };

  constructor(host: HTMLElement) {
    const style = document.createElement("style");
    style.textContent = CSS;
    document.head.appendChild(style);
    this.root = document.createElement("div");
    this.root.id = "dojo";
    this.root.setAttribute("role", "dialog");
    this.root.setAttribute("aria-modal", "true");
    this.root.setAttribute("aria-label", "Hand training");
    this.root.innerHTML = `<div class="win">
      <header><h2>Hand training</h2><span>Learn what each hand does. Nothing you do here reaches the game.</span><button type="button" data-skip>Skip</button></header>
      <div class="body">
        <div>
          <canvas width="${W}" height="${H}"></canvas>
          <div class="gauges">
            <div class="stick"><b></b><b></b><i></i></div>
            <div class="meter"><div class="tag"><span>Right hand speed</span><span data-speed>0.0</span></div><div class="bar"><i></i><u></u></div><div>Swipe past the white line to strike, step or jump.</div></div>
          </div>
          <div class="hint">Left half of the picture is your <b style="color:${MOVE}">left hand: move</b>. Right half is your <b style="color:${FIGHT}">right hand: fight</b>. Sit about an arm's length from the camera in even light.</div>
        </div>
        <div class="list"></div>
      </div>
      <div class="foot"><span class="msg"></span><button type="button" data-reset>Start over</button><button type="button" class="primary" data-done>Skip</button></div>
    </div>`;
    host.appendChild(this.root);
    this.canvas = this.root.querySelector("canvas") as HTMLCanvasElement;
    this.ctx = this.canvas.getContext("2d")!;
    this.stick = this.root.querySelector(".stick i") as HTMLElement;
    this.bar = this.root.querySelector(".bar i") as HTMLElement;
    this.speedTxt = this.root.querySelector("[data-speed]") as HTMLElement;
    this.msg = this.root.querySelector(".msg") as HTMLElement;
    (this.root.querySelector(".bar u") as HTMLElement).style.left = `${Math.min(100, (GESTURE.swipeSpeed / 12) * 100)}%`;
    const list = this.root.querySelector(".list") as HTMLElement;
    for (const l of LESSONS) {
      const it = document.createElement("div");
      it.className = "item";
      const dot = document.createElement("div");
      dot.className = "dot";
      const t = document.createElement("div");
      t.className = "t";
      t.textContent = l.title;
      const em = document.createElement("em");
      em.textContent = l.hand === "both" ? "both hands" : `${l.hand} hand`;
      t.appendChild(em);
      const h = document.createElement("div");
      h.className = "h";
      h.textContent = l.hint;
      it.append(dot, t, h);
      list.appendChild(it);
      this.items.set(l.id, it);
    }
    for (const t of ["mousedown", "mouseup"] as const) this.root.addEventListener(t, (e) => e.stopPropagation());
    this.root.addEventListener("click", (e) => {
      e.stopPropagation();
      const el = e.target as HTMLElement;
      if (el.closest("[data-skip]") || el.closest("[data-done]")) this.close();
      else if (el.closest("[data-reset]")) {
        this.lessons.reset();
        this.refresh();
      }
    });
    this.refresh();
  }

  get isOpen(): boolean {
    return this.opened;
  }

  open(h: GestureHandle): void {
    if (this.opened) return;
    this.opened = true;
    this.handle = h;
    h.hold = true;
    h.preview(false);
    this.root.classList.add("on");
    window.addEventListener("keydown", this.onKey, true);
    window.addEventListener("keyup", this.onKey, true);
    this.off = h.onFrame((f) => this.frame(f));
  }

  close(): void {
    if (!this.opened) return;
    this.opened = false;
    this.off?.();
    this.off = null;
    if (this.handle) {
      this.handle.hold = false;
      this.handle.preview(true);
    }
    this.handle = null;
    this.root.classList.remove("on");
    window.removeEventListener("keydown", this.onKey, true);
    window.removeEventListener("keyup", this.onKey, true);
  }

  private frame(f: GestureFrame): void {
    const h = this.handle;
    if (!h) return;
    const tr = h.tracker;
    this.lessons.update(f.events, tr.axis, tr.debug.hands);
    this.draw(h.video, f);
    // live stick and swipe speed
    this.stick.style.left = `${50 + tr.axis.x * 38}%`;
    this.stick.style.top = `${50 - tr.axis.y * 38}%`;
    const speed = tr.debug.speed;
    this.bar.style.width = `${Math.min(100, (speed / 12) * 100)}%`;
    this.speedTxt.textContent = speed.toFixed(1);
    this.refresh();
  }

  private draw(video: HTMLVideoElement, f: GestureFrame): void {
    const g = this.ctx;
    g.save();
    g.clearRect(0, 0, W, H);
    g.translate(W, 0);
    g.scale(-1, 1);
    if (video.readyState >= 2) g.drawImage(video, 0, 0, W, H);
    g.restore();
    // role zones
    g.fillStyle = "rgba(111,199,192,0.08)";
    g.fillRect(0, 0, W / 2, H);
    g.fillStyle = "rgba(239,106,82,0.08)";
    g.fillRect(W / 2, 0, W / 2, H);
    g.strokeStyle = "rgba(239,231,218,0.35)";
    g.setLineDash([6, 6]);
    g.beginPath();
    g.moveTo(W / 2, 0);
    g.lineTo(W / 2, H);
    g.stroke();
    g.setLineDash([]);
    g.font = `12px ${LATIN_FONT}`;
    g.fillStyle = MOVE;
    g.fillText("LEFT HAND · MOVE", 10, 18);
    g.fillStyle = FIGHT;
    g.textAlign = "right";
    g.fillText("RIGHT HAND · FIGHT", W - 10, 18);
    g.textAlign = "left";
    const sorted = [...f.hands].filter((h) => h.length >= 21).sort((a, b) => 1 - a[9].x - (1 - b[9].x));
    sorted.forEach((hand, i) => {
      const role = sorted.length >= 2 ? (i === 0 ? "move" : "fight") : 1 - hand[9].x < 0.5 ? "move" : "fight";
      const col = role === "move" ? MOVE : FIGHT;
      g.strokeStyle = col;
      g.fillStyle = col;
      g.lineWidth = 2;
      const px = (p: { x: number; y: number }) => [(1 - p.x) * W, p.y * H] as const;
      for (const [a, b] of BONES) {
        const [x1, y1] = px(hand[a]);
        const [x2, y2] = px(hand[b]);
        g.beginPath();
        g.moveTo(x1, y1);
        g.lineTo(x2, y2);
        g.stroke();
      }
      for (const p of hand) {
        const [x, y] = px(p);
        g.beginPath();
        g.arc(x, y, 3, 0, Math.PI * 2);
        g.fill();
      }
      const [lx, ly] = px(hand[9]);
      g.font = `bold 12px ${LATIN_FONT}`;
      g.fillText(role === "move" ? "MOVE" : this.handle?.tracker.status.includes("guard") ? "GUARD" : "FIGHT", lx - 16, ly - 18);
    });
    if (!sorted.length) {
      g.fillStyle = "rgba(239,231,218,0.8)";
      g.font = `15px ${LATIN_FONT}`;
      g.textAlign = "center";
      g.fillText("No hands seen yet. Hold them up, palms open.", W / 2, H / 2);
      g.textAlign = "left";
    }
  }

  private refresh(): void {
    const next = LESSONS.find((l) => !this.lessons.done.has(l.id));
    for (const l of LESSONS) {
      const it = this.items.get(l.id)!;
      const done = this.lessons.done.has(l.id);
      it.className = `item${done ? " done" : ""}${next?.id === l.id ? " cur" : ""}`;
      (it.firstElementChild as HTMLElement).textContent = done ? "✓" : "";
    }
    const n = this.lessons.done.size;
    this.msg.className = `msg${this.lessons.complete ? " ok" : ""}`;
    this.msg.textContent = this.lessons.complete ? "Every gesture recognised. You are ready." : `${n} of ${LESSONS.length} done`;
    const btn = this.root.querySelector("[data-done]") as HTMLElement;
    btn.textContent = this.lessons.complete ? "Start playing" : "Skip";
  }
}
