/**
 * The gate to the next general: a great vermilion torii whose opening fills with light. After a
 * victory that unlocks a new chapter the player walks through it (see Game.beginGate).
 */
import * as THREE from "three";
import { rng } from "../core/math";
import { torii } from "../world/themes";

const SHEET_W = 7.7;
const SHEET_H = 4.6;

function sheetTexture(): THREE.CanvasTexture {
  const c = document.createElement("canvas");
  c.width = 64;
  c.height = 256;
  const g = c.getContext("2d")!;
  const gr = g.createLinearGradient(0, 0, 0, 256);
  gr.addColorStop(0, "rgba(255,244,214,0.95)");
  gr.addColorStop(0.5, "rgba(255,226,166,0.8)");
  gr.addColorStop(1, "rgba(255,214,140,0.95)");
  g.fillStyle = gr;
  g.fillRect(0, 0, 64, 256);
  const side = g.createLinearGradient(0, 0, 64, 0);
  side.addColorStop(0, "rgba(0,0,0,0.5)");
  side.addColorStop(0.25, "rgba(0,0,0,0)");
  side.addColorStop(0.75, "rgba(0,0,0,0)");
  side.addColorStop(1, "rgba(0,0,0,0.5)");
  g.globalCompositeOperation = "destination-out";
  g.fillStyle = side;
  g.fillRect(0, 0, 64, 256);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export class Gate {
  readonly group = new THREE.Group();
  private readonly sheet: THREE.Mesh;
  private readonly mat: THREE.MeshBasicMaterial;
  /** Where a body must cross to count as through (world z; the gate faces +z, toward the arena). */
  z = 0;

  constructor(scene: THREE.Scene) {
    const t = torii(rng(5));
    t.scale.setScalar(1.25);
    this.group.add(t);
    this.mat = new THREE.MeshBasicMaterial({ map: sheetTexture(), color: new THREE.Color(2.4, 2.0, 1.4), transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, fog: false, side: THREE.DoubleSide });
    this.sheet = new THREE.Mesh(new THREE.PlaneGeometry(SHEET_W * 1.25, SHEET_H * 1.25), this.mat);
    this.sheet.position.y = 2.95 * 1.25;
    this.group.add(this.sheet);
    this.group.visible = false;
    scene.add(this.group);
  }

  place(x: number, z: number): void {
    this.group.position.set(x, 0, z);
    this.group.visible = true;
    this.z = z;
    this.mat.opacity = 0;
  }

  hide(): void {
    this.group.visible = false;
  }

  /** `open` 0..1: how far the light has filled the opening. */
  update(t: number, open: number): void {
    this.mat.opacity = Math.min(1, open) * (0.82 + Math.sin(t * 3.1) * 0.06 + Math.sin(t * 7.3) * 0.03);
  }
}