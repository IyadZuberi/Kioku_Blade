import * as THREE from "three";
import { loadBodies } from "./chars/loadBodies";
import { activeDifficulty, DIFFICULTY, DIFFICULTY_PRESETS, type DifficultyName } from "./game/difficulty";
import { Input } from "./core/Input";
import { deflectPosture, Game, KICK_HEAD_POSTURE, MIKIRI_POSTURE } from "./game/Game";
import { GOURD, REZ } from "./game/Player";
import { wavedash } from "./wavedash";
import { sendOverride } from "./learn/session";
import { ControlsPanel } from "./ui/ControlsPanel";
import { PoseTrainer } from "./ui/PoseTrainer";
import { PauseMenu } from "./ui/PauseMenu";
import type { GestureHandle } from "./input/gestures";
import { startGamepad } from "./input/gamepad";

const canvas = document.getElementById("game") as HTMLCanvasElement;
const hud = document.getElementById("hud") as HTMLElement;
wavedash.progress(0.2);
const game = new Game(canvas, hud);
game.start();
wavedash.ready();
// Controller (any standard pad, picked up automatically) and the Controls window (chip on menus, F1 anywhere).
startGamepad(game.input);
const menuState = () => game.state === "title" || game.state === "defeat" || game.state === "victory";
const trainer = new PoseTrainer(document.body);
const controls = new ControlsPanel(hud, () => menuState() && !trainer.isOpen);
controls.voice = game.subs.voice;
game.subs.voice.muted = () => game.audio.isMuted;
controls.sound = {
  get: () => ({ ...game.audio.volumes, muted: game.audio.isMuted }),
  set: (v) => {
    game.audio.setVolumes({ master: v.master, music: v.music, sfx: v.sfx });
    game.audio.setMuted(v.muted);
  },
};
controls.onPractice = () => {
  if (gestures) trainer.open(gestures);
  else void toggleGestures().then(() => gestures && trainer.open(gestures));
};
setInterval(() => controls.showChip(menuState()), 250);
const pauseMenu = new PauseMenu(hud, {
  canPause: () => game.inDuel,
  pause: () => {
    game.input.releaseAll();
    game.audio.setDuck(0.25);
    game.pause();
  },
  resume: () => {
    game.audio.setDuck(1);
    game.resume();
  },
  forfeit: () => game.forfeit(),
  hands: { on: () => !!gestures, toggle: () => toggleGestures(), train: () => gestures && trainer.open(gestures) },
  volumes: {
    get: () => ({ ...game.audio.volumes, voice: game.subs.voice.enabled ? game.subs.voice.volume : 0, muted: game.audio.isMuted }),
    set: (v) => {
      game.audio.setVolumes({ master: v.master, music: v.music, sfx: v.sfx });
      game.audio.setMuted(v.muted);
      game.subs.voice.set(v.voice > 0, v.voice);
    },
  },
  openControls: () => controls.open(),
});
void pauseMenu;
window.addEventListener("gamepadconnected", () => game.council.flash("Controller connected"));

// Optional hand gestures: ?gestures=1 or the G key. Mouse and keyboard always work.
let gestures: GestureHandle | null = null;
async function toggleGestures(): Promise<void> {
  if (gestures) {
    gestures.stop();
    gestures = null;
    game.gestureAssist = false;
    return;
  }
  try {
    const { startGestures } = await import("./input/gestures");
    gestures = await startGestures(game.input);
    game.gestureAssist = true;
    controls.select("hands");
    if (!gestures.poses.ready) trainer.open(gestures); // first thing after the camera starts: teach it your poses
  } catch (e) {
    console.warn("gestures unavailable:", e);
  }
}
window.addEventListener("keydown", (e) => {
  if (e.code === "KeyG" && !e.repeat && !(e.target instanceof HTMLInputElement)) void toggleGestures();
});
if (new URLSearchParams(location.search).get("gestures") === "1") void toggleGestures();

// [ and ] step through the unlocked chapters on the title.
window.addEventListener("keydown", (e) => {
  if ((e.code !== "BracketLeft" && e.code !== "BracketRight") || e.repeat || e.target instanceof HTMLInputElement || game.state !== "title") return;
  const next = game.progress.boss + (e.code === "BracketRight" ? 1 : -1);
  if (next >= 1 && next <= 3) game.selectBoss(next as 1 | 2 | 3);
});

// Host-only: H on the end screen teaches the General a rule and re-sends that fight with it.
window.addEventListener("keydown", (e) => {
  if (e.code !== "KeyH" || e.repeat || e.target instanceof HTMLInputElement) return;
  if (game.state !== "defeat" && game.state !== "victory") return;
  let token = "";
  try {
    token = sessionStorage.getItem("gr.hostToken") ?? "";
  } catch {
    /* storage unavailable */
  }
  if (!token) {
    token = window.prompt("Host token (HOST_TOKEN on the server):")?.trim() ?? "";
    if (!token) return;
    try {
      sessionStorage.setItem("gr.hostToken", token);
    } catch {
      /* storage unavailable */
    }
  }
  const rule = window.prompt("Teach the General a rule (host only). Example: When the player blocks often, field thrust.");
  if (!rule?.trim()) return;
  void sendOverride(game.learn.fightId, rule.trim(), token).then((r) => {
    if (r.status === 403) {
      try {
        sessionStorage.removeItem("gr.hostToken");
      } catch {
        /* storage unavailable */
      }
      game.council.flash("Wrong host token: nothing was saved. Press H to try again.");
    } else if (r.status === 404) game.council.flash("That fight is not stored on the server (replay or offline): nothing was saved.");
    else if (r.ok) {
      // Use the corrected plan for the rematch (it was only sent to Mubit before).
      if (r.plan && game.learn.result) game.learn.result = { ...game.learn.result, plan: r.plan };
      game.council.flash("Rule saved: the General will use it next fight (and Mubit trains on it).");
    }
    else game.council.flash("Rule saved. Mubit is off or unreachable, so nothing was re-sent.");
  });
});
// ?arena=1|2|3 starts in that arena (each boss has its own).
const arenaParam = Number(new URLSearchParams(location.search).get("arena"));
if (arenaParam === 1 || arenaParam === 2 || arenaParam === 3) game.setArena(arenaParam);
const bodies = loadBodies({ player: game.shinobi, boss: game.general }, (who, body) => game.useBody(who, body));
if (new URLSearchParams(location.search).get("debug") === "anim") void import("./debug/AnimDebug").then((m) => m.mountAnimDebug(game));

type SceneName = "title" | "fight" | "thrust" | "overhead" | "deflect" | "break" | "finisher" | "finisher2" | "victory" | "portrait" | "portrait2" | "closeP" | "closeB" | "closeP2";

function until(pred: () => boolean, max = 6, dt = 1 / 60): boolean {
  for (let t = 0; t < max; t += dt) {
    if (pred()) return true;
    game.step(dt);
  }
  return pred();
}

/** Deterministic set pieces for screenshots and checks (pauses the real-time loop). */
function scene(name: SceneName): Record<string, unknown> {
  game.pause();
  const b = game.boss;
  const s = game.stats;
  const close = (d: number) => {
    game.startFight();
    game.place(d);
    b.cooldown = 99;
    game.step(0.5);
  };
  game.cam.override = null;
  switch (name) {
    case "portrait":
    case "portrait2": {
      close(3);
      game.step(0.6);
      const back = name === "portrait2";
      game.cam.override = {
        pos: new THREE.Vector3(back ? -2.2 : 3.2, 1.5, back ? -5.5 : 1.2),
        look: new THREE.Vector3(0, 1.2, back ? 0 : -0.5),
      };
      game.step(0.1);
      break;
    }
    case "closeP":
    case "closeP2":
    case "closeB": {
      close(3);
      game.step(0.6);
      const P = game.player.pos;
      const B = game.boss.pos;
      game.cam.override =
        name === "closeB"
          ? { pos: new THREE.Vector3(B.x + 1.6, 1.7, B.z + 2.3), look: new THREE.Vector3(B.x, 1.45, B.z) }
          : name === "closeP"
            ? { pos: new THREE.Vector3(P.x - 1.3, 1.35, P.z - 1.4), look: new THREE.Vector3(P.x, 1.05, P.z) }
            : { pos: new THREE.Vector3(P.x + 1.2, 1.4, P.z + 1.6), look: new THREE.Vector3(P.x, 1.05, P.z) };
      game.step(0.1);
      break;
    }
    case "finisher2":
      scene("break");
      game.bot.deflect = false;
      game.startFinisher();
      until(() => game.player.stateT >= 0.75, 4, 1 / 120);
      break;
    case "title":
      game.toTitle();
      game.step(2.5);
      break;
    case "fight":
      game.startFight();
      game.step(1.95);
      break;
    case "thrust":
      close(3.4);
      game.forceBossAttack("thrust");
      game.step(0.5);
      break;
    case "overhead":
      close(3);
      game.forceBossAttack("overhead");
      game.step(0.95);
      break;
    case "deflect": {
      close(2.6);
      game.bot.deflect = true;
      const n = s.deflects;
      game.forceBossAttack("combo");
      until(() => s.deflects > n, 3, 1 / 120);
      game.step(3 / 60);
      break;
    }
    case "break":
    case "finisher":
    case "victory": {
      close(2.6);
      game.bot.deflect = true;
      b.posture = 96;
      const n = s.breaks;
      game.forceBossAttack("overhead");
      until(() => s.breaks > n, 4, 1 / 120);
      game.step(0.45);
      if (name === "break") break;
      game.bot.deflect = false;
      game.startFinisher();
      until(() => game.player.stateT >= 0.5, 3, 1 / 120);
      if (name === "finisher") break;
      until(() => game.state === "victory", 8);
      game.step(0.3);
      break;
    }
  }
  return stats();
}

function stats(): Record<string, unknown> {
  return {
    renderer: game.rendererName,
    fps: +game.fps.toFixed(1),
    state: game.state,
    player: { health: game.player.health, posture: +game.player.posture.toFixed(1), state: game.player.state },
    boss: { health: +game.boss.health.toFixed(1), posture: +game.boss.posture.toFixed(1), state: game.boss.state, attack: game.boss.attack?.name ?? null },
    ...game.stats,
    drawCalls: game.renderer.info.render.calls,
    triangles: game.renderer.info.render.triangles,
  };
}

declare global {
  interface Window {
    __duel: Record<string, unknown>;
  }
}

/** Opens the pose trainer on a fake camera (no webcam): the returned `feed(hands)` pushes one frame. For checks and demos. */
async function poseDemo(): Promise<(hands: unknown[]) => void> {
  const { PoseTracker, loadPoses } = await import("./input/poses");
  const poses = new PoseTracker();
  poses.set = loadPoses();
  const subs = new Set<(f: unknown) => void>();
  const fake = { hold: false, video: document.createElement("video"), tracker: { axis: { x: 0, y: 0 } }, poses, onFrame: (cb: (f: unknown) => void) => (subs.add(cb), () => subs.delete(cb)), preview() {}, stop() {} } as unknown as GestureHandle;
  trainer.open(fake);
  return (hands) => {
    poses.update(hands as never, performance.now() / 1000);
    for (const cb of subs) cb({ hands, events: [] });
  };
}

window.__duel = {
  ready: false,
  game,
  stats,
  poseDemo,
  rules: {
    DIFFICULTY,
    DIFFICULTY_PRESETS,
    get DEFLECT_POSTURE() {
      return DIFFICULTY.deflectPosture;
    },
    deflectPosture,
    MIKIRI_POSTURE,
    KICK_HEAD_POSTURE,
    GOURD,
    REZ,
    DEFLECT_STEPS: Input.DEFLECT_STEPS,
    MASH_RESET: Input.MASH_RESET,
  },
  /** Difficulty for the next fight ('easy' | 'medium' | 'hard'); `difficulty()` → [chosen, running]. */
  setDifficulty: (d: DifficultyName) => game.setDifficulty(d),
  difficulty: () => [game.difficulty, activeDifficulty()],
  scene,
  step: (s: number) => game.step(s),
  pause: () => game.pause(),
  resume: () => game.resume(),
  startFight: () => game.startFight(),
  /** Tests and tuning: pretend the General has already fought this player `n` duels (all lost or won). */
  remember: (n: number, wins = 0) => {
    game.mem = { fights: n, wins, losses: n - wins, consecutive_losses: wins ? 0 : n };
  },
  arena: (n: 1 | 2 | 3) => game.setArena(n),
  toTitle: () => game.toTitle(),
  forceBossAttack: (n: string) => game.forceBossAttack(n),
  autoDeflect: (on: boolean) => {
    game.bot.deflect = on;
  },
  autoPlay: (on: boolean) => {
    game.bot.deflect = on;
    game.bot.play = on;
  },
};

// The rooftop (arena.glb + sky HDRI) streams in behind the title; `ready` waits for it and for its
// shaders, so the first fight never compiles programs.
/**
 * The arena adds materials and lantern lights (which changes every program's light hash), so compile
 * the whole scene again, hidden combat fx included, the way the composer draws it: into a linear
 * render target. Programs are created synchronously inside compileAsync, so the fx are only
 * un-hidden for that call and never reach the screen.
 */
function warmArena(): Promise<void> {
  const r = game.renderer;
  const hidden: THREE.Object3D[] = [];
  game.scene.traverse((o) => {
    if (!o.visible) {
      hidden.push(o);
      o.visible = true;
    }
  });
  const rt = new THREE.WebGLRenderTarget(4, 4, { type: THREE.HalfFloatType });
  const prev = r.getRenderTarget();
  r.setRenderTarget(rt);
  const done = r.compileAsync(game.scene, game.camera);
  r.setRenderTarget(prev);
  for (const o of hidden) o.visible = false;
  return done.then(() => rt.dispose());
}
// The skinned bodies (and their rim-lit materials) are compiled in the same pass.
game.arena
  .load(game.renderer)
  .then(() => bodies.catch(() => undefined))
  // Lighting agent: rim-tag the fighters' armour before the warm-up so it compiles with everything else.
  .then(() => game.arena.tagCharacterRim())
  .then(async () => {
    // Compile every general's shaders now (arena, body, weapon, gear) behind the loading screen, without
    // blocking it (compileAsync), so neither the first frame nor a chapter change ever waits on one.
    await game.warmGenerals(warmArena);
  })
  .catch((e: unknown) => console.error("[arena] failed to load", e))
  .finally(() => {
    const boot = document.getElementById("boot");
    boot?.classList.add("done");
    setTimeout(() => boot?.remove(), 800);
    game.ready = true;
    window.__duel.ready = true;
  });

// Dev-only hooks for tools/skin-smoke.mjs (stripped from production builds).
if (import.meta.env.DEV) {
  window.__duel.dev = {
    three: () => Promise.resolve(THREE),
    skinned: () => import("./chars/SkinnedCharacter"),
    config: () => import("./chars/skinnedConfig"),
    gltf: () => import("three/addons/loaders/GLTFLoader.js"),
    exporter: () => import("three/addons/exporters/GLTFExporter.js"),
  };
}
