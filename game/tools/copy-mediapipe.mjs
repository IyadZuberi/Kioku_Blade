// Copies the MediaPipe wasm runtime next to the app so gesture mode works offline.
import { cpSync, existsSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const src = resolve(root, "node_modules/@mediapipe/tasks-vision/wasm");
const dst = resolve(root, "public/mediapipe/wasm");
if (!existsSync(src)) {
  console.warn("copy-mediapipe: @mediapipe/tasks-vision not installed, skipping");
  process.exit(0);
}
mkdirSync(dst, { recursive: true });
cpSync(src, dst, { recursive: true });
console.log("copy-mediapipe: wasm copied to public/mediapipe/wasm");