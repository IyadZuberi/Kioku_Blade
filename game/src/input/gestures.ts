/**
 * Webcam hand tracking (MediaPipe Hand Landmarker) feeding GestureTracker, which feeds Input.
 * Everything runs in the browser; video never leaves it. Optional: mouse and keyboard always work.
 */
import { FilesetResolver, HandLandmarker } from "@mediapipe/tasks-vision";
import type { Input } from "../core/Input";
import { GestureTracker, type GestureEvent, type Hand } from "./gestureLogic";
import { PoseTracker, loadPoses } from "./poses";

export interface GestureFrame {
  hands: Hand[];
  events: GestureEvent[];
}

export interface GestureHandle {
  stop(): void;
  /** The mirrored camera video element (the training window draws from it). */
  video: HTMLVideoElement;
  tracker: GestureTracker;
  /** The player's trained hand poses (see PoseTrainer); once any pose has an action the fighting hand is read from them. */
  poses: PoseTracker;
  /** Called after every analysed frame; returns an unsubscribe function. */
  onFrame(cb: (f: GestureFrame) => void): () => void;
  /** While true the hands are analysed but nothing reaches the game (training window open). */
  hold: boolean;
  /** Hide or show the small corner preview. */
  preview(on: boolean): void;
}

const BASE = (import.meta as { env?: { BASE_URL?: string } }).env?.BASE_URL ?? "/";
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
  const poses = new PoseTracker();
  poses.set = loadPoses();
  const subs = new Set<(f: GestureFrame) => void>();
  const handle = { hold: false } as { hold: boolean };
  let raf = 0;
  let lastVideoTime = -1;
  let stopped = false;
  let lastEvent = "-";
  const loop = (now: number) => {
    if (stopped) return;
    raf = requestAnimationFrame(loop);
    // analyse every NEW camera frame as soon as it arrives (no fixed cap: the camera is the limit)
    if (video.readyState < 2 || video.currentTime === lastVideoTime) return;
    lastVideoTime = video.currentTime;
    try {
      const res = landmarker.detectForVideo(video, now);
      tracker.update(res.landmarks as never, now / 1000);
      const events = poses.update(res.landmarks as never, now / 1000);
      if (handle.hold) {
        for (const a of ["block", "attack", "dodge", "jump", "heal", "lock"] as const) input.release(a, "gesture");
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
        ? `${tracker.status} · hands ${d.hands} · pose ${poses.current?.pose.action ?? "-"} · stick ${tracker.axis.x.toFixed(2)},${tracker.axis.y.toFixed(2)} · last ${lastEvent}`
        : `hands · ${tracker.status}${poses.ready ? "" : " · no poses trained (F1 > Hands)"}`;
      onStatus(tracker.status);
    } catch {
      /* a bad frame is not worth a crash */
    }
  };
  raf = requestAnimationFrame(loop);

  return Object.assign(handle, {
    video,
    tracker,
    poses,
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
      for (const a of ["block", "attack", "dodge", "jump", "heal", "lock"] as const) input.release(a, "gesture");
      input.setAnalog("hand", 0, 0);
      stream.getTracks().forEach((t) => t.stop());
      landmarker.close();
      video.remove();
      label.remove();
    },
  });
}