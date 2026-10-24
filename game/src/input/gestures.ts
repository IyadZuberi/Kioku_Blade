/**
 * Webcam hand tracking (MediaPipe Hand Landmarker) feeding GestureTracker, which feeds Input.
 * Everything runs in the browser; video never leaves it. Optional: mouse and keyboard always work.
 */
import { FilesetResolver, HandLandmarker } from "@mediapipe/tasks-vision";
import type { Input } from "../core/Input";
import { GestureTracker, type GestureEvent, type Hand } from "./gestureLogic";

export interface GestureFrame {
  hands: Hand[];
  events: GestureEvent[];
}

export interface GestureHandle {
  stop(): void;
  /** The mirrored camera video element (the training window draws from it). */
  video: HTMLVideoElement;
  tracker: GestureTracker;
  /** Called after every analysed frame; returns an unsubscribe function. */
  onFrame(cb: (f: GestureFrame) => void): () => void;
  /** While true the hands are analysed but nothing reaches the game (training window open). */
  hold: boolean;
  /** Hide or show the small corner preview. */
  preview(on: boolean): void;
}

const BASE = (import.meta as { env?: { BASE_URL?: string } }).env?.BASE_URL ?? "/";
const MAX_FPS = 30;
const DEBUG = new URLSearchParams(location.search).get("gdebug") === "1";

export async function startGestures(input: Input, onStatus: (s: string) => void = () => {}): Promise<GestureHandle> {
  const stream = await navigator.mediaDevices.getUserMedia({ video: { width: 640, height: 480, facingMode: "user" }, audio: false });
  const video = document.createElement("video");
  video.muted = true;
  video.playsInline = true;
  video.srcObject = stream;
  Object.assign(video.style, { position: "fixed", right: "16px", bottom: "16px", width: "176px", height: "132px", transform: "scaleX(-1)", opacity: "0.8", border: "1px solid #8f8472", zIndex: "20", pointerEvents: "none", objectFit: "cover" });
  const label = document.createElement("div");
  Object.assign(label.style, { position: "fixed", right: "16px", bottom: "150px", width: "176px", textAlign: "center", font: "11px Georgia, serif", letterSpacing: "0.12em", color: "#efe7da", textTransform: "uppercase", zIndex: "20", pointerEvents: "none", textShadow: "0 1px 3px #000" });
  document.body.append(video, label);
  await video.play();

  const fileset = await FilesetResolver.forVisionTasks(`${BASE}mediapipe/wasm`);
  const make = (delegate: "GPU" | "CPU") =>
    HandLandmarker.createFromOptions(fileset, { baseOptions: { modelAssetPath: `${BASE}models/hand_landmarker.task`, delegate }, runningMode: "VIDEO", numHands: 2 });
  const landmarker = await make("GPU").catch(() => make("CPU"));

  const tracker = new GestureTracker();
  const subs = new Set<(f: GestureFrame) => void>();
  const handle = { hold: false } as { hold: boolean };
  let raf = 0;
  let last = 0;
  let stopped = false;
  let lastEvent = "-";
  const loop = (now: number) => {
    if (stopped) return;
    raf = requestAnimationFrame(loop);
    if (now - last < 1000 / MAX_FPS || video.readyState < 2) return;
    last = now;
    try {
      const res = landmarker.detectForVideo(video, now);
      const events = tracker.update(res.landmarks as never, now / 1000);
      if (handle.hold) {
        for (const a of ["block", "attack", "dodge", "jump"] as const) input.release(a, "gesture");
        input.setAnalog("hand", 0, 0);
      } else {
        for (const e of events) {
          if (e.type === "press") (input.press(e.action, "gesture"), (lastEvent = e.action));
          else input.release(e.action, "gesture");
        }
        input.setAnalog("hand", tracker.axis.x, tracker.axis.y);
      }
      for (const cb of subs) cb({ hands: res.landmarks as never, events });
      const d = tracker.debug;
      label.textContent = DEBUG
        ? `${tracker.status} · hands ${d.hands} · speed ${d.speed.toFixed(1)} · peak ${d.peak.toFixed(1)} · stick ${tracker.axis.x.toFixed(2)},${tracker.axis.y.toFixed(2)} · last ${lastEvent}`
        : `gestures · ${tracker.status}`;
      onStatus(tracker.status);
    } catch {
      /* a bad frame is not worth a crash */
    }
  };
  raf = requestAnimationFrame(loop);

  return Object.assign(handle, {
    video,
    tracker,
    onFrame(cb: (f: GestureFrame) => void) {
      subs.add(cb);
      return () => void subs.delete(cb);
    },
    preview(on: boolean) {
      video.style.display = on ? "" : "none";
      label.style.display = on ? "" : "none";
    },
    stop() {
      stopped = true;
      cancelAnimationFrame(raf);
      for (const a of ["block", "attack", "dodge", "jump"] as const) input.release(a, "gesture");
      input.setAnalog("hand", 0, 0);
      stream.getTracks().forEach((t) => t.stop());
      landmarker.close();
      video.remove();
      label.remove();
    },
  });
}