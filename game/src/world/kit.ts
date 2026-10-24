/**
 * Building blocks for the three arenas, all generated in code (no external models, so nothing to
 * download and the draw-call count stays tiny): merged vertex-coloured props, procedural textures,
 * the sky dome, distant ridges, wind-blown grass.
 */
import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { rng } from "../core/math";
import { canvasTexture } from "./materials";

export type Rand = () => number;

// ----------------------------------------------------------------------------- geometry helpers

const _q = new THREE.Quaternion();
const _e = new THREE.Euler();
const _p = new THREE.Vector3();
const _s = new THREE.Vector3();

/** Position / rotation (Euler XYZ) / scale as a matrix. */
export function xf(x: number, y: number, z: number, rx = 0, ry = 0, rz = 0, sx = 1, sy = sx, sz = sx): THREE.Matrix4 {
  return new THREE.Matrix4().compose(_p.set(x, y, z), _q.setFromEuler(_e.set(rx, ry, rz)), _s.set(sx, sy, sz));
}

/** A transformed, flat-coloured copy of `geo` (non-indexed, no uv) ready for mergeGeometries. */
export function piece(geo: THREE.BufferGeometry, color: THREE.ColorRepresentation, m?: THREE.Matrix4, jitter = 0, R?: Rand): THREE.BufferGeometry {
  const g = geo.index ? geo.toNonIndexed() : geo.clone();
  if (m) g.applyMatrix4(m);
  g.deleteAttribute("uv");
  const c = new THREE.Color(color);
  const n = g.attributes.position.count;
  const col = new Float32Array(n * 3);
  for (let i = 0; i < n; i += 3) {
    // one shade per triangle gives the faceted, hand-painted look
    const k = 1 + (jitter && R ? (R() - 0.5) * jitter : 0);
    for (let j = 0; j < 3; j++) {
      col[(i + j) * 3] = c.r * k;
      col[(i + j) * 3 + 1] = c.g * k;
      col[(i + j) * 3 + 2] = c.b * k;
    }
  }
  g.setAttribute("color", new THREE.BufferAttribute(col, 3));
  return g;
}

export function merge(parts: THREE.BufferGeometry[]): THREE.BufferGeometry {
  const g = mergeGeometries(parts, false);
  if (!g) throw new Error("merge failed");
  g.computeVertexNormals();
  return g;
}

/** A lumpy icosphere (foliage, boulders). The lump is a smooth function of position, so corners shared by triangles move together (no cracks). */
export function blob(radius: number, detail: number, R: Rand, lump = 0.22): THREE.BufferGeometry {
  const g = new THREE.IcosahedronGeometry(radius, detail);
  const p = g.attributes.position;
  const a = R() * 10, b = R() * 10, c = R() * 10;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i) / radius, y = p.getY(i) / radius, z = p.getZ(i) / radius;
    const n = Math.sin(x * 2.3 + a) * Math.sin(y * 2.1 + b) + Math.sin(z * 2.7 + c) * 0.7 + Math.sin((x + y + z) * 3.7 + a) * 0.4;
    const k = 1 + n * 0.5 * lump;
    p.setXYZ(i, p.getX(i) * k, p.getY(i) * k, p.getZ(i) * k);
  }
  return g;
}

export const matVC = (rough = 0.9, extra: THREE.MeshStandardMaterialParameters = {}) =>
  new THREE.MeshStandardMaterial({ vertexColors: true, roughness: rough, metalness: 0, flatShading: true, ...extra });

// ----------------------------------------------------------------------------- textures

const noise = (R: Rand, g: CanvasRenderingContext2D, w: number, h: number, n: number, a: number, light = 255): void => {
  for (let i = 0; i < n; i++) {
    const v = Math.floor(R() * 255);
    g.fillStyle = `rgba(${light === 255 ? v : light},${light === 255 ? v : light},${light === 255 ? v : light},${a * R()})`;
    g.fillRect(R() * w, R() * h, 1 + R() * 2, 1 + R() * 2);
  }
};

/** Raked white gravel with concentric combed lines and moss patches (UV is a disc: centre at 0.5). */
export function gravelTexture(): THREE.CanvasTexture {
  return canvasTexture(1024, 1024, (g, w, h) => {
    const R = rng(7);
    g.fillStyle = "#c9c1b0";
    g.fillRect(0, 0, w, h);
    noise(R, g, w, h, 26000, 0.22);
    g.lineWidth = 2;
    for (let r = 14; r < w * 0.5; r += 11) {
      g.strokeStyle = "rgba(60,52,44,0.13)";
      g.beginPath();
      g.arc(w / 2, h / 2, r, 0, Math.PI * 2);
      g.stroke();
      g.strokeStyle = "rgba(255,250,240,0.16)";
      g.beginPath();
      g.arc(w / 2, h / 2, r + 4, 0, Math.PI * 2);
      g.stroke();
    }
    for (let i = 0; i < 90; i++) {
      const x = R() * w, y = R() * h, r = 8 + R() * 34;
      const gr = g.createRadialGradient(x, y, 0, x, y, r);
      gr.addColorStop(0, "rgba(86,98,58,0.5)");
      gr.addColorStop(1, "rgba(86,98,58,0)");
      g.fillStyle = gr;
      g.fillRect(x - r, y - r, r * 2, r * 2);
    }
    // darker rim where the gravel meets the stone border
    const rim = g.createRadialGradient(w / 2, h / 2, w * 0.4, w / 2, h / 2, w * 0.5);
    rim.addColorStop(0, "rgba(40,34,28,0)");
    rim.addColorStop(1, "rgba(40,34,28,0.5)");
    g.fillStyle = rim;
    g.fillRect(0, 0, w, h);
  });
}

/** Trampled pale earth in the middle fading to meadow green at the edge (UV is a disc). */
export function meadowTexture(): THREE.CanvasTexture {
  return canvasTexture(1024, 1024, (g, w, h) => {
    const R = rng(11);
    const gr = g.createRadialGradient(w / 2, h / 2, w * 0.08, w / 2, h / 2, w * 0.5);
    gr.addColorStop(0, "#a88f62");
    gr.addColorStop(0.36, "#98884f");
    gr.addColorStop(0.6, "#7f873c");
    gr.addColorStop(1, "#66782f");
    g.fillStyle = gr;
    g.fillRect(0, 0, w, h);
    noise(R, g, w, h, 30000, 0.2);
    for (let i = 0; i < 160; i++) {
      // worn footpaths and dry tufts
      g.strokeStyle = `rgba(${R() < 0.5 ? "120,100,60" : "190,170,120"},0.12)`;
      g.lineWidth = 1 + R() * 4;
      g.beginPath();
      const x = R() * w, y = R() * h;
      g.moveTo(x, y);
      g.lineTo(x + (R() - 0.5) * 120, y + (R() - 0.5) * 120);
      g.stroke();
    }
  });
}

/** Cracked dark flagstones; the second texture is the golden inlay ring and runes (emissive). */
export function sanctumTextures(): { map: THREE.CanvasTexture; glow: THREE.CanvasTexture } {
  const R = rng(23);
  const map = canvasTexture(1024, 1024, (g, w, h) => {
    g.fillStyle = "#3c4258";
    g.fillRect(0, 0, w, h);
    const cell = 64;
    for (let y = 0; y < h; y += cell)
      for (let x = 0; x < w; x += cell) {
        const jx = (R() - 0.5) * 18, jy = (R() - 0.5) * 18;
        const v = 70 + R() * 26;
        g.fillStyle = `rgb(${v},${v + 6},${v + 24})`;
        g.fillRect(x + 3 + jx, y + 3 + jy, cell - 6, cell - 6);
      }
    noise(R, g, w, h, 22000, 0.18);
    g.strokeStyle = "rgba(0,0,0,0.5)";
    for (let i = 0; i < 70; i++) {
      g.lineWidth = 1 + R() * 2;
      g.beginPath();
      let x = R() * w, y = R() * h;
      g.moveTo(x, y);
      for (let k = 0; k < 6; k++) g.lineTo((x += (R() - 0.5) * 70), (y += (R() - 0.5) * 70));
      g.stroke();
    }
    const v = g.createRadialGradient(w / 2, h / 2, w * 0.3, w / 2, h / 2, w * 0.5);
    v.addColorStop(0, "rgba(0,0,0,0)");
    v.addColorStop(1, "rgba(0,0,10,0.55)");
    g.fillStyle = v;
    g.fillRect(0, 0, w, h);
  });
  const glow = canvasTexture(1024, 1024, (g, w, h) => {
    g.fillStyle = "#000";
    g.fillRect(0, 0, w, h);
    g.strokeStyle = "#ffcf6a";
    g.lineWidth = 7;
    for (const r of [0.37, 0.47]) {
      g.beginPath();
      g.arc(w / 2, h / 2, w * r, 0, Math.PI * 2);
      g.stroke();
    }
    g.lineWidth = 4;
    // runes: short ticks and chevrons around the ring
    for (let i = 0; i < 48; i++) {
      const a = (i / 48) * Math.PI * 2;
      const r0 = w * 0.385, r1 = w * (0.405 + (i % 3) * 0.012);
      g.beginPath();
      g.moveTo(w / 2 + Math.cos(a) * r0, h / 2 + Math.sin(a) * r0);
      g.lineTo(w / 2 + Math.cos(a) * r1, h / 2 + Math.sin(a) * r1);
      g.stroke();
    }
    g.lineWidth = 3;
    g.beginPath();
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
      g.moveTo(w / 2, h / 2);
      g.lineTo(w / 2 + Math.cos(a) * w * 0.36, h / 2 + Math.sin(a) * w * 0.36);
    }
    g.stroke();
  });
  return { map, glow };
}

export function mistTexture(): THREE.CanvasTexture {
  return canvasTexture(
    512,
    512,
    (g, w, h) => {
      const R = rng(5);
      g.clearRect(0, 0, w, h);
      for (let i = 0; i < 70; i++) {
        const x = R() * w, y = R() * h, r = 40 + R() * 110;
        const gr = g.createRadialGradient(x, y, 0, x, y, r);
        gr.addColorStop(0, "rgba(255,255,255,0.16)");
        gr.addColorStop(1, "rgba(255,255,255,0)");
        g.fillStyle = gr;
        g.fillRect(x - r, y - r, r * 2, r * 2);
      }
    },
    false,
  );
}

// ----------------------------------------------------------------------------- sky

export interface SkySpec {
  sun: THREE.Vector3;
  top: THREE.ColorRepresentation;
  mid: THREE.ColorRepresentation;
  horizon: THREE.ColorRepresentation;
  sunColor: THREE.ColorRepresentation;
  /** 0 hides the disc. */
  disc: number;
  glow: number;
  cloudLit: THREE.ColorRepresentation;
  cloudDark: THREE.ColorRepresentation;
  cloudAmount: number;
  stars: number;
}

const SKY_FRAG = /* glsl */ `
uniform vec3 uSun; uniform vec3 uTop; uniform vec3 uMid; uniform vec3 uHor; uniform vec3 uSunCol;
uniform float uDisc; uniform float uGlow; uniform vec3 uCloudLit; uniform vec3 uCloudDark; uniform float uCloud; uniform float uStars; uniform float uTime;
varying vec3 vDir;
float h21(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float n2(vec2 p) { vec2 i = floor(p); vec2 f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(h21(i), h21(i + vec2(1, 0)), f.x), mix(h21(i + vec2(0, 1)), h21(i + vec2(1, 1)), f.x), f.y); }
float fbm(vec2 p) { float a = 0.5, s = 0.0; for (int i = 0; i < 4; i++) { s += a * n2(p); p *= 2.03; a *= 0.5; } return s; }
void main() {
  vec3 d = normalize(vDir);
  float y = d.y;
  float s = max(dot(d, uSun), 0.0);
  vec3 c = mix(uHor, uMid, smoothstep(0.0, 0.22, y));
  c = mix(c, uTop, smoothstep(0.18, 0.85, y));
  c += uSunCol * (pow(s, 5.0) * 0.28 * uGlow + pow(s, 28.0) * 0.55 * uGlow);
  if (uDisc > 0.0) c = mix(c, uSunCol * uDisc, smoothstep(0.9972, 0.9978, s));
  if (uCloud > 0.0 && y > 0.0) {
    vec2 q = d.xz / (y + 0.18) * 0.9 + vec2(uTime * 0.004, 0.0);
    float cl = fbm(q * 1.3) * 0.65 + fbm(q * 3.1 + 4.0) * 0.35;
    cl = smoothstep(0.42, 0.82, cl) * smoothstep(0.0, 0.1, y) * (1.0 - smoothstep(0.55, 0.95, y)) * uCloud;
    vec3 cc = mix(uCloudDark, uCloudLit, clamp(pow(s, 2.0) * 1.6 + 0.2, 0.0, 1.0));
    c = mix(c, cc, cl);
  }
  if (uStars > 0.0) {
    vec3 g = floor(d * 260.0);
    float h = fract(sin(dot(g, vec3(12.9898, 78.233, 37.719))) * 43758.5453);
    c += vec3(0.9, 0.95, 1.2) * step(0.9975, h) * smoothstep(0.08, 0.4, y) * uStars;
  }
  c = mix(c, uHor, 1.0 - smoothstep(-0.02, 0.08, y));
  gl_FragColor = vec4(c, 1.0);
}`;

export function makeSky(): THREE.Mesh<THREE.SphereGeometry, THREE.ShaderMaterial> {
  const mat = new THREE.ShaderMaterial({
    uniforms: {
      uSun: { value: new THREE.Vector3(0, 0.2, -1) },
      uTop: { value: new THREE.Color() },
      uMid: { value: new THREE.Color() },
      uHor: { value: new THREE.Color() },
      uSunCol: { value: new THREE.Color() },
      uDisc: { value: 0 },
      uGlow: { value: 1 },
      uCloudLit: { value: new THREE.Color() },
      uCloudDark: { value: new THREE.Color() },
      uCloud: { value: 0 },
      uStars: { value: 0 },
      uTime: { value: 0 },
    },
    vertexShader: /* glsl */ `varying vec3 vDir; void main() { vDir = normalize(position); vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0); gl_Position = p.xyww; }`,
    fragmentShader: SKY_FRAG,
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
  });
  const m = new THREE.Mesh(new THREE.SphereGeometry(1500, 40, 20), mat);
  m.renderOrder = -10;
  m.frustumCulled = false;
  return m;
}

export function setSky(m: THREE.Mesh<THREE.SphereGeometry, THREE.ShaderMaterial>, s: SkySpec): void {
  const u = m.material.uniforms;
  u.uSun.value.copy(s.sun).normalize();
  (u.uTop.value as THREE.Color).set(s.top);
  (u.uMid.value as THREE.Color).set(s.mid);
  (u.uHor.value as THREE.Color).set(s.horizon);
  (u.uSunCol.value as THREE.Color).set(s.sunColor);
  u.uDisc.value = s.disc;
  u.uGlow.value = s.glow;
  (u.uCloudLit.value as THREE.Color).set(s.cloudLit);
  (u.uCloudDark.value as THREE.Color).set(s.cloudDark);
  u.uCloud.value = s.cloudAmount;
  u.uStars.value = s.stars;
}

// ----------------------------------------------------------------------------- distant ridges

export interface RidgeLayer {
  radius: number;
  height: number;
  base: number;
  color: THREE.ColorRepresentation;
  /** 0..1 how much of the fog colour is mixed in (atmospheric depth). */
  haze: number;
  seed: number;
  jag?: number;
}

/** Rings of silhouette ridges around the arena, fading into the fog colour with distance. */
export function ridges(layers: RidgeLayer[], fog: THREE.ColorRepresentation): THREE.Group {
  const g = new THREE.Group();
  for (const L of layers) {
    const N = 220;
    const pos: number[] = [];
    const idx: number[] = [];
    const R = rng(L.seed);
    const ph = [R() * 6, R() * 6, R() * 6, R() * 6];
    for (let i = 0; i <= N; i++) {
      const a = (i / N) * Math.PI * 2;
      const h = Math.sin(a * 3 + ph[0]) * 0.35 + Math.sin(a * 7 + ph[1]) * 0.25 + Math.abs(Math.sin(a * 13 + ph[2])) * 0.25 * (L.jag ?? 1) + Math.sin(a * 29 + ph[3]) * 0.06;
      const y = L.base + (0.4 + h * 0.6) * L.height;
      const x = Math.sin(a) * L.radius, z = Math.cos(a) * L.radius;
      pos.push(x, -80, z, x, y, z);
    }
    for (let i = 0; i < N; i++) {
      const a = i * 2;
      idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
    geo.setIndex(idx);
    const body = new THREE.Color(L.color);
    const mist = new THREE.Color(fog);
    const mat = new THREE.MeshBasicMaterial({ color: body.lerp(mist, L.haze), side: THREE.DoubleSide, fog: false });
    const m = new THREE.Mesh(geo, mat);
    m.frustumCulled = false;
    g.add(m);
  }
  return g;
}

// ----------------------------------------------------------------------------- grass

export interface GrassOpts {
  count: number;
  rMin: number;
  rMax: number;
  hMin: number;
  hMax: number;
  low: THREE.ColorRepresentation;
  high: THREE.ColorRepresentation;
  tip: THREE.ColorRepresentation;
  seed: number;
  /** Keep blades out of this disc (the duel ring). */
  hole?: number;
}

/**
 * A tuft of five thin blades, 1 unit tall: each tapers to a point, curves outward as it rises, and
 * leans its own way. Normals point mostly up so a tuft lights like the field, never as flat cards.
 */
function grassTuft(R: Rand): THREE.BufferGeometry {
  const pos: number[] = [];
  const nor: number[] = [];
  const idx: number[] = [];
  const SEG = 3;
  for (let b = 0; b < 5; b++) {
    const yaw = (b / 5) * Math.PI * 2 + R() * 0.9;
    const lean = 0.1 + R() * 0.45;
    const len = 0.65 + R() * 0.35;
    const w = 0.022 + R() * 0.014;
    const dx = Math.cos(yaw), dz = Math.sin(yaw);
    const ox = (R() - 0.5) * 0.22, oz = (R() - 0.5) * 0.22;
    const base = pos.length / 3;
    for (let i = 0; i <= SEG; i++) {
      const t = i / SEG;
      const y = t * len;
      const out = lean * t * t;
      const hw = i === SEG ? 0 : w * (1 - t * 0.85);
      // the blade's width runs across its lean direction
      const px = ox + dx * out, pz = oz + dz * out;
      pos.push(px - dz * hw, y, pz + dx * hw, px + dz * hw, y, pz - dx * hw);
      const n = new THREE.Vector3(dx * 0.35, 1, dz * 0.35).normalize();
      nor.push(n.x, n.y, n.z, n.x, n.y, n.z);
    }
    for (let i = 0; i < SEG; i++) {
      const a = base + i * 2;
      if (i < SEG - 1) idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
      else idx.push(a, a + 1, a + 2);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute("normal", new THREE.Float32BufferAttribute(nor, 3));
  g.setIndex(idx);
  return g;
}

/** Wind-blown blades, one draw call. Time and wind are shared uniforms the arena updates. */
export function grassField(o: GrassOpts, uniforms: { uTime: { value: number }; uWind: { value: number } }): THREE.InstancedMesh {
  const blade = grassTuft(rng(o.seed + 99));
  const mat = new THREE.MeshStandardMaterial({ roughness: 0.95, side: THREE.DoubleSide });
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.uTime = uniforms.uTime;
    sh.uniforms.uWind = uniforms.uWind;
    sh.vertexShader = sh.vertexShader
      .replace("#include <common>", "#include <common>\nuniform float uTime; uniform float uWind;\nvarying float vH;")
      .replace(
        "#include <begin_vertex>",
        `#include <begin_vertex>
        vH = position.y;
        float ph = instanceMatrix[3].x * 0.31 + instanceMatrix[3].z * 0.23;
        float sw = sin(uTime * 1.7 + ph) * 0.5 + sin(uTime * 3.1 + ph * 2.3) * 0.22;
        float gust = sin(uTime * 0.45 + instanceMatrix[3].x * 0.05 - instanceMatrix[3].z * 0.04) * 0.5 + 0.5;
        transformed.x += (sw * 0.35 + gust * 0.55 * uWind) * position.y * position.y * 0.6;
        transformed.z += sw * 0.12 * position.y * position.y;`,
      );
    sh.fragmentShader = sh.fragmentShader.replace("#include <common>", "#include <common>\nvarying float vH;").replace("#include <color_fragment>", "#include <color_fragment>\ndiffuseColor.rgb *= mix(0.62, 1.1, smoothstep(0.0, 0.8, vH));");
  };
  mat.customProgramCacheKey = () => "grass-wind";
  const mesh = new THREE.InstancedMesh(blade, mat, o.count);
  const R = rng(o.seed);
  const lo = new THREE.Color(o.low), hi = new THREE.Color(o.high), tip = new THREE.Color(o.tip);
  const c = new THREE.Color();
  const mtx = new THREE.Matrix4();
  for (let i = 0; i < o.count; i++) {
    const r = Math.sqrt(o.rMin * o.rMin + R() * (o.rMax * o.rMax - o.rMin * o.rMin));
    const a = R() * Math.PI * 2;
    if (o.hole && r < o.hole) {
      mtx.makeScale(0, 0, 0);
    } else {
      const t = (r - o.rMin) / (o.rMax - o.rMin);
      const h = (o.hMin + (o.hMax - o.hMin) * Math.min(1, t * 1.4)) * (0.6 + R() * 0.8);
      const w = 0.9 + R() * 0.9;
      mtx.compose(_p.set(Math.cos(a) * r, 0, Math.sin(a) * r), _q.setFromEuler(_e.set(0, R() * Math.PI * 2, (R() - 0.5) * 0.2)), _s.set(w, h, w));
    }
    mesh.setMatrixAt(i, mtx);
    c.copy(lo).lerp(hi, R()).lerp(tip, R() < 0.35 ? 0.5 + R() * 0.5 : 0);
    mesh.setColorAt(i, c);
  }
  mesh.frustumCulled = false;
  return mesh;
}

export const glowSprite = (color: string, scale: number, opacity = 1): THREE.Sprite => {
  const tex = canvasTexture(
    128,
    128,
    (g, w, h) => {
      const gr = g.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
      gr.addColorStop(0, color);
      gr.addColorStop(0.3, color.replace(/[\d.]+\)$/, "0.35)"));
      gr.addColorStop(1, color.replace(/[\d.]+\)$/, "0)"));
      g.fillStyle = gr;
      g.fillRect(0, 0, w, h);
    },
    false,
  );
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, fog: false, opacity }));
  s.scale.setScalar(scale);
  return s;
};

// ----------------------------------------------------------------------------- textured pieces

/** A transformed copy of `geo` with box-projected UVs (1 unit of uv = `tile` metres), for photo-textured props. */
export function tpiece(geo: THREE.BufferGeometry, m: THREE.Matrix4, tile = 2): THREE.BufferGeometry {
  const g = geo.index ? geo.toNonIndexed() : geo.clone();
  g.applyMatrix4(m);
  g.deleteAttribute("uv");
  g.deleteAttribute("color");
  g.computeVertexNormals();
  const p = g.attributes.position, n = g.attributes.normal;
  const uv = new Float32Array(p.count * 2);
  for (let i = 0; i < p.count; i++) {
    const ax = Math.abs(n.getX(i)), ay = Math.abs(n.getY(i)), az = Math.abs(n.getZ(i));
    const [u, v] = ay >= ax && ay >= az ? [p.getX(i), p.getZ(i)] : ax >= az ? [p.getZ(i), p.getY(i)] : [p.getX(i), p.getY(i)];
    uv[i * 2] = u / tile;
    uv[i * 2 + 1] = v / tile;
  }
  g.setAttribute("uv", new THREE.BufferAttribute(uv, 2));
  return g;
}

/** Merge tpieces (same attribute set) into one mesh geometry. */
export function tmerge(parts: THREE.BufferGeometry[]): THREE.BufferGeometry {
  const g = mergeGeometries(parts, false);
  if (!g) throw new Error("merge failed");
  return g;
}

/** Ground that rolls: a flat XY geometry (rotate it -90deg about X afterwards) gets planar uv and a height from smooth noise outside `flatR`. */
export function terrainGeo(geo: THREE.BufferGeometry, tile: number, flatR: number, amp: number, seed: number): THREE.BufferGeometry {
  const p = geo.attributes.position;
  const uv = new Float32Array(p.count * 2);
  const R = rng(seed);
  const a = R() * 9, b = R() * 9, c = R() * 9;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i);
    uv[i * 2] = x / tile;
    uv[i * 2 + 1] = y / tile;
    const r = Math.hypot(x, y);
    const t = THREE.MathUtils.smoothstep(r, flatR, flatR + 26);
    const h = Math.sin(x * 0.045 + a) * Math.cos(y * 0.05 + b) + Math.sin((x + y) * 0.11 + c) * 0.45 + Math.sin(x * 0.2 + y * 0.17) * 0.12;
    p.setZ(i, h * amp * t);
  }
  geo.setAttribute("uv", new THREE.BufferAttribute(uv, 2));
  geo.computeVertexNormals();
  return geo;
}
