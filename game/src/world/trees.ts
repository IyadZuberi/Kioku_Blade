/**
 * Real-looking trees, grown in code: a branching skeleton of tapered bark tubes (photo bark texture) carrying
 * alpha-cut foliage cards painted on a canvas (maple and ginkgo leaves, cherry blossom, cedar sprays,
 * black-pine needle tufts).
 * One bark mesh and one foliage mesh per `forest()` call, so a whole treeline is two draw calls.
 */
import * as THREE from "three";
import { rng } from "../core/math";
import { pbr } from "./assets";
import { tmerge, tpiece, type Rand } from "./kit";

export type TreeKind = "cedar" | "maple" | "pine" | "ginkgo" | "sakura";
export type Spot = [x: number, z: number, scale: number];

// ----------------------------------------------------------------------------- foliage textures

const cache = new Map<TreeKind, THREE.CanvasTexture>();

/** Greyscale foliage on transparent: the vertex colour tints it, so one painting serves every hue. */
function atlas(kind: TreeKind): THREE.CanvasTexture {
  const hit = cache.get(kind);
  if (hit) return hit;
  const S = 512;
  const c = document.createElement("canvas");
  c.width = c.height = S * 2; // painted in 512-unit space at 2x for crisp leaves
  const g = c.getContext("2d")!;
  g.scale(2, 2);
  const R = rng(kind.length * 977 + 5);
  const grey = (v: number, a = 1) => `rgba(${v | 0},${v | 0},${v | 0},${a})`;
  g.lineCap = "round";
  g.lineJoin = "round";
  if (kind === "maple") {
    for (let i = 0; i < 120; i++) {
      const a = R() * Math.PI * 2, d = Math.sqrt(R()) * S * 0.4;
      const x = S / 2 + Math.cos(a) * d, y = S / 2 + Math.sin(a) * d * 0.9;
      const r = 22 + R() * 26, rot = R() * 6.283, v = 185 + R() * 70;
      g.beginPath();
      for (let k = 0; k < 10; k++) {
        const rr = k % 2 ? r * 0.42 : r * (k % 4 === 0 ? 1 : 0.86);
        const an = rot + (k * Math.PI) / 5;
        g[k ? "lineTo" : "moveTo"](x + Math.cos(an) * rr, y + Math.sin(an) * rr);
      }
      g.closePath();
      g.fillStyle = grey(v);
      g.fill();
      g.strokeStyle = grey(v * 0.55, 0.8);
      g.lineWidth = 1.2;
      g.stroke();
      for (let k = 0; k < 10; k += 2) {
        const an = rot + (k * Math.PI) / 5;
        g.beginPath();
        g.moveTo(x, y);
        g.lineTo(x + Math.cos(an) * r * 0.8, y + Math.sin(an) * r * 0.8);
        g.stroke();
      }
    }
  } else if (kind === "ginkgo") {
    for (let i = 0; i < 110; i++) {
      const a = R() * Math.PI * 2, d = Math.sqrt(R()) * S * 0.4;
      const x = S / 2 + Math.cos(a) * d, y = S / 2 + Math.sin(a) * d * 0.9;
      const r = 24 + R() * 20, rot = R() * 6.283, v = 190 + R() * 65;
      g.save();
      g.translate(x, y);
      g.rotate(rot);
      g.beginPath();
      g.moveTo(0, 0);
      g.arc(0, 0, r, -0.95, -0.07);
      g.lineTo(0, -r * 0.2);
      g.lineTo(0, 0);
      g.moveTo(0, 0);
      g.arc(0, 0, r, 0.07, 0.95);
      g.closePath();
      g.fillStyle = grey(v);
      g.fill();
      g.strokeStyle = grey(v * 0.6, 0.8);
      g.lineWidth = 1;
      g.stroke();
      g.restore();
    }
  } else if (kind === "sakura") {
    // dense clusters of five-petalled blossoms, a few young leaves among them
    for (let i = 0; i < 420; i++) {
      const a = R() * Math.PI * 2, d = Math.sqrt(R()) * S * 0.44;
      const x = S / 2 + Math.cos(a) * d, y = S / 2 + Math.sin(a) * d * 0.88;
      if (R() < 0.08) {
        g.save();
        g.translate(x, y);
        g.rotate(R() * 6.283);
        g.fillStyle = "rgba(120,150,90,1)";
        g.beginPath();
        g.ellipse(0, 0, 9, 4, 0, 0, Math.PI * 2);
        g.fill();
        g.restore();
        continue;
      }
      const r = 7 + R() * 6, rot = R() * 6.283, v = 215 + R() * 40;
      for (let k = 0; k < 5; k++) {
        const an = rot + (k * Math.PI * 2) / 5;
        g.save();
        g.translate(x + Math.cos(an) * r * 0.55, y + Math.sin(an) * r * 0.55);
        g.rotate(an);
        g.fillStyle = grey(v - k * 3);
        g.beginPath();
        g.ellipse(0, 0, r * 0.62, r * 0.42, 0, 0, Math.PI * 2);
        g.fill();
        g.restore();
      }
      g.fillStyle = "rgba(150,70,90,0.9)";
      g.beginPath();
      g.arc(x, y, r * 0.22, 0, Math.PI * 2);
      g.fill();
    }
  } else if (kind === "cedar") {
    // a drooping spray: a curved stem from the bottom (the branch) to the top (the tip), twigs, then needles
    const needle = (x: number, y: number, ang: number, len: number, v: number) => {
      g.strokeStyle = grey(v);
      g.lineWidth = 2.1;
      g.beginPath();
      g.moveTo(x, y);
      g.lineTo(x + Math.cos(ang) * len, y + Math.sin(ang) * len);
      g.stroke();
    };
    for (let s = 0; s < 3; s++) {
      const ox = S * (0.22 + s * 0.28);
      let x = ox, y = S - 6, ang = -Math.PI / 2 + (R() - 0.5) * 0.3;
      const steps = 34;
      for (let i = 0; i < steps; i++) {
        const t = i / steps;
        const nx = x + Math.cos(ang) * 14, ny = y + Math.sin(ang) * 14;
        g.strokeStyle = grey(70);
        g.lineWidth = 3.4 * (1 - t) + 1;
        g.beginPath();
        g.moveTo(x, y);
        g.lineTo(nx, ny);
        g.stroke();
        x = nx;
        y = ny;
        ang += (R() - 0.5) * 0.18;
        if (t > 0.08) {
          for (const side of [-1, 1]) {
            const tl = (1 - t) * 80 + 26;
            const ta = ang + side * (0.95 + R() * 0.35);
            const ex = x + Math.cos(ta) * tl, ey = y + Math.sin(ta) * tl;
            g.strokeStyle = grey(85);
            g.lineWidth = 1.6;
            g.beginPath();
            g.moveTo(x, y);
            g.lineTo(ex, ey);
            g.stroke();
            for (let k = 0; k < 9; k++) {
              const f = k / 9, px = x + (ex - x) * f, py = y + (ey - y) * f;
              const v = 150 + R() * 90 + (1 - t) * 10;
              needle(px, py, ta + 0.7 + (R() - 0.5) * 0.4, 14 + R() * 12, v);
              needle(px, py, ta - 0.7 + (R() - 0.5) * 0.4, 14 + R() * 12, v);
            }
          }
        }
      }
    }
  } else {
    // black pine: dense tufts of long needles fanning out from a bunch
    for (let t = 0; t < 7; t++) {
      const cx = S * (0.15 + R() * 0.7), cy = S * (0.35 + R() * 0.55);
      const n = 150;
      for (let i = 0; i < n; i++) {
        const an = -Math.PI / 2 + (R() - 0.5) * 2.7, len = 50 + R() * 90;
        g.strokeStyle = grey(125 + R() * 120);
        g.lineWidth = 1.6;
        g.beginPath();
        g.moveTo(cx, cy);
        g.quadraticCurveTo(cx + Math.cos(an) * len * 0.5, cy + Math.sin(an) * len * 0.5 - 8, cx + Math.cos(an) * len, cy + Math.sin(an) * len + 6);
        g.stroke();
      }
      g.fillStyle = grey(60);
      g.beginPath();
      g.arc(cx, cy, 6, 0, 6.3);
      g.fill();
    }
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  cache.set(kind, t);
  return t;
}

// ----------------------------------------------------------------------------- foliage cards

/** Accumulates double-sided quads (two windings, one outward normal each, so lighting is right on both faces). */
class Cards {
  pos: number[] = [];
  nor: number[] = [];
  uv: number[] = [];
  col: number[] = [];
  constructor(private R: Rand) {}
  /** u, v: half-axes of the card; n: shading normal (outward from the crown); tint: linear colour. */
  add(c: THREE.Vector3, u: THREE.Vector3, v: THREE.Vector3, n: THREE.Vector3, tint: THREE.Color): void {
    const flip = this.R() < 0.5;
    const corners: [number, number][] = [[-1, -1], [1, -1], [1, 1], [-1, 1]];
    const k = 0.85 + this.R() * 0.3;
    const vtx = corners.map(([a, b]) => new THREE.Vector3().copy(c).addScaledVector(u, a).addScaledVector(v, b));
    const uvs = corners.map(([a, b]) => [(flip ? -a : a) * 0.5 + 0.5, b * 0.5 + 0.5]);
    for (const order of [[0, 1, 2, 0, 2, 3], [0, 2, 1, 0, 3, 2]]) {
      for (const i of order) {
        this.pos.push(vtx[i].x, vtx[i].y, vtx[i].z);
        this.nor.push(n.x, n.y, n.z);
        this.uv.push(uvs[i][0], uvs[i][1]);
        this.col.push(tint.r * k, tint.g * k, tint.b * k);
      }
    }
  }
  geometry(): THREE.BufferGeometry {
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(this.pos, 3));
    g.setAttribute("normal", new THREE.Float32BufferAttribute(this.nor, 3));
    g.setAttribute("uv", new THREE.Float32BufferAttribute(this.uv, 2));
    g.setAttribute("color", new THREE.Float32BufferAttribute(this.col, 3));
    return g;
  }
}

const UP = new THREE.Vector3(0, 1, 0);
const Y = new THREE.Vector3(0, 1, 0);

/** A tapered bark tube from a to b. */
function tube(bark: THREE.BufferGeometry[], a: THREE.Vector3, b: THREE.Vector3, ra: number, rb: number, tile = 3): void {
  const d = b.clone().sub(a);
  const len = d.length();
  if (len < 1e-3) return;
  const q = new THREE.Quaternion().setFromUnitVectors(Y, d.clone().divideScalar(len));
  const m = new THREE.Matrix4().compose(a.clone().lerp(b, 0.5), q, new THREE.Vector3(1, 1, 1));
  bark.push(tpiece(new THREE.CylinderGeometry(rb, ra, len, 7, 1, true), m, tile));
}

interface Grown {
  bark: THREE.BufferGeometry[];
  cards: Cards;
}

const rnd3 = (R: Rand, k = 1) => new THREE.Vector3((R() - 0.5) * k, (R() - 0.5) * k, (R() - 0.5) * k);

/** A cluster of cards round a point: random yaw and pitch so no flat side is obvious. */
function puff(cards: Cards, R: Rand, at: THREE.Vector3, crown: THREE.Vector3, size: number, n: number, tints: THREE.Color[], flat = 0): void {
  for (let i = 0; i < n; i++) {
    const yaw = R() * Math.PI * 2, pitch = flat ? (R() - 0.5) * flat : (R() - 0.5) * 2.2;
    const u = new THREE.Vector3(Math.cos(yaw), 0, Math.sin(yaw)).multiplyScalar(size * (0.5 + R() * 0.15));
    const w = new THREE.Vector3(-Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), Math.cos(yaw) * Math.cos(pitch)).multiplyScalar(size * 0.55);
    const c = at.clone().add(rnd3(R, size * 0.6));
    const n3 = c.clone().sub(crown).normalize().multiplyScalar(0.8).add(UP.clone().multiplyScalar(0.35)).normalize();
    cards.add(c, u, w, n3, tints[Math.floor(R() * tints.length)]);
  }
}

function growMaple(g: Grown, R: Rand, x: number, z: number, s: number, tints: THREE.Color[], kind: "maple" | "ginkgo" | "sakura"): void {
  const big = kind === "ginkgo";
  const sakura = kind === "sakura";
  const trunkH = (big ? 5.5 : sakura ? 1.9 + R() * 0.7 : 2.3 + R() * 0.8) * s;
  const base = new THREE.Vector3(x, -0.15, z);
  const top = new THREE.Vector3(x + (R() - 0.5) * 0.8 * s, trunkH, z + (R() - 0.5) * 0.8 * s);
  const rad = (big ? 0.95 : sakura ? 0.3 : 0.33) * s;
  const crown = new THREE.Vector3(x, trunkH + (big ? 6 : 2.2) * s, z);
  tube(g.bark, base, top, rad * 1.25, rad * 0.8);
  const leaf = (big ? 3.4 : sakura ? 2.0 : 2.0) * s;
  const grow = (from: THREE.Vector3, dir: THREE.Vector3, len: number, r: number, depth: number) => {
    const to = from.clone().addScaledVector(dir, len);
    tube(g.bark, from, to, r, r * 0.66);
    if (depth <= 1) puff(g.cards, R, to, crown, leaf, big ? 4 : sakura ? 4 : 5, tints);
    if (depth === 0) return;
    if (depth <= 2) puff(g.cards, R, from.clone().lerp(to, 0.55), crown, leaf * 0.9, 2, tints);
    const n = depth > 2 ? 3 : 3;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + R() * 1.4;
      // cherries spread wide and low (an umbrella); the others climb
      const d = dir.clone().multiplyScalar(0.9).add(new THREE.Vector3(Math.cos(a), sakura ? 0.02 + R() * 0.25 : 0.18 + R() * 0.4, Math.sin(a)).multiplyScalar(sakura ? 1.05 : 0.8)).normalize();
      grow(to, d, len * (0.72 + R() * 0.12), r * 0.6, depth - 1);
    }
  };
  const lim = big || sakura ? 4 : 3;
  const limbs = big ? 5 : sakura ? 4 : 3;
  for (let i = 0; i < limbs; i++) {
    const a = (i / limbs) * Math.PI * 2 + R();
    const d = new THREE.Vector3(Math.cos(a) * (sakura ? 1.0 : 0.75), sakura ? 0.65 : 0.9, Math.sin(a) * (sakura ? 1.0 : 0.75)).normalize();
    grow(top, d, (big ? 6 : sakura ? 2.1 : 2.5) * s * (0.85 + R() * 0.3), rad * (sakura ? 0.62 : 0.8), lim);
  }
}

function growCedar(g: Grown, R: Rand, x: number, z: number, s: number, tints: THREE.Color[]): void {
  const h = (21 + R() * 8) * s;
  const lean = new THREE.Vector3((R() - 0.5) * 0.5, 0, (R() - 0.5) * 0.5);
  const at = (y: number) => new THREE.Vector3(x + lean.x * (y / h) * s, y, z + lean.z * (y / h) * s);
  const seg = 5;
  for (let i = 0; i < seg; i++) {
    const y0 = (i / seg) * h, y1 = ((i + 1) / seg) * h;
    tube(g.bark, at(y0 - (i ? 0 : 0.2)), at(y1), (0.62 - 0.5 * (y0 / h)) * s, (0.62 - 0.5 * (y1 / h)) * s, 3.5);
  }
  tube(g.bark, at(-0.2), at(1.4), 0.85 * s, 0.6 * s, 3.5); // root flare
  const crown = at(h * 0.62);
  for (let y = h * 0.28; y < h * 0.98; y += 0.78 * s) {
    const t = (y - h * 0.28) / (h * 0.7);
    const len = (3.5 * Math.pow(1 - t, 0.75) + 0.9) * s;
    const nb = t < 0.5 ? 5 : 4;
    const a0 = R() * 6.28;
    for (let i = 0; i < nb; i++) {
      const a = a0 + (i / nb) * Math.PI * 2 + (R() - 0.5) * 0.4;
      const from = at(y);
      const dir = new THREE.Vector3(Math.cos(a), -0.18 - R() * 0.12, Math.sin(a));
      const tip = from.clone().addScaledVector(dir, len);
      tube(g.bark, from, tip, 0.07 * s, 0.03 * s, 1);
      const perp = new THREE.Vector3(-dir.z, 0, dir.x).normalize();
      for (const f of [0.55, 1.0]) {
        const c = from.clone().addScaledVector(dir, len * f).add(new THREE.Vector3(0, -0.25 * s, 0));
        const along = dir.clone().setY(-0.45).normalize().multiplyScalar(len * 0.55 + 0.6 * s);
        const n3 = c.clone().sub(crown).setY(0.25).normalize();
        const tint = tints[Math.floor(R() * tints.length)];
        g.cards.add(c, along, perp.clone().multiplyScalar(len * 0.48 + 0.55 * s), n3, tint);
        // a vertical card crossing it fills the crown out when seen from the side
        g.cards.add(c, along, UP.clone().multiplyScalar(len * 0.3 + 0.4 * s), n3, tint);
      }
    }
  }
  // the top: a thin spire of needles
  const topP = at(h);
  puff(g.cards, R, topP, crown, 1.8 * s, 3, tints);
}

function growPine(g: Grown, R: Rand, x: number, z: number, s: number, tints: THREE.Color[]): void {
  // a twisted trunk (S-curve), then 4 heavy limbs, each ending in a flat pad of needles
  const h = (7 + R() * 2.5) * s;
  const pts: THREE.Vector3[] = [];
  const sway = (R() < 0.5 ? -1 : 1) * 1.1 * s;
  for (let i = 0; i <= 6; i++) {
    const t = i / 6;
    pts.push(new THREE.Vector3(x + Math.sin(t * 5.2) * 0.55 * s + sway * t * t, t * h - 0.2, z + Math.cos(t * 4.1) * 0.35 * s));
  }
  for (let i = 0; i < 6; i++) tube(g.bark, pts[i], pts[i + 1], (0.62 - 0.38 * (i / 6)) * s, (0.62 - 0.38 * ((i + 1) / 6)) * s, 2.6);
  const crown = pts[5].clone();
  const pad = (c: THREE.Vector3, size: number) => {
    const sheet = (pitch: number, yaw: number, k: number) => {
      const u = new THREE.Vector3(Math.cos(yaw), 0, Math.sin(yaw)).multiplyScalar(size * k);
      const w = new THREE.Vector3(-Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), Math.cos(yaw) * Math.cos(pitch)).multiplyScalar(size * k * 0.9);
      g.cards.add(c.clone().add(new THREE.Vector3(0, 0.12 * size * R(), 0)), u, w, UP.clone().multiplyScalar(0.9).add(c.clone().sub(crown).normalize().multiplyScalar(0.4)).normalize(), tints[Math.floor(R() * tints.length)]);
    };
    for (let i = 0; i < 4; i++) sheet(0.18 + R() * 0.5, R() * 6.28, 0.62 + R() * 0.2);
    sheet(1.3, R() * 6.28, 0.5);
  };
  for (let i = 0; i < 5; i++) {
    const from = pts[2 + (i % 4)];
    const a = (i / 5) * Math.PI * 2 + R() * 0.8;
    const len = (2.6 + R() * 2.2) * s * (1 - 0.1 * i);
    const dir = new THREE.Vector3(Math.cos(a), 0.12 + R() * 0.18, Math.sin(a)).normalize();
    const mid = from.clone().addScaledVector(dir, len * 0.55).add(new THREE.Vector3(0, -0.2 * s, 0));
    const tip = mid.clone().addScaledVector(dir, len * 0.45).add(new THREE.Vector3(0, 0.55 * s, 0));
    tube(g.bark, from, mid, 0.2 * s, 0.14 * s, 2);
    tube(g.bark, mid, tip, 0.14 * s, 0.07 * s, 2);
    pad(tip, 2.6 * s);
    pad(mid.clone().lerp(tip, 0.2).add(new THREE.Vector3(0, 0.25 * s, 0)), 1.7 * s);
  }
  pad(pts[6].clone().add(new THREE.Vector3(0, 0.5 * s, 0)), 2.5 * s);
}

// ----------------------------------------------------------------------------- public

const PALETTE: Record<TreeKind, { bark: THREE.ColorRepresentation; leaf: string[]; rough: number }> = {
  cedar: { bark: 0xb09a86, leaf: ["#2b4c2f", "#33593a", "#264529", "#3d6340"], rough: 0.95 },
  maple: { bark: 0x8a7868, leaf: ["#c4301c", "#d8481a", "#e8841e", "#b02a1e", "#e6a428"], rough: 0.92 },
  pine: { bark: 0x7e6a5a, leaf: ["#3e6a3a", "#4a7a3e", "#355a34"], rough: 0.95 },
  ginkgo: { bark: 0x7a6a5c, leaf: ["#e8b82c", "#f2c93c", "#d9a424", "#e6b030"], rough: 0.92 },
  sakura: { bark: 0x5a4642, leaf: ["#f6c3cf", "#f2b2c3", "#fad4de", "#eda4b8"], rough: 0.9 },
};

export interface ForestOpts {
  /** Overrides the default leaf colours (maple: one hue per tree is picked from these). */
  leaf?: string[];
  /** Glow added to the foliage (a lit ginkgo in the mist). */
  glow?: number;
}

/** Grow one tree per spot [x, z, scale]. Returns bark + foliage meshes in a group. */
export function forest(kind: TreeKind, spots: Spot[], seed: number, o: ForestOpts = {}): THREE.Group {
  const R = rng(seed);
  const pal = PALETTE[kind];
  const lc = (o.leaf ?? pal.leaf).map((h) => new THREE.Color(h));
  const grown: Grown = { bark: [], cards: new Cards(R) };
  for (const [x, z, s] of spots) {
    // a maple wears one hue (± a neighbour) so the autumn reads as patches of colour, not confetti
    const i = Math.floor(R() * lc.length);
    const tints = kind === "maple" ? [lc[i], lc[i], lc[(i + 1) % lc.length]] : lc;
    if (kind === "cedar") growCedar(grown, R, x, z, s, tints);
    else if (kind === "pine") growPine(grown, R, x, z, s, tints);
    else growMaple(grown, R, x, z, s, tints, kind as "maple" | "ginkgo" | "sakura");
  }
  const group = new THREE.Group();
  const bark = new THREE.Mesh(tmerge(grown.bark), pbr("japanese_cedar_bark", { color: pal.bark, rough: pal.rough, side: THREE.DoubleSide }));
  group.add(bark);
  const leaves = new THREE.Mesh(
    grown.cards.geometry(),
    new THREE.MeshStandardMaterial({
      map: atlas(kind),
      vertexColors: true,
      alphaTest: 0.42,
      roughness: 0.85,
      metalness: 0,
      emissive: o.glow ? new THREE.Color(0.9, 0.5, 0.1) : new THREE.Color(0),
      emissiveMap: o.glow ? atlas(kind) : null,
      emissiveIntensity: o.glow ?? 0,
    }),
  );
  leaves.frustumCulled = false;
  bark.frustumCulled = false;
  group.add(leaves);
  return group;
}
