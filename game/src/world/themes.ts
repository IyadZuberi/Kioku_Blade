/**
 * The three arenas of Kioku, each a different place and mood (all built in code):
 *   1  Maple Shrine Garden   raked gravel ring under red maples, a torii and a small shrine (late afternoon)
 *   2  Pampas Cliff          windblown golden grass on a headland over a pale sea (overcast, cold gold)
 *   3  Hollow Sanctum        a cracked stone platform ringed with broken pillars, a dead tree that glows (night)
 * Moods are borrowed (Japanese temple gardens, Tsushima's grass and wind, Elden Ring's gold-lit ruins);
 * every shape, texture and palette here is our own.
 */
import * as THREE from "three";
import { rng } from "../core/math";
import type { ParticleKind } from "../fx/Snow";
import type { QualitySettings } from "../render/quality";
import {
  blob,
  glowSprite,
  grassField,
  gravelTexture,
  matVC,
  meadowTexture,
  merge,
  mistTexture,
  piece,
  ridges,
  sanctumTextures,
  xf,
  type SkySpec,
} from "./kit";

export const ARENA_R = 16.5;
export type ThemeId = 1 | 2 | 3;

export interface ThemeSpec {
  id: ThemeId;
  name: string;
  /** One line shown on the chapter card. */
  line: string;
  group: THREE.Group;
  fog: { color: number; density: number };
  key: { color: number; intensity: number; dir: THREE.Vector3 };
  fill: { color: number; intensity: number; dir: THREE.Vector3 };
  hemi: { sky: number; ground: number; intensity: number };
  sky: SkySpec;
  sunMesh: { color: number; at: THREE.Vector3 };
  particles: ParticleKind;
  /** Post-process look. */
  look: { exposure: number; bloom: number; rays: number; gain: [number, number, number] };
  update(t: number, wind: number): void;
}

const v3 = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z).normalize();
/** Where the light comes from (azimuth shared by all three arenas: from the left, behind the boss's shoulder). */
const FAR_LEFT = v3(-0.86, 0.14, -0.49);

const ground = (geo: THREE.BufferGeometry, mat: THREE.Material, y = 0): THREE.Mesh => {
  const m = new THREE.Mesh(geo, mat);
  m.rotation.x = -Math.PI / 2;
  m.position.y = y;
  m.receiveShadow = true;
  return m;
};

// ============================================================================ 1: maple shrine garden

function toro(R: () => number): { group: THREE.Group; glow: THREE.MeshStandardMaterial } {
  const stone = new THREE.Color("#7d8078");
  const parts = [
    piece(new THREE.CylinderGeometry(0.5, 0.62, 0.25, 8), stone, xf(0, 0.12, 0), 0.12, R),
    piece(new THREE.CylinderGeometry(0.17, 0.2, 1.05, 8), stone, xf(0, 0.78, 0), 0.12, R),
    piece(new THREE.CylinderGeometry(0.42, 0.34, 0.2, 8), stone, xf(0, 1.4, 0), 0.12, R),
    piece(new THREE.BoxGeometry(0.62, 0.1, 0.62), stone, xf(0, 1.78, 0), 0.1, R),
    piece(new THREE.ConeGeometry(0.62, 0.42, 4), stone, xf(0, 2.1, 0, 0, Math.PI / 4, 0), 0.1, R),
    piece(new THREE.SphereGeometry(0.1, 6, 4), stone, xf(0, 2.38, 0)),
  ];
  const group = new THREE.Group();
  group.add(new THREE.Mesh(merge(parts), matVC(0.95)));
  const glow = new THREE.MeshStandardMaterial({ color: 0x2a1a10, emissive: new THREE.Color(1.0, 0.55, 0.2), emissiveIntensity: 3, roughness: 1 });
  const box = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.3, 0.34), glow);
  box.position.y = 1.58;
  group.add(box);
  const halo = glowSprite("rgba(255,170,80,1)", 2.2, 0.7);
  halo.position.y = 1.6;
  group.add(halo);
  return { group, glow };
}

function torii(R: () => number): THREE.Mesh {
  const red = "#b8331f", black = "#17110f";
  const parts = [
    piece(new THREE.CylinderGeometry(0.3, 0.36, 6.4, 10), red, xf(-3.1, 3.2, 0), 0.05, R),
    piece(new THREE.CylinderGeometry(0.3, 0.36, 6.4, 10), red, xf(3.1, 3.2, 0), 0.05, R),
    piece(new THREE.BoxGeometry(8.9, 0.34, 0.5), red, xf(0, 5.0, 0)),
    piece(new THREE.BoxGeometry(10.6, 0.5, 0.95), black, xf(0, 6.55, 0), 0.05, R),
    piece(new THREE.BoxGeometry(0.9, 0.4, 0.95), black, xf(-5.1, 6.8, 0, 0, 0, 0.35)),
    piece(new THREE.BoxGeometry(0.9, 0.4, 0.95), black, xf(5.1, 6.8, 0, 0, 0, -0.35)),
    piece(new THREE.BoxGeometry(9.6, 0.3, 0.7), red, xf(0, 6.1, 0)),
    piece(new THREE.BoxGeometry(0.2, 1.1, 0.35), red, xf(0, 5.55, 0)),
  ];
  const m = new THREE.Mesh(merge(parts), matVC(0.7));
  return m;
}

function shrineHall(R: () => number): THREE.Mesh {
  const stone = "#6c6a62", wood = "#4a2f22", plaster = "#cbbfa6", roof = "#2b2a30", trim = "#a8321e";
  const parts = [
    piece(new THREE.BoxGeometry(15, 1.0, 8), stone, xf(0, 0.5, 0), 0.08, R),
    piece(new THREE.BoxGeometry(6, 0.5, 3), stone, xf(0, 0.25, 5), 0.08, R),
    piece(new THREE.BoxGeometry(11.2, 3.6, 5.2), plaster, xf(0, 2.8, 0)),
    piece(new THREE.BoxGeometry(11.6, 0.35, 5.6), wood, xf(0, 1.15, 0)),
    piece(new THREE.BoxGeometry(11.6, 0.35, 5.6), wood, xf(0, 4.55, 0)),
    // swept roof: two slabs meeting at the ridge, a deep eave, red trim along the edge
    piece(new THREE.BoxGeometry(15.4, 0.45, 5.6), roof, xf(0, 6.15, 2.5, -0.5, 0, 0)),
    piece(new THREE.BoxGeometry(15.4, 0.45, 5.6), roof, xf(0, 6.15, -2.5, 0.5, 0, 0)),
    piece(new THREE.BoxGeometry(15.8, 0.38, 0.5), trim, xf(0, 7.0, 0)),
    piece(new THREE.BoxGeometry(15.4, 0.18, 0.3), trim, xf(0, 4.9, 4.65)),
  ];
  for (let i = 0; i < 6; i++) parts.push(piece(new THREE.CylinderGeometry(0.28, 0.3, 3.6, 8), trim, xf(-4.8 + i * 1.92, 2.8, 3.1), 0.05, R));
  return new THREE.Mesh(merge(parts), matVC(0.85));
}

function mapleGrove(R: () => number): THREE.Mesh {
  const parts: THREE.BufferGeometry[] = [];
  const hues = ["#a8281c", "#c0401c", "#d86a1c", "#b02a20", "#cf8a20"];
  const place = (x: number, z: number, s: number) => {
    const hue = hues[Math.floor(R() * hues.length)];
    const ry = R() * 6;
    parts.push(piece(new THREE.CylinderGeometry(0.16 * s, 0.34 * s, 3.4 * s, 7), "#3b2a20", xf(x, 1.7 * s, z, 0, ry, 0)));
    parts.push(piece(new THREE.CylinderGeometry(0.07 * s, 0.14 * s, 2.2 * s, 6), "#3b2a20", xf(x + 0.8 * s, 3.6 * s, z, 0, 0, -0.6)));
    parts.push(piece(new THREE.CylinderGeometry(0.07 * s, 0.14 * s, 2.0 * s, 6), "#3b2a20", xf(x - 0.8 * s, 3.5 * s, z + 0.3 * s, 0, 0, 0.6)));
    for (let k = 0; k < 6; k++) {
      const a = (k / 6) * Math.PI * 2 + R();
      const rr = k === 0 ? 0 : (1.1 + R() * 0.8) * s;
      const g = blob((1.5 + R() * 0.8) * s, 1, R);
      parts.push(piece(g, hue, xf(x + Math.cos(a) * rr, (4.4 + R() * 1.4) * s, z + Math.sin(a) * rr, 0, 0, 0, 1, 0.72, 1), 0.34, R));
    }
  };
  for (let i = 0; i < 17; i++) {
    const a = Math.PI + (R() - 0.5) * 2.7;
    const r = 24 + R() * 20;
    place(Math.sin(a) * r, Math.cos(a) * r - 6, 1.1 + R() * 0.7);
  }
  // nearer trees close the left and right edges of the ring
  for (const side of [-1, 1]) for (let i = 0; i < 3; i++) place(side * (20.5 + R() * 3), -9 + i * 6 + R() * 2, 0.95 + R() * 0.25);
  return new THREE.Mesh(merge(parts), matVC(0.9));
}

function buildMaple(): ThemeSpec {
  const R = rng(101);
  const group = new THREE.Group();
  group.add(ground(new THREE.CircleGeometry(ARENA_R, 72), new THREE.MeshStandardMaterial({ map: gravelTexture(), roughness: 1 })));
  // moss-brown litter beyond the gravel
  const litter = ground(new THREE.CircleGeometry(150, 40), new THREE.MeshStandardMaterial({ color: 0x5c4a2c, roughness: 1 }), -0.06);
  litter.receiveShadow = false;
  group.add(litter);
  // stone border: a ring of low rounded stones
  const border: THREE.BufferGeometry[] = [];
  for (let i = 0; i < 64; i++) {
    const a = (i / 64) * Math.PI * 2;
    border.push(piece(blob(0.55 + R() * 0.2, 1, R, 0.3), "#6b675c", xf(Math.cos(a) * (ARENA_R + 0.4), 0.12, Math.sin(a) * (ARENA_R + 0.4), 0, 0, 0, 1.15, 0.5, 0.9), 0.2, R));
  }
  group.add(new THREE.Mesh(merge(border), matVC(1)));
  // stepping stones from the ring to the shrine
  const steps: THREE.BufferGeometry[] = [];
  for (let i = 0; i < 6; i++) steps.push(piece(new THREE.CylinderGeometry(0.75, 0.8, 0.14, 9), "#8d887a", xf((R() - 0.5) * 0.5, 0.05, -17.8 - i * 1.55), 0.12, R));
  group.add(new THREE.Mesh(merge(steps), matVC(1)));
  const hall = shrineHall(R);
  hall.position.set(0, 0, -31);
  group.add(hall);
  const t1 = torii(R);
  t1.position.set(-13, 0, -19);
  t1.rotation.y = 0.5;
  group.add(t1);
  const t2 = torii(R);
  t2.scale.setScalar(0.7);
  t2.position.set(15.5, 0, -27);
  t2.rotation.y = -0.3;
  group.add(t2);
  const lamps: THREE.MeshStandardMaterial[] = [];
  for (const [x, z] of [[-8.6, -11.5], [8.6, -11.5], [-14.5, 1], [14.5, 1]] as const) {
    const l = toro(R);
    l.group.position.set(x, 0, z);
    l.group.scale.setScalar(1.25);
    group.add(l.group);
    lamps.push(l.glow);
  }
  group.add(mapleGrove(R));
  group.add(
    ridges(
      [
        { radius: 380, height: 120, base: 10, color: 0x4a2f3a, haze: 0.62, seed: 4 },
        { radius: 230, height: 70, base: 4, color: 0x3a2a30, haze: 0.4, seed: 9, jag: 0.6 },
      ],
      0xe8c09a,
    ),
  );
  return {
    id: 1,
    name: "Maple Shrine Garden",
    line: "Late afternoon. The leaves have started to fall.",
    group,
    fog: { color: 0xe4bd98, density: 0.0085 },
    key: { color: 0xffc784, intensity: 3.3, dir: v3(-0.7, 0.42, -0.25) },
    fill: { color: 0x9fb2e0, intensity: 0.55, dir: v3(0.3, 0.3, 0.9) },
    hemi: { sky: 0xd9bfa4, ground: 0x4d3a2e, intensity: 1.0 },
    sky: { sun: FAR_LEFT, top: 0x6f80a8, mid: 0xc9a8a0, horizon: 0xf0c49a, sunColor: 0xffb870, disc: 6, glow: 1.0, cloudLit: 0xffd9b0, cloudDark: 0x8d7480, cloudAmount: 0.55, stars: 0 },
    sunMesh: { color: 0xffb36b, at: FAR_LEFT.clone().multiplyScalar(1100) },
    particles: "maple",
    look: { exposure: 1.0, bloom: 0.62, rays: 0.16, gain: [1.08, 0.99, 0.86] },
    update(t) {
      for (let i = 0; i < lamps.length; i++) lamps[i].emissiveIntensity = 2.7 + Math.sin(t * 7.3 + i * 2.1) * 0.25 + Math.sin(t * 13.1 + i) * 0.12;
    },
  };
}

// ============================================================================ 2: pampas cliff

function lonePine(R: () => number): THREE.Mesh {
  const parts: THREE.BufferGeometry[] = [];
  parts.push(piece(new THREE.CylinderGeometry(0.42, 0.75, 4.2, 8), "#3a2c22", xf(0, 2.1, 0, 0, 0, 0.08), 0.1, R));
  parts.push(piece(new THREE.CylinderGeometry(0.3, 0.46, 3.6, 8), "#3a2c22", xf(0.5, 5.6, 0, 0, 0, -0.32), 0.1, R));
  parts.push(piece(new THREE.CylinderGeometry(0.22, 0.32, 3.2, 7), "#3a2c22", xf(1.9, 7.9, 0.2, 0, 0, 0.5), 0.1, R));
  parts.push(piece(new THREE.CylinderGeometry(0.16, 0.24, 2.6, 7), "#3a2c22", xf(-1.2, 6.3, 0.3, 0, 0, 1.0), 0.1, R));
  for (const [x, y, z, s] of [[2.4, 9.3, 0, 2.3], [-0.2, 8.1, 0.3, 2.0], [-3.1, 7.2, 0.4, 1.7], [4.2, 8.2, -0.5, 1.5], [1.0, 10.4, 0.2, 1.6]] as const)
    parts.push(piece(blob(s, 1, R, 0.3), R() < 0.5 ? "#2f4a30" : "#3a5736", xf(x, y, z, 0, 0, 0, 1.5, 0.45, 1.2), 0.3, R));
  return new THREE.Mesh(merge(parts), matVC(0.9));
}

function jizo(R: () => number): THREE.Mesh {
  const parts = [
    piece(new THREE.BoxGeometry(0.7, 0.3, 0.7), "#77746a", xf(0, 0.15, 0), 0.1, R),
    piece(new THREE.CylinderGeometry(0.22, 0.3, 0.8, 8), "#8a877b", xf(0, 0.7, 0), 0.1, R),
    piece(blob(0.24, 1, R, 0.1), "#8f8c80", xf(0, 1.25, 0)),
    piece(new THREE.ConeGeometry(0.28, 0.22, 8), "#8f8c80", xf(0, 1.5, 0)),
    piece(new THREE.BoxGeometry(0.46, 0.2, 0.3), "#c23a26", xf(0, 1.0, 0.08)),
  ];
  return new THREE.Mesh(merge(parts), matVC(0.95));
}

function buildPampas(q: QualitySettings): ThemeSpec {
  const R = rng(202);
  const group = new THREE.Group();
  const uniforms = { uTime: { value: 0 }, uWind: { value: 0.4 } };
  group.add(ground(new THREE.CircleGeometry(ARENA_R + 0.5, 72), new THREE.MeshStandardMaterial({ map: meadowTexture(), roughness: 1 })));
  // the headland: meadow to r = 62, then a rock skirt down to the sea
  const meadow = ground(new THREE.CircleGeometry(62, 48), new THREE.MeshStandardMaterial({ color: 0x9a9446, roughness: 1 }), -0.05);
  meadow.receiveShadow = false;
  group.add(meadow);
  const skirt = new THREE.Mesh(new THREE.CylinderGeometry(62, 44, 30, 40, 1, true), new THREE.MeshStandardMaterial({ color: 0x5a5043, roughness: 1, side: THREE.DoubleSide }));
  skirt.position.y = -15;
  group.add(skirt);
  const sea = new THREE.Mesh(new THREE.PlaneGeometry(4000, 4000), new THREE.MeshBasicMaterial({ color: 0x8aa0a4, fog: false }));
  sea.rotation.x = -Math.PI / 2;
  sea.position.y = -30;
  group.add(sea);
  const n = q.shadowMap >= 4096 ? 11000 : 6500;
  group.add(grassField({ count: n, rMin: 13.0, rMax: 58, hMin: 0.6, hMax: 1.8, low: 0x7d8636, high: 0xc2a850, tip: 0xf0dfa4, seed: 3, hole: 13.8 }, uniforms));
  // a few short tufts and dry stalks inside the duel ring so it is not bald
  group.add(grassField({ count: 5200, rMin: 1.0, rMax: 15.5, hMin: 0.08, hMax: 0.26, low: 0x7a8a3c, high: 0xb8a860, tip: 0xe0d098, seed: 8 }, uniforms));
  const pine = lonePine(R);
  pine.position.set(16, 0, -17);
  group.add(pine);
  for (let i = 0; i < 3; i++) {
    const j = jizo(R);
    j.position.set(-13.5 - i * 1.3, 0, -9 + i * 0.9);
    j.rotation.y = 0.5;
    group.add(j);
  }
  // rope-wrapped boulder
  const rock = piece(blob(2.4, 2, R, 0.35), "#7a766b", xf(11.5, 1.5, -13, 0, 0, 0, 1.2, 0.9, 1), 0.25, R);
  const rope = piece(new THREE.TorusGeometry(2.3, 0.14, 6, 24), "#d9ceb4", xf(11.5, 1.9, -13, Math.PI / 2, 0, 0));
  group.add(new THREE.Mesh(merge([rock, rope]), matVC(1)));
  // weathered fence along the cliff edge
  const fence: THREE.BufferGeometry[] = [];
  for (let i = 0; i < 26; i++) {
    const a = Math.PI * 1.1 + (i / 25) * Math.PI * 0.8;
    const x = Math.cos(a) * 21, z = Math.sin(a) * 21 - 2;
    fence.push(piece(new THREE.BoxGeometry(0.22, 1.5 + R() * 0.3, 0.22), "#6b5a45", xf(x, 0.75, z, 0, -a, 0.06), 0.15, R));
    if (i % 2 === 0) fence.push(piece(new THREE.BoxGeometry(3.1, 0.16, 0.14), "#7a6850", xf(Math.cos(a + 0.06) * 21, 1.15, Math.sin(a + 0.06) * 21 - 2, 0, -a - Math.PI / 2, 0)));
  }
  group.add(new THREE.Mesh(merge(fence), matVC(1)));
  group.add(
    ridges(
      [
        { radius: 520, height: 50, base: -25, color: 0x6a7c86, haze: 0.7, seed: 31 },
        { radius: 340, height: 34, base: -22, color: 0x586a74, haze: 0.5, seed: 17, jag: 0.4 },
      ],
      0xdad2b6,
    ),
  );
  return {
    id: 2,
    name: "Pampas Cliff",
    line: "A cold wind. The grass bends toward the sea.",
    group,
    fog: { color: 0xd8cfb0, density: 0.0072 },
    key: { color: 0xffdca0, intensity: 3.2, dir: v3(-0.55, 0.6, -0.15) },
    fill: { color: 0xb4c6e6, intensity: 0.6, dir: v3(0.4, 0.3, 0.9) },
    hemi: { sky: 0xd7dcc8, ground: 0x7a6c46, intensity: 1.1 },
    sky: { sun: FAR_LEFT, top: 0x6f93c4, mid: 0xb8cbd4, horizon: 0xf2dfae, sunColor: 0xffd890, disc: 0, glow: 1.2, cloudLit: 0xfff0cc, cloudDark: 0x8e9db4, cloudAmount: 0.9, stars: 0 },
    sunMesh: { color: 0xffe0a0, at: FAR_LEFT.clone().multiplyScalar(1100) },
    particles: "petal",
    look: { exposure: 1.02, bloom: 0.5, rays: 0.1, gain: [1.05, 1.0, 0.9] },
    update(t, wind) {
      uniforms.uTime.value = t;
      uniforms.uWind.value = 0.35 + wind * 1.4;
    },
  };
}

// ============================================================================ 3: hollow sanctum

function brokenPillars(R: () => number): THREE.Mesh {
  const parts: THREE.BufferGeometry[] = [];
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2 + (R() - 0.5) * 0.25;
    const r = 20.5 + R() * 3.5;
    const x = Math.cos(a) * r, z = Math.sin(a) * r;
    if (z > 6) continue; // never block the camera behind the player
    const h = 3 + R() * 7;
    const g = new THREE.CylinderGeometry(0.95, 1.1, h, 8, 3);
    const p = g.attributes.position;
    for (let k = 0; k < p.count; k++) if (p.getY(k) > h / 2 - 0.01) p.setY(k, p.getY(k) + (R() - 0.5) * 1.1);
    parts.push(piece(g, "#6a7088", xf(x, h / 2, z, 0, R() * 6, 0, 1, 1, 1), 0.3, R));
    parts.push(piece(new THREE.BoxGeometry(2.6, 0.5, 2.6), "#585d72", xf(x, 0.25, z), 0.1, R));
    if (R() < 0.45) parts.push(piece(new THREE.CylinderGeometry(0.9, 1.0, 2.4 + R() * 2, 8), "#5e647c", xf(x + (R() - 0.5) * 4, 0.9, z + (R() - 0.5) * 4, Math.PI / 2 - 0.1, R() * 6, 0), 0.3, R));
  }
  // an arch standing at the back, one side already fallen
  parts.push(piece(new THREE.BoxGeometry(1.8, 11, 1.8), "#6a7088", xf(-6, 5.5, -27), 0.2, R));
  parts.push(piece(new THREE.BoxGeometry(1.8, 8, 1.8), "#6a7088", xf(6, 4, -27), 0.2, R));
  parts.push(piece(new THREE.BoxGeometry(14, 1.6, 2), "#5e647c", xf(-1.2, 11.4, -27, 0, 0, 0.05), 0.2, R));
  for (let i = 0; i < 40; i++) parts.push(piece(blob(0.3 + R() * 0.5, 0, R, 0.4), "#3a3e4a", xf((R() - 0.5) * 70, 0.15, -8 - R() * 40, R(), R(), R(), 1, 0.6, 1), 0.3, R));
  return new THREE.Mesh(merge(parts), matVC(0.95));
}

function hollowTree(R: () => number): { group: THREE.Group; leaves: THREE.InstancedMesh; halo: THREE.Sprite } {
  const group = new THREE.Group();
  const parts: THREE.BufferGeometry[] = [];
  const tips: THREE.Vector3[] = [];
  const branch = (from: THREE.Vector3, dir: THREE.Vector3, len: number, rad: number, depth: number) => {
    const to = from.clone().addScaledVector(dir, len);
    const mid = from.clone().lerp(to, 0.5);
    const axis = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.clone().normalize());
    const m = new THREE.Matrix4().compose(mid, axis, new THREE.Vector3(1, 1, 1));
    parts.push(piece(new THREE.CylinderGeometry(rad * 0.62, rad, len, 6), "#1d1a22", m));
    if (depth === 0) {
      tips.push(to);
      return;
    }
    const n = depth > 2 ? 2 : 3;
    for (let i = 0; i < n; i++) {
      const d = dir.clone().add(new THREE.Vector3((R() - 0.5) * 1.1, 0.35 + R() * 0.45, (R() - 0.5) * 0.8)).normalize();
      branch(to, d, len * (0.72 + R() * 0.12), rad * 0.66, depth - 1);
    }
  };
  branch(new THREE.Vector3(0, -3, 0), new THREE.Vector3(0.1, 1, 0).normalize(), 15, 2.6, 5);
  group.add(new THREE.Mesh(merge(parts), matVC(1)));
  const leafGeo = new THREE.PlaneGeometry(1.6, 1.6);
  const leafMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(3.2, 2.1, 0.7), side: THREE.DoubleSide, fog: false, transparent: true, opacity: 0.95 });
  const leaves = new THREE.InstancedMesh(leafGeo, leafMat, tips.length * 4);
  const mtx = new THREE.Matrix4();
  let k = 0;
  for (const t of tips)
    for (let i = 0; i < 4; i++) {
      mtx.compose(t.clone().add(new THREE.Vector3((R() - 0.5) * 3, (R() - 0.3) * 2.5, (R() - 0.5) * 3)), new THREE.Quaternion().setFromEuler(new THREE.Euler(R() * 3, R() * 3, R() * 3)), new THREE.Vector3(1, 1, 1).multiplyScalar(0.7 + R() * 1.3));
      leaves.setMatrixAt(k++, mtx);
    }
  group.add(leaves);
  const halo = glowSprite("rgba(255,196,96,1)", 130, 0.85);
  halo.position.set(0, 26, 0);
  group.add(halo);
  return { group, leaves, halo };
}

function buildSanctum(): ThemeSpec {
  const R = rng(303);
  const group = new THREE.Group();
  const tex = sanctumTextures();
  tex.map.repeat.set(1, 1);
  const floorMat = new THREE.MeshStandardMaterial({ map: tex.map, roughness: 0.85, emissive: new THREE.Color(1, 0.74, 0.3), emissiveMap: tex.glow, emissiveIntensity: 1.5 });
  group.add(ground(new THREE.CircleGeometry(ARENA_R + 1.5, 72), floorMat));
  const outer = ground(new THREE.CircleGeometry(160, 40), new THREE.MeshStandardMaterial({ color: 0x1a1d26, roughness: 1 }), -0.06);
  outer.receiveShadow = false;
  group.add(outer);
  group.add(brokenPillars(R));
  // the Hollow Tree: the light of this place, to the left behind the boss's shoulder
  const tree = hollowTree(R);
  tree.group.position.set(-95, 0, -150);
  tree.group.scale.setScalar(1.15);
  group.add(tree.group);
  // low mist sheets drifting over the stone
  const mistTex = mistTexture();
  const sheets: THREE.Mesh[] = [];
  for (let i = 0; i < 3; i++) {
    const m = new THREE.Mesh(
      new THREE.RingGeometry(10 + i * 2, 70, 40),
      new THREE.MeshBasicMaterial({ map: mistTex, color: i === 1 ? 0x6a78a8 : 0x8a94c0, transparent: true, opacity: 0.2, depthWrite: false, side: THREE.DoubleSide }),
    );
    m.rotation.x = -Math.PI / 2;
    m.position.y = 0.35 + i * 0.7;
    sheets.push(m);
    group.add(m);
  }
  group.add(
    ridges(
      [
        { radius: 420, height: 90, base: 0, color: 0x161a2c, haze: 0.5, seed: 61 },
        { radius: 260, height: 56, base: -4, color: 0x0e1120, haze: 0.35, seed: 71, jag: 1.3 },
      ],
      0x2a3050,
    ),
  );
  return {
    id: 3,
    name: "Hollow Sanctum",
    line: "Night. The old tree still burns, far off.",
    group,
    fog: { color: 0x2a3050, density: 0.0105 },
    key: { color: 0xa9bcff, intensity: 3.1, dir: v3(0.45, 0.7, 0.1) },
    fill: { color: 0xffb860, intensity: 2.0, dir: v3(-0.8, 0.25, 0.15) },
    hemi: { sky: 0x6a78b8, ground: 0x2a2c3c, intensity: 1.5 },
    sky: { sun: FAR_LEFT, top: 0x070a1c, mid: 0x131a3a, horizon: 0x3a3358, sunColor: 0xffc26a, disc: 0, glow: 1.4, cloudLit: 0x6a6a98, cloudDark: 0x10142c, cloudAmount: 0.45, stars: 1.1 },
    sunMesh: { color: 0xffbd5e, at: new THREE.Vector3(-95, 28, -150).normalize().multiplyScalar(1100) },
    particles: "ember",
    look: { exposure: 1.05, bloom: 0.8, rays: 0.12, gain: [1.0, 0.98, 1.0] },
    update(t) {
      const pulse = 0.85 + Math.sin(t * 0.9) * 0.08 + Math.sin(t * 2.3) * 0.04;
      tree.halo.material.opacity = pulse;
      floorMat.emissiveIntensity = 1.3 + Math.sin(t * 1.3) * 0.25;
      sheets.forEach((s, i) => (s.rotation.z = t * (0.012 + i * 0.006) * (i % 2 ? -1 : 1)));
    },
  };
}

export function buildTheme(id: ThemeId, q: QualitySettings): ThemeSpec {
  return id === 1 ? buildMaple() : id === 2 ? buildPampas(q) : buildSanctum();
}
