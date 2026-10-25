/**
 * Pose training: pick an action, hold a hand shape for a second and a half, and the game keeps it.
 * Poses are read from a single frame, so they react faster than swipes. Everything is stored in this
 * browser only. While the window is open the hands drive nothing in the game.
 */
import { LATIN_FONT } from "./brush";
import type { GestureFrame, GestureHandle } from "../input/gestures";
import { lookAlike, poseFeatures, savePoses, withPose, type Pose, type PoseAction } from "../input/poses";

const W = 420;
const H = 315;
const BONES: [number, number][] = [[0, 1], [1, 2], [2, 3], [3, 4], [0, 5], [5, 6], [6, 7], [7, 8], [5, 9], [9, 10], [10, 11], [11, 12], [9, 13], [13, 14], [14, 15], [15, 16], [13, 17], [17, 18], [18, 19], [19, 20], [0, 17]];
const ACTIONS: { id: PoseAction; label: string }[] = [
  { id: "block", label: "Guard (held while the pose is held)" },
  { id: "attack", label: "Strike" },
  { id: "dodge", label: "Step" },
  { id: "jump", label: "Jump" },
  { id: "heal", label: "Gourd (heal)" },
  { id: "lock", label: "Lock on" },
  { id: "none", label: "Rest (do nothing): teach it your relaxed hand" },
];
const COUNTDOWN = 1.5;
const RECORD = 1.5;

const CSS = `
#poses { position: fixed; inset: 0; z-index: 70; display: none; align-items: center; justify-content: center; background: rgba(8,6,9,0.9); font-family: ${LATIN_FONT}; color: #efe7da; }
#poses.on { display: flex; }
#poses .win { width: min(94vw, 900px); max-height: 92vh; overflow: auto; background: #100d12; border-top: 1px solid rgba(196,55,42,0.9); padding: 20px 26px 22px; }
#poses h2 { margin: 0 0 4px; font-size: 24px; font-weight: 600; }
#poses p { margin: 0 0 12px; color: #a99d89; font-size: 14px; line-height: 1.5; }
#poses .body { display: grid; grid-template-columns: ${W}px minmax(240px, 1fr); gap: 22px; }
@media (max-width: 860px) { #poses .body { grid-template-columns: 1fr; } }
#poses canvas { width: 100%; max-width: ${W}px; aspect-ratio: ${W} / ${H}; background: #0b090c; border: 1px solid rgba(239,231,218,0.25); display: block; }
#poses .now { margin-top: 10px; font-size: 15px; min-height: 22px; color: #6fc7c0; }
#poses select, #poses button { background: #17121a; border: 1px solid rgba(239,231,218,0.3); color: #d9cdb9; font: 14px ${LATIN_FONT}; padding: 8px 12px; cursor: pointer; }
#poses button:hover { border-color: rgba(239,231,218,0.85); color: #fff; }
#poses button.primary { border-color: #c4372a; background: rgba(120,28,20,0.45); color: #fff3e4; }
#poses .row { display: flex; gap: 10px; margin-bottom: 14px; flex-wrap: wrap; }
#poses .list { display: flex; flex-direction: column; gap: 6px; margin-top: 6px; }
#poses .item { display: flex; align-items: center; gap: 10px; padding: 9px 12px; border: 1px solid rgba(239,231,218,0.15); font-size: 14px; }
#poses .item.hit { border-color: #6fc7c0; background: rgba(111,199,192,0.12); }
#poses .item span { color: #a99d89; font-size: 12.5px; }
#poses .item button { margin-left: auto; padding: 3px 9px; font-size: 12px; }
#poses .foot { display: flex; gap: 10px; margin-top: 16px; }
#poses .foot button:last-child { margin-left: auto; }
`;

export class PoseTrainer {
  private readonly root: HTMLElement;
  private readonly ctx: CanvasRenderingContext2D;
  private readonly select: HTMLSelectElement;
  private readonly now: HTMLElement;
  private readonly list: HTMLElement;
  private handle: GestureHandle | null = null;
  private off: (() => void) | null = null;
  private rec: { start: number; action: PoseAction; samples: number[][] } | null = null;
  private notice = "";
  private noticeUntil = 0;
  private labelOf(a: PoseAction): string {
    return ACTIONS.find((x) => x.id === a)?.label.split(" (")[0].split(":")[0] ?? "Unknown";
  }
  private onKey = (e: KeyboardEvent): void => {
    if (e.code === "Escape") this.close();
    e.preventDefault();
    e.stopImmediatePropagation();
  };

  constructor(host: HTMLElement) {
    const style = document.createElement("style");
    style.textContent = CSS;
    document.head.appendChild(style);
    this.root = document.createElement("div");
    this.root.id = "poses";
    this.root.setAttribute("role", "dialog");
    this.root.setAttribute("aria-modal", "true");
    this.root.setAttribute("aria-label", "Train my poses");
    this.root.innerHTML = `<div class="win">
      <h2>Train my poses</h2>
      <p>Choose an action, press Capture, then hold the hand shape you want for it. Train as many actions as you like: each keeps its own pose, and capturing an action again replaces only that one. Poses work with either hand, and with both hands at once. Teach it a Rest pose too, so a relaxed hand never triggers anything. Poses stay in this browser.</p>
      <div class="body">
        <div><canvas width="${W}" height="${H}"></canvas><div class="now"></div></div>
        <div>
          <div class="row"><select></select><button type="button" class="primary" data-capture>Capture</button></div>
          <div class="list"></div>
        </div>
      </div>
      <div class="foot"><button type="button" data-clear>Delete all poses</button><button type="button" class="primary" data-done>Done</button></div>
    </div>`;
    host.appendChild(this.root);
    this.ctx = (this.root.querySelector("canvas") as HTMLCanvasElement).getContext("2d")!;
    this.select = this.root.querySelector("select") as HTMLSelectElement;
    this.select.innerHTML = ACTIONS.map((a) => `<option value="${a.id}">${a.label}</option>`).join("");
    this.now = this.root.querySelector(".now") as HTMLElement;
    this.list = this.root.querySelector(".list") as HTMLElement;
    for (const t of ["mousedown", "mouseup"] as const) this.root.addEventListener(t, (e) => e.stopPropagation());
    this.root.addEventListener("click", (e) => {
      e.stopPropagation();
      const el = e.target as HTMLElement;
      if (el.closest("[data-done]")) this.close();
      else if (el.closest("[data-capture]")) this.rec = { start: performance.now() / 1000, action: this.select.value as PoseAction, samples: [] };
      else if (el.closest("[data-clear]") && this.handle) this.set([]);
      else if (el.closest("[data-del]") && this.handle) this.set(this.handle.poses.set.poses.filter((p) => p.id !== (el.closest("[data-del]") as HTMLElement).dataset.del));
    });
  }

  get isOpen(): boolean {
    return this.root.classList.contains("on");
  }

  open(h: GestureHandle): void {
    this.handle = h;
    this.root.classList.add("on");
    window.addEventListener("keydown", this.onKey, true);
    window.addEventListener("keyup", this.onKey, true);
    this.off = h.onFrame((f) => this.frame(f));
    this.renderList(null);
  }

  close(): void {
    this.off?.();
    this.off = null;
    this.rec = null;
    this.handle = null;
    this.root.classList.remove("on");
    window.removeEventListener("keydown", this.onKey, true);
    window.removeEventListener("keyup", this.onKey, true);
  }

  private set(poses: Pose[]): void {
    if (!this.handle) return;
    this.handle.poses.set = { poses };
    savePoses(this.handle.poses.set);
    this.renderList(null);
  }

  private renderList(hit: string | null): void {
    const poses = this.handle?.poses.set.poses ?? [];
    const key = poses.map((p) => `${p.id}:${p.action}:${p.samples.length}`).join("|");
    if (key !== this.list.dataset.key) {
      this.list.dataset.key = key;
      this.list.replaceChildren();
      const label = (a: PoseAction) => ACTIONS.find((x) => x.id === a)?.label.split(" (")[0].split(":")[0] ?? "Unknown";
      for (const p of poses) {
        const it = document.createElement("div");
        it.className = "item";
        it.dataset.id = p.id;
        const sp = document.createElement("span");
        sp.textContent = `${p.samples.length} samples`;
        const del = document.createElement("button");
        del.type = "button";
        del.textContent = "Delete";
        del.dataset.del = p.id;
        it.append(label(p.action) + " ", sp, del);
        this.list.appendChild(it);
      }
      if (!poses.length) {
        const it = document.createElement("div");
        it.className = "item";
        it.textContent = "No poses yet. Capture your first one.";
        this.list.appendChild(it);
      }
    }
    this.list.querySelectorAll(".item").forEach((n) => n.classList.toggle("hit", (n as HTMLElement).dataset.id === hit));
  }

  private frame(f: GestureFrame): void {
    const h = this.handle;
    if (!h) return;
    const t = performance.now() / 1000;
    const hands = f.hands.filter((x) => x.length >= 21).sort((a, b) => 1 - a[9].x - (1 - b[9].x));
    // train with the right hand (or the only hand): a left hand is flipped so the pose is stored as a right-hand shape
    const hand = hands[hands.length - 1];
    const feat = hand && poseFeatures(hand, hands.length === 1 && 1 - hand[9].x < 0.5);

    let banner = "";
    if (this.rec) {
      const el = t - this.rec.start;
      if (el < COUNTDOWN) banner = `Get ready: ${Math.ceil(COUNTDOWN - el)}`;
      else if (el < COUNTDOWN + RECORD) {
        banner = "Hold it...";
        if (feat) this.rec.samples.push(feat);
      } else {
        const r = this.rec;
        this.rec = null;
        if (r.samples.length >= 8) {
          const step = Math.max(1, Math.floor(r.samples.length / 24));
          const pose: Pose = { id: `p${Date.now()}`, name: r.action, action: r.action, samples: r.samples.filter((_, i) => i % step === 0) };
          // a new capture replaces only the old pose of that same action; every other pose stays
          const alike = lookAlike(h.poses.set.poses, pose);
          this.set(withPose(h.poses.set.poses, pose));
          this.notice = alike.length ? `Saved. It looks a lot like your ${this.labelOf(alike[0].action)} pose: they may be mixed up. Try a more different shape.` : "Saved.";
          this.noticeUntil = t + 5;
        } else banner = "No hand seen. Try again.";
      }
    }

    // both hands are read on their own: show what each one is doing
    const rec = (m: { pose: Pose } | null) => (m ? (m.pose.action === "none" ? "rest" : this.labelOf(m.pose.action)) : "-");
    const cur = h.poses.currents;
    const m = h.poses.current;
    this.now.textContent = banner || (t < this.noticeUntil ? this.notice : hands.length ? `Left hand: ${rec(cur.L)}   Right hand: ${rec(cur.R)}` : "No hand seen");
    this.renderList(m?.pose.id ?? null);
    this.draw(h.video, hands, banner);
  }

  private draw(video: HTMLVideoElement, hands: GestureFrame["hands"], banner: string): void {
    const g = this.ctx;
    g.save();
    g.clearRect(0, 0, W, H);
    g.translate(W, 0);
    g.scale(-1, 1);
    if (video.readyState >= 2) g.drawImage(video, 0, 0, W, H);
    g.restore();
    hands.forEach((hand, i) => {
      const fighter = i === hands.length - 1;
      g.strokeStyle = g.fillStyle = fighter ? "#ef6a52" : "rgba(111,199,192,0.5)";
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
    });
    if (banner) {
      g.fillStyle = "rgba(8,6,9,0.6)";
      g.fillRect(0, H / 2 - 30, W, 60);
      g.fillStyle = "#fff3e4";
      g.font = `bold 24px ${LATIN_FONT}`;
      g.textAlign = "center";
      g.fillText(banner, W / 2, H / 2 + 8);
      g.textAlign = "left";
    }
  }
}
