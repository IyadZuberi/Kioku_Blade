/**
 * The three arenas of Kioku, one per general. Each is a believable place in feudal Japan, lit by a real
 * photographed sky (CC0 HDRIs) and dressed with photo-scanned textures and rocks (CC0, Poly Haven)
 * around shapes we build in code:
 *   1  Shrine Courtyard   a mountain shrine in autumn: raked gravel, a vermilion torii, a wooden hall, cedars and maples
 *   2  Coastal Pampas     a windswept headland of silver grass, a lone pine, jizo statues and a cliff (Tsushima-like)
 *   3  Ruined Castle      the stone base of a burned castle in morning mist, fallen walls, banners, an old gold ginkgo
 * Shapes, layouts and colours are our own; the mood is borrowed from Japanese history and from the games we love.
 */
import * as THREE from "three";
import { rng } from "../core/math";
import type { ParticleKind } from "../fx/Snow";
import type { QualitySettings } from "../render/quality";
import { glb, pbr } from "./assets";
import { blob, glowSprite, grassField, matVC, merge, piece, terrainGeo, tmerge, tpiece, xf, type SkySpec } from "./kit";

export const ARENA_R = 16.5;
export type ThemeId = 1 | 2 | 3;

export interface ThemeSpec {
  id: ThemeId;
  name: string;
  /** One line shown on the chapter card. */
  line: string;
  group: THREE.Group;
  /** Poly Haven HDRI that is the sky, the horizon and the reflections. */
  hdri: string;
  /** World direction the sun should come from (azimuth is what matters; the picture sets the height). */
  sunFrom: THREE.Vector3;
  /** Lowest sun height we allow (a sun on the horizon lights nothing). */
  sunMinElev: number;
  fog: { color: number; density: number; /** 0..1: how much of the photographed horizon colour to use */ fromSky: number };
  key: { color: number; intensity: number };
  fill: { color: number; intensity: number; dir: THREE.Vector3 };
  hemi: { sky: number; ground: number; intensity: number };
  env: number;
  /** Used until the photo has loaded, and for the god-ray glow colour. */
  sky: SkySpec;
  sunColor: number;
  particles: ParticleKind;
  /** Post-process look. */
  look: { exposure: number; bloom: number; rays: number; gain: [number, number, number] };
  update(t: number, wind: number): void;
}

const v3 = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z).normalize();
const SUN_LEFT = v3(-1, 0.3, 0.12);

/** A flat or gently rolling ground: a disc for the duel ring plus a rolling skirt out to the horizon. */
function groundPlates(group: THREE.Group, inner: THREE.Material, outer: THREE.Material, innerTile: number, outerTile: number, amp: number, seed: number): void {
  const disc = new THREE.Mesh(terrainGeo(new THREE.CircleGeometry(ARENA_R + 0.5, 72), innerTile, 999, 0, seed), inner);
  disc.rotation.x = -Math.PI / 2;
  disc.receiveShadow = true;
  group.add(disc);
  const ring = new THREE.Mesh(terrainGeo(new THREE.RingGeometry(ARENA_R, 520, 96, 28), outerTile, ARENA_R + 2, amp, seed + 1), outer);
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = -0.04;
  group.add(ring);
}

/** Place decimated scans (rocks, cliffs, logs). Resolves later; the group just fills in. */
function scatter(group: THREE.Group, name: string, spots: { x: number; y?: number; z: number; s: number; ry?: number; tilt?: number }[], tint?: THREE.ColorRepresentation): void {
  void glb(name)
    .then((tpl) => {
      for (const sp of spots) {
        const o = tpl.clone(true);
        o.position.set(sp.x, sp.y ?? 0, sp.z);
        o.scale.setScalar(sp.s);
        o.rotation.set(sp.tilt ?? 0, sp.ry ?? 0, 0);
        o.traverse((c) => {
          const m = c as THREE.Mesh;
          if (!m.isMesh) return;
          m.receiveShadow = true;
          if (tint) {
            const mat = (m.material as THREE.MeshStandardMaterial).clone();
            mat.color.multiply(new THREE.Color(tint));
            m.material = mat;
          }
        });
        group.add(o);
      }
    })
    .catch((e) => console.warn("[arena] model missing", name, e));
}

// ============================================================================ 1: shrine courtyard

function toro(R: () => number): { group: THREE.Group; glow: THREE.MeshStandardMaterial } {
  const parts = [
    tpiece(new THREE.CylinderGeometry(0.5, 0.62, 0.25, 8), xf(0, 0.12, 0), 0.9),
    tpiece(new THREE.CylinderGeometry(0.17, 0.2, 1.05, 8), xf(0, 0.78, 0), 0.9),
    tpiece(new THREE.CylinderGeometry(0.42, 0.34, 0.2, 8), xf(0, 1.4, 0), 0.9),
    tpiece(new THREE.BoxGeometry(0.62, 0.1, 0.62), xf(0, 1.78, 0), 0.9),
    tpiece(new THREE.ConeGeometry(0.62, 0.42, 4), xf(0, 2.1, 0, 0, Math.PI / 4, 0), 0.9),
    tpiece(new THREE.SphereGeometry(0.1, 6, 4), xf(0, 2.38, 0), 0.9),
  ];
  void R;
  const group = new THREE.Group();
  const body = new THREE.Mesh(tmerge(parts), pbr("japanese_stone_wall", { color: 0xcfcabc, rough: 0.95 }));
  body.castShadow = false;
  group.add(body);
  const glow = new THREE.MeshStandardMaterial({ color: 0x2a1a10, emissive: new THREE.Color(1.0, 0.55, 0.2), emissiveIntensity: 2.4, roughness: 1 });
  const box = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.3, 0.34), glow);
  box.position.y = 1.58;
  group.add(box);
  const halo = glowSprite("rgba(255,170,80,1)", 1.8, 0.45);
  halo.position.y = 1.6;
  group.add(halo);
  return { group, glow };
}

export function torii(R: () => number, aged = 0): THREE.Group {
  const red = aged ? "#9c3a26" : "#c0341f", black = "#17110f";
  const parts = [
    piece(new THREE.CylinderGeometry(0.3, 0.36, 6.4, 12), red, xf(-3.1, 3.2, 0), 0.04, R),
    piece(new THREE.CylinderGeometry(0.3, 0.36, 6.4, 12), red, xf(3.1, 3.2, 0), 0.04, R),
    piece(new THREE.BoxGeometry(8.9, 0.34, 0.5), red, xf(0, 5.0, 0)),
    piece(new THREE.BoxGeometry(10.6, 0.5, 0.95), black, xf(0, 6.55, 0), 0.04, R),
    piece(new THREE.BoxGeometry(0.9, 0.4, 0.95), black, xf(-5.1, 6.8, 0, 0, 0, 0.35)),
    piece(new THREE.BoxGeometry(0.9, 0.4, 0.95), black, xf(5.1, 6.8, 0, 0, 0, -0.35)),
    piece(new THREE.BoxGeometry(9.6, 0.3, 0.7), red, xf(0, 6.1, 0)),
    piece(new THREE.BoxGeometry(0.2, 1.1, 0.35), red, xf(0, 5.55, 0)),
    piece(new THREE.CylinderGeometry(0.42, 0.46, 0.5, 12), black, xf(-3.1, 0.25, 0)),
    piece(new THREE.CylinderGeometry(0.42, 0.46, 0.5, 12), black, xf(3.1, 0.25, 0)),
  ];
  const g = new THREE.Group();
  g.add(new THREE.Mesh(merge(parts), matVC(aged ? 0.85 : 0.5, { flatShading: false })));
  return g;
}

function shrineHall(): THREE.Group {
  const g = new THREE.Group();
  const stone = tmerge([
    tpiece(new THREE.BoxGeometry(15, 1.0, 8), xf(0, 0.5, 0), 2),
    tpiece(new THREE.BoxGeometry(6, 0.5, 3), xf(0, 0.25, 5), 2),
    tpiece(new THREE.BoxGeometry(5, 0.3, 1.2), xf(0, 0.15, 6.9), 2),
  ]);
  g.add(new THREE.Mesh(stone, pbr("japanese_stone_wall", { color: 0xd6d0c4 })));
  const wood: THREE.BufferGeometry[] = [
    tpiece(new THREE.BoxGeometry(11.6, 0.35, 5.6), xf(0, 1.15, 0), 1.5),
    tpiece(new THREE.BoxGeometry(11.6, 0.35, 5.6), xf(0, 4.55, 0), 1.5),
    tpiece(new THREE.BoxGeometry(15.4, 0.2, 0.3), xf(0, 4.9, 4.65), 1.5),
  ];
  for (let i = 0; i < 6; i++) wood.push(tpiece(new THREE.CylinderGeometry(0.28, 0.3, 3.6, 10), xf(-4.8 + i * 1.92, 2.8, 3.1), 1.4));
  g.add(new THREE.Mesh(tmerge(wood), pbr("hinoki_planks", { color: 0xb4482e, rough: 0.7 })));
  g.add(new THREE.Mesh(merge([piece(new THREE.BoxGeometry(11.2, 3.6, 5.2), "#d7ccb4", xf(0, 2.8, 0))]), matVC(0.95)));
  // doors: dark timber panels on the plaster front
  const doors = tmerge([0, 1, 2].map((i) => tpiece(new THREE.BoxGeometry(2.6, 2.7, 0.1), xf(-3.4 + i * 3.4, 2.7, 2.62), 1.3)));
  g.add(new THREE.Mesh(doors, pbr("japanese_cedar_planks", { color: 0x6a4a36 })));
  // roof: steep upper slope, a shallow kicked-up eave below it, ridge cap
  const roof: THREE.BufferGeometry[] = [];
  for (const s of [1, -1]) {
    roof.push(tpiece(new THREE.BoxGeometry(15.8, 0.42, 3.9), xf(0, 7.0, s * 1.55, s * -0.62, 0, 0), 1.8));
    roof.push(tpiece(new THREE.BoxGeometry(16.6, 0.4, 2.6), xf(0, 5.45, s * 4.5, s * -0.2, 0, 0), 1.8));
  }
  roof.push(tpiece(new THREE.BoxGeometry(16.2, 0.55, 0.7), xf(0, 8.1, 0), 1.8));
  g.add(new THREE.Mesh(tmerge(roof), pbr("grey_roof_tiles", { color: 0x8a8a92 })));
  return g;
}

/** A tall straight Japanese cedar: bark trunk and dark layered crown. */
function cedars(R: () => number, spots: [number, number, number][]): THREE.Group {
  const g = new THREE.Group();
  const trunks: THREE.BufferGeometry[] = [];
  const crown: THREE.BufferGeometry[] = [];
  for (const [x, z, s] of spots) {
    const h = (17 + R() * 8) * s;
    trunks.push(tpiece(new THREE.CylinderGeometry(0.42 * s, 0.72 * s, h, 8), xf(x, h / 2, z), 3));
    for (let k = 0; k < 9; k++) {
      const y = h * (0.2 + k * 0.088);
      const rr = (3.4 - k * 0.34) * s;
      crown.push(piece(new THREE.ConeGeometry(rr, h * 0.17, 11), k % 2 ? "#233a28" : "#2b4730", xf(x + (R() - 0.5) * 0.5, y + h * 0.08, z + (R() - 0.5) * 0.5, 0, R() * 6, 0, 1, 0.9 + R() * 0.3, 1), 0.4, R));
    }
  }
  g.add(new THREE.Mesh(tmerge(trunks), pbr("japanese_cedar_bark", { color: 0xb8aca0 })));
  g.add(new THREE.Mesh(merge(crown), matVC(0.95, { flatShading: false })));
  return g;
}

function maples(R: () => number, spots: [number, number, number][]): THREE.Group {
  const g = new THREE.Group();
  const bark: THREE.BufferGeometry[] = [];
  const leaves: THREE.BufferGeometry[] = [];
  const hues = ["#a8281c", "#c8421c", "#e07a1e", "#b52e20", "#d89322"];
  for (const [x, z, s] of spots) {
    const hue = hues[Math.floor(R() * hues.length)];
    bark.push(tpiece(new THREE.CylinderGeometry(0.16 * s, 0.34 * s, 3.4 * s, 8), xf(x, 1.7 * s, z, 0, R() * 6, 0), 2));
    bark.push(tpiece(new THREE.CylinderGeometry(0.07 * s, 0.14 * s, 2.2 * s, 6), xf(x + 0.8 * s, 3.6 * s, z, 0, 0, -0.6), 2));
    bark.push(tpiece(new THREE.CylinderGeometry(0.07 * s, 0.14 * s, 2.0 * s, 6), xf(x - 0.8 * s, 3.5 * s, z + 0.3 * s, 0, 0, 0.6), 2));
    for (let k = 0; k < 7; k++) {
      const a = (k / 7) * Math.PI * 2 + R();
      const rr = k === 0 ? 0 : (1.1 + R() * 0.9) * s;
      leaves.push(piece(blob((1.5 + R() * 0.8) * s, 2, R, 0.3), hue, xf(x + Math.cos(a) * rr, (4.3 + R() * 1.5) * s, z + Math.sin(a) * rr, 0, 0, 0, 1, 0.72, 1), 0.38, R));
    }
  }
  g.add(new THREE.Mesh(tmerge(bark), pbr("japanese_cedar_bark", { color: 0x7a6a5e })));
  g.add(new THREE.Mesh(merge(leaves), matVC(0.9, { flatShading: false })));
  return g;
}

function buildShrine(): ThemeSpec {
  const R = rng(101);
  const group = new THREE.Group();
  groundPlates(group, pbr("leaf_scattered_gravel", { color: 0xe6dccb, normal: 1.1 }), pbr("leaf_scattered_gravel", { color: 0xc98a66, normal: 1.2 }), 3.4, 4.5, 1.6, 11);
  // path of stone slabs from the ring up to the hall
  const path = new THREE.Mesh(tmerge([tpiece(new THREE.BoxGeometry(3.4, 0.12, 16), xf(0, 0.04, -24), 2)]), pbr("stone_pathway", { color: 0xd8d2c4 }));
  path.receiveShadow = true;
  group.add(path);
  // low stone kerb round the ring
  const kerb: THREE.BufferGeometry[] = [];
  for (let i = 0; i < 64; i++) {
    const a = (i / 64) * Math.PI * 2;
    kerb.push(tpiece(blob(0.6 + R() * 0.2, 1, R, 0.3), xf(Math.cos(a) * (ARENA_R + 0.4), 0.1, Math.sin(a) * (ARENA_R + 0.4), 0, 0, 0, 1.15, 0.5, 0.9), 1.4));
  }
  group.add(new THREE.Mesh(tmerge(kerb), pbr("japanese_stone_wall", { color: 0xbab6aa })));
  const hall = shrineHall();
  hall.position.set(0, 0, -34);
  group.add(hall);
  const t1 = torii(R);
  t1.position.set(-13.5, 0, -17);
  t1.rotation.y = 0.5;
  group.add(t1);
  const t2 = torii(R, 1);
  t2.scale.setScalar(0.75);
  t2.position.set(15.5, 0, -27);
  t2.rotation.y = -0.3;
  group.add(t2);
  const lamps: THREE.MeshStandardMaterial[] = [];
  for (const [x, z] of [[-8.6, -11.5], [8.6, -11.5], [-14.5, 1], [14.5, 1], [-2.6, -17.6], [2.6, -17.6]] as const) {
    const l = toro(R);
    l.group.position.set(x, 0, z);
    l.group.scale.setScalar(1.25);
    group.add(l.group);
    lamps.push(l.glow);
  }
  const ringTrees = (n: number, r0: number, r1: number, spread: number): [number, number, number][] => {
    const out: [number, number, number][] = [];
    for (let i = 0; i < n; i++) {
      const a = Math.PI + (R() - 0.5) * spread;
      const r = r0 + R() * (r1 - r0);
      out.push([Math.sin(a) * r, Math.cos(a) * r - 4, 0.9 + R() * 0.6]);
    }
    return out;
  };
  group.add(cedars(R, ringTrees(40, 26, 64, 3.6)));
  group.add(maples(R, [...ringTrees(14, 23, 36, 3.0), ...[-1, 1].flatMap((s) => [0, 1, 2].map((i): [number, number, number] => [s * (21 + R() * 3), -9 + i * 6 + R() * 2, 0.95 + R() * 0.3]))]));
  scatter(group, "rock_moss_set_01", [
    { x: -17.5, z: -5, s: 1.6, ry: 1 },
    { x: 18.8, z: -8, s: 1.9, ry: 3 },
    { x: -19, z: -16, s: 1.5, ry: 5 },
    { x: 12, z: 8.5, s: 1.4, ry: 2 },
  ]);
  scatter(group, "stone_01", [
    { x: -12, z: 12.5, s: 1.1, ry: 0.5 },
    { x: 17, z: 3, s: 1.3, ry: 2 },
    { x: 6, z: -20, s: 0.9, ry: 4 },
  ]);
  return {
    id: 1,
    name: "Shrine Courtyard",
    line: "Late afternoon in the hills. The leaves have started to fall.",
    group,
    hdri: "autumn_hill_view",
    sunFrom: SUN_LEFT,
    sunMinElev: 0.5,
    fog: { color: 0xd9b88f, density: 0.0062, fromSky: 0.35 },
    key: { color: 0xffd5a0, intensity: 3.1 },
    fill: { color: 0xa0b4de, intensity: 0.55, dir: v3(0.4, 0.3, 0.9) },
    hemi: { sky: 0xcfc2b0, ground: 0x4d3a2e, intensity: 0.5 },
    env: 0.95,
    sky: { sun: SUN_LEFT, top: 0x6f80a8, mid: 0xc9a8a0, horizon: 0xf0c49a, sunColor: 0xffb870, disc: 6, glow: 1.0, cloudLit: 0xffd9b0, cloudDark: 0x8d7480, cloudAmount: 0.55, stars: 0 },
    sunColor: 0xffc27a,
    particles: "maple",
    look: { exposure: 0.95, bloom: 0.4, rays: 0.05, gain: [1.04, 1.0, 0.92] },
    update(t) {
      for (let i = 0; i < lamps.length; i++) lamps[i].emissiveIntensity = 2.2 + Math.sin(t * 7.3 + i * 2.1) * 0.25 + Math.sin(t * 13.1 + i) * 0.12;
    },
  };
}

// ============================================================================ 2: coastal pampas

function lonePine(R: () => number): THREE.Group {
  const g = new THREE.Group();
  const bark: THREE.BufferGeometry[] = [
    tpiece(new THREE.CylinderGeometry(0.42, 0.75, 4.2, 9), xf(0, 2.1, 0, 0, 0, 0.08), 2.4),
    tpiece(new THREE.CylinderGeometry(0.3, 0.46, 3.6, 8), xf(0.5, 5.6, 0, 0, 0, -0.32), 2.4),
    tpiece(new THREE.CylinderGeometry(0.22, 0.32, 3.2, 7), xf(1.9, 7.9, 0.2, 0, 0, 0.5), 2.4),
    tpiece(new THREE.CylinderGeometry(0.16, 0.24, 2.6, 7), xf(-1.2, 6.3, 0.3, 0, 0, 1.0), 2.4),
  ];
  g.add(new THREE.Mesh(tmerge(bark), pbr("japanese_cedar_bark", { color: 0x8a7a6c })));
  const crown: THREE.BufferGeometry[] = [];
  for (const [x, y, z, s] of [[2.4, 9.3, 0, 2.3], [-0.2, 8.1, 0.3, 2.0], [-3.1, 7.2, 0.4, 1.7], [4.2, 8.2, -0.5, 1.5], [1.0, 10.4, 0.2, 1.6]] as const)
    crown.push(piece(blob(s, 1, R, 0.3), R() < 0.5 ? "#2f4a30" : "#3a5736", xf(x, y, z, 0, 0, 0, 1.5, 0.45, 1.2), 0.3, R));
  g.add(new THREE.Mesh(merge(crown), matVC(0.9)));
  return g;
}

function jizo(R: () => number): THREE.Group {
  const g = new THREE.Group();
  g.add(
    new THREE.Mesh(
      tmerge([
        tpiece(new THREE.BoxGeometry(0.7, 0.3, 0.7), xf(0, 0.15, 0), 0.8),
        tpiece(new THREE.CylinderGeometry(0.22, 0.3, 0.8, 8), xf(0, 0.7, 0), 0.8),
        tpiece(blob(0.24, 1, R, 0.1), xf(0, 1.25, 0), 0.8),
        tpiece(new THREE.ConeGeometry(0.28, 0.22, 8), xf(0, 1.5, 0), 0.8),
      ]),
      pbr("rock_pitted_mossy", { color: 0xd8d4c6 }),
    ),
  );
  g.add(new THREE.Mesh(merge([piece(new THREE.BoxGeometry(0.46, 0.2, 0.3), "#c23a26", xf(0, 1.0, 0.08))]), matVC(0.9)));
  return g;
}

function buildPampas(q: QualitySettings): ThemeSpec {
  const R = rng(202);
  const group = new THREE.Group();
  const uniforms = { uTime: { value: 0 }, uWind: { value: 0.4 } };
  groundPlates(group, pbr("withered_grass", { color: 0xb9a878, normal: 1.0 }), pbr("withered_grass", { color: 0xa89a68, normal: 0.8 }), 3.4, 6, 4.2, 21);
  const n = q.shadowMap >= 4096 ? 12000 : 7000;
  group.add(grassField({ count: n, rMin: 13.0, rMax: 62, hMin: 0.7, hMax: 1.9, low: 0x8a8438, high: 0xd0b45a, tip: 0xf6e8b4, seed: 3, hole: 13.8 }, uniforms));
  group.add(grassField({ count: 5400, rMin: 1.0, rMax: 15.5, hMin: 0.08, hMax: 0.28, low: 0x8a8a3c, high: 0xc4b468, tip: 0xe8d8a0, seed: 8 }, uniforms));
  const pine = lonePine(R);
  pine.position.set(16, 0, -17);
  group.add(pine);
  for (let i = 0; i < 3; i++) {
    const j = jizo(R);
    j.position.set(-13.5 - i * 1.3, 0, -9 + i * 0.9);
    j.rotation.y = 0.5;
    group.add(j);
  }
  // a weathered torii leaning at the cliff path
  const t = torii(R, 1);
  t.position.set(-4, 0, -26);
  t.scale.setScalar(0.8);
  t.rotation.y = 0.12;
  group.add(t);
  // rope-wrapped boulder
  const rope = new THREE.Mesh(merge([piece(new THREE.TorusGeometry(2.3, 0.14, 6, 24), "#d9ceb4", xf(11.5, 1.9, -13, Math.PI / 2, 0, 0))]), matVC(1));
  group.add(rope);
  scatter(group, "namaqualand_boulder_02", [
    { x: 11.5, z: -13, s: 1.0, ry: 1.2 },
    { x: -15, z: -17, s: 0.8, ry: 3 },
    { x: 20, z: 2, s: 0.7, ry: 5 },
    { x: -7, z: -33, s: 2.6, ry: 0.4 },
    { x: 3, z: -37, s: 3.1, ry: 2.4 },
    { x: 15, z: -31, s: 2.3, ry: 4.1 },
    { x: -22, z: -26, s: 2.0, ry: 5.2 },
    { x: 27, z: -22, s: 1.9, ry: 1.7 },
  ], 0xcfc6b2);
  scatter(group, "coastal_cliff_02", [
    { x: -64, y: -1.0, z: -34, s: 1.3, ry: 1.0 },
  ], 0xd8cfbc);
  scatter(group, "dead_tree_trunk", [{ x: -19, z: 6, s: 1.4, ry: 2, tilt: 0 }], 0xbdb2a2);
  // weathered fence along the cliff path
  const fence: THREE.BufferGeometry[] = [];
  for (let i = 0; i < 26; i++) {
    const a = Math.PI * 1.1 + (i / 25) * Math.PI * 0.8;
    const x = Math.cos(a) * 21, z = Math.sin(a) * 21 - 2;
    fence.push(tpiece(new THREE.BoxGeometry(0.22, 1.5 + R() * 0.3, 0.22), xf(x, 0.75, z, 0, -a, 0.06), 1.2));
    if (i % 2 === 0) fence.push(tpiece(new THREE.BoxGeometry(3.1, 0.16, 0.14), xf(Math.cos(a + 0.06) * 21, 1.15, Math.sin(a + 0.06) * 21 - 2, 0, -a - Math.PI / 2, 0), 1.2));
  }
  group.add(new THREE.Mesh(tmerge(fence), pbr("japanese_cedar_planks", { color: 0x8a7a68 })));
  return {
    id: 2,
    name: "Coastal Pampas",
    line: "Golden hour on the headland. The grass bends toward the sea.",
    group,
    hdri: "plains_sunset",
    sunFrom: SUN_LEFT,
    sunMinElev: 0.34,
    fog: { color: 0xe6cf9a, density: 0.0068, fromSky: 0.55 },
    key: { color: 0xffd08a, intensity: 2.9 },
    fill: { color: 0xb4c6e6, intensity: 0.6, dir: v3(0.4, 0.3, 0.9) },
    hemi: { sky: 0xd9d4bd, ground: 0x7a6c46, intensity: 0.55 },
    env: 1.0,
    sky: { sun: SUN_LEFT, top: 0x6f93c4, mid: 0xb8cbd4, horizon: 0xf2dfae, sunColor: 0xffd890, disc: 0, glow: 1.2, cloudLit: 0xfff0cc, cloudDark: 0x8e9db4, cloudAmount: 0.9, stars: 0 },
    sunColor: 0xffd890,
    particles: "petal",
    look: { exposure: 0.98, bloom: 0.42, rays: 0.06, gain: [1.05, 1.0, 0.9] },
    update(t, wind) {
      uniforms.uTime.value = t;
      uniforms.uWind.value = 0.35 + wind * 1.4;
    },
  };
}

// ============================================================================ 3: ruined castle

/** Sloped Japanese castle base (ishigaki): a stone frustum, optionally broken off at the top. */
function stoneBase(w: number, d: number, h: number, x: number, z: number, ry: number, R: () => number): THREE.BufferGeometry[] {
  const parts: THREE.BufferGeometry[] = [];
  const g = new THREE.CylinderGeometry(Math.SQRT1_2 * w * 0.82, Math.SQRT1_2 * w, h, 4, 3);
  g.rotateY(Math.PI / 4);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    p.setX(i, p.getX(i) * (d / w));
    if (p.getY(i) > h / 2 - 0.01) p.setY(i, p.getY(i) - R() * h * 0.28);
  }
  parts.push(tpiece(g, xf(x, h / 2, z, 0, ry, 0), 2.6));
  return parts;
}

function ruinedCastle(R: () => number): THREE.Group {
  const g = new THREE.Group();
  const stone: THREE.BufferGeometry[] = [];
  // fallen curtain walls round the back and sides (never in front of the camera)
  for (let i = 0; i < 11; i++) {
    const a = Math.PI * 0.55 + (i / 10) * Math.PI * 0.9 + (R() - 0.5) * 0.12;
    const r = 24 + R() * 3;
    const x = Math.cos(a) * r, z = -Math.sin(a) * r;
    stone.push(...stoneBase(7 + R() * 2, 3.2, 3.5 + R() * 4.5, x, z, -a + Math.PI / 2, R));
  }
  // gatehouse base at the back with a broken opening
  stone.push(...stoneBase(7, 4.4, 9, -8, -32, 0.05, R), ...stoneBase(7, 4.4, 6.5, 8, -32, -0.06, R));
  const rubble: THREE.BufferGeometry[] = [];
  for (let i = 0; i < 46; i++) rubble.push(tpiece(blob(0.35 + R() * 0.7, 0, R, 0.4), xf((R() - 0.5) * 60, 0.15, -6 - R() * 38, R(), R(), R(), 1, 0.65, 1), 1.6));
  g.add(new THREE.Mesh(tmerge(stone), pbr("japanese_stone_wall", { color: 0xb9b4a8 })));
  g.add(new THREE.Mesh(tmerge(rubble), pbr("mossy_stone_wall", { color: 0xaaa597 })));
  // the keep, far off in the mist: tiered stone base, plaster storeys, dark roofs
  const keep = new THREE.Group();
  const base = tmerge(stoneBase(34, 34, 14, 0, 0, 0, () => 0.05));
  keep.add(new THREE.Mesh(base, pbr("japanese_stone_wall", { color: 0xb0aca0 })));
  const plaster: THREE.BufferGeometry[] = [];
  const roofs: THREE.BufferGeometry[] = [];
  let y = 14;
  for (let k = 0; k < 4; k++) {
    const w = 22 - k * 4;
    plaster.push(piece(new THREE.BoxGeometry(w, 5.2, w * 0.8), "#d9d3c2", xf(0, y + 2.6, 0), 0.05, R));
    roofs.push(tpiece(new THREE.BoxGeometry(w + 6, 0.9, w * 0.8 + 6), xf(0, y + 5.7, 0), 2.4));
    roofs.push(tpiece(new THREE.BoxGeometry(w + 2, 1.4, w * 0.8 + 2), xf(0, y + 6.7, 0), 2.4));
    y += 6.2;
  }
  keep.add(new THREE.Mesh(merge(plaster), matVC(0.95)));
  keep.add(new THREE.Mesh(tmerge(roofs), pbr("grey_roof_tiles", { color: 0x55565c })));
  keep.position.set(-14, 0, -112);
  keep.scale.setScalar(1.15);
  g.add(keep);
  return g;
}

function banners(R: () => number): { group: THREE.Group; cloth: THREE.Mesh[] } {
  const group = new THREE.Group();
  const cloth: THREE.Mesh[] = [];
  const poleParts: THREE.BufferGeometry[] = [];
  const clothMat = new THREE.MeshStandardMaterial({ color: 0x8e2a22, roughness: 0.95, side: THREE.DoubleSide });
  const spots: [number, number][] = [[-12, -14], [12, -15], [-17, -4], [17, -3], [-6, -25], [6, -26]];
  for (const [x, z] of spots) {
    poleParts.push(piece(new THREE.CylinderGeometry(0.07, 0.09, 6.2, 6), "#3a2c22", xf(x, 3.1, z), 0.1, R));
    poleParts.push(piece(new THREE.BoxGeometry(1.0, 0.07, 0.07), "#3a2c22", xf(x + 0.5, 5.9, z)));
    const c = new THREE.Mesh(new THREE.PlaneGeometry(1.0, 3.6, 1, 6), clothMat);
    c.position.set(x + 0.52, 4.0, z);
    c.rotation.y = R() * 0.5 - 0.25;
    group.add(c);
    cloth.push(c);
  }
  group.add(new THREE.Mesh(merge(poleParts), matVC(0.9)));
  return { group, cloth };
}

function oldGinkgo(R: () => number): THREE.Group {
  const group = new THREE.Group();
  const bark: THREE.BufferGeometry[] = [];
  const tips: THREE.Vector3[] = [];
  const branch = (from: THREE.Vector3, dir: THREE.Vector3, len: number, rad: number, depth: number) => {
    const to = from.clone().addScaledVector(dir, len);
    const mid = from.clone().lerp(to, 0.5);
    const axis = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.clone().normalize());
    bark.push(tpiece(new THREE.CylinderGeometry(rad * 0.62, rad, len, 7), new THREE.Matrix4().compose(mid, axis, new THREE.Vector3(1, 1, 1)), 5));
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
  group.add(new THREE.Mesh(tmerge(bark), pbr("japanese_cedar_bark", { color: 0x5a4c42 })));
  const leaves: THREE.BufferGeometry[] = [];
  for (const t of tips)
    for (let i = 0; i < 3; i++) leaves.push(piece(blob(2.4 + R() * 1.6, 1, R, 0.3), R() < 0.5 ? "#e0a82a" : "#caa032", xf(t.x + (R() - 0.5) * 3, t.y + (R() - 0.3) * 2, t.z + (R() - 0.5) * 3, 0, 0, 0, 1, 0.55, 1), 0.3, R));
  const canopy = new THREE.Mesh(merge(leaves), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9, emissive: new THREE.Color(0.9, 0.55, 0.12), emissiveIntensity: 0.55, flatShading: true }));
  group.add(canopy);
  return group;
}

function buildCastle(): ThemeSpec {
  const R = rng(303);
  const group = new THREE.Group();
  groundPlates(group, pbr("mossy_cobblestone", { color: 0x9c9a92, normal: 1.2, rough: 0.88 }), pbr("rocky_trail", { color: 0x8a8678 }), 3.2, 6, 2.2, 31);
  group.add(ruinedCastle(R));
  const flags = banners(R);
  group.add(flags.group);
  const tree = oldGinkgo(R);
  tree.position.set(-95, 0, -150);
  tree.scale.setScalar(1.15);
  group.add(tree);
  const halo = glowSprite("rgba(255,196,96,1)", 120, 0.28);
  halo.position.set(-95, 24, -150);
  group.add(halo);
  scatter(group, "rock_moss_set_01", [
    { x: -16, z: -9, s: 1.7, ry: 1 },
    { x: 17, z: -13, s: 2.0, ry: 2 },
    { x: 3, z: -22, s: 1.5, ry: 4 },
    { x: -9, z: 10, s: 1.2, ry: 5 },
  ], 0xb5b0a2);
  scatter(group, "stone_01", [
    { x: 10, z: -4, s: 1.2, ry: 1 },
    { x: -14, z: 5, s: 1.4, ry: 3 },
    { x: 14, z: 11, s: 1.0, ry: 5 },
  ], 0xaaa598);
  scatter(group, "dead_tree_trunk", [{ x: 19, z: -4, s: 1.6, ry: 1.2 }], 0x9a9084);
  // mist sheets drifting over the stone
  const mist = new THREE.Group();
  const sheets: THREE.Mesh[] = [];
  const mistTex = (() => {
    const c = document.createElement("canvas");
    c.width = c.height = 256;
    const g = c.getContext("2d")!;
    for (let i = 0; i < 46; i++) {
      const x = R() * 256, y = R() * 256, r = 30 + R() * 70;
      const gr = g.createRadialGradient(x, y, 0, x, y, r);
      gr.addColorStop(0, "rgba(255,255,255,0.22)");
      gr.addColorStop(1, "rgba(255,255,255,0)");
      g.fillStyle = gr;
      g.fillRect(x - r, y - r, r * 2, r * 2);
    }
    const t = new THREE.CanvasTexture(c);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(3, 3);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  })();
  for (let i = 0; i < 3; i++) {
    const m = new THREE.Mesh(new THREE.RingGeometry(9 + i * 2, 70, 40), new THREE.MeshBasicMaterial({ map: mistTex, color: 0xc4ccd8, transparent: true, opacity: 0.2, depthWrite: false, side: THREE.DoubleSide }));
    m.rotation.x = -Math.PI / 2;
    m.position.y = 0.4 + i * 0.8;
    sheets.push(m);
    mist.add(m);
  }
  group.add(mist);
  return {
    id: 3,
    name: "Ruined Castle",
    line: "Morning mist over the burned castle. Something old waits in the keep.",
    group,
    hdri: "kloofendal_misty_morning",
    sunFrom: SUN_LEFT,
    sunMinElev: 0.55,
    fog: { color: 0xaab2bc, density: 0.0125, fromSky: 0.8 },
    key: { color: 0xdfe6f2, intensity: 2.6 },
    fill: { color: 0xffc890, intensity: 0.7, dir: v3(-0.7, 0.2, 0.6) },
    hemi: { sky: 0xb9c4d4, ground: 0x4e4a44, intensity: 0.7 },
    env: 1.05,
    sky: { sun: SUN_LEFT, top: 0x8a98ae, mid: 0xb4bdc8, horizon: 0xc8ccd2, sunColor: 0xfff0d8, disc: 0, glow: 0.6, cloudLit: 0xd8dde6, cloudDark: 0x8e98a8, cloudAmount: 0.6, stars: 0 },
    sunColor: 0xffe8c8,
    particles: "ember",
    look: { exposure: 1.0, bloom: 0.45, rays: 0.05, gain: [0.98, 1.0, 1.03] },
    update(t) {
      sheets.forEach((s, i) => (s.rotation.z = t * (0.012 + i * 0.006) * (i % 2 ? -1 : 1)));
      flags.cloth.forEach((c, i) => {
        c.rotation.y = Math.sin(t * 1.6 + i * 1.7) * 0.28 + Math.sin(t * 0.7 + i) * 0.12;
        c.rotation.z = Math.sin(t * 2.3 + i) * 0.04;
      });
    },
  };
}

export function buildTheme(id: ThemeId, q: QualitySettings): ThemeSpec {
  return id === 1 ? buildShrine() : id === 2 ? buildPampas(q) : buildCastle();
}
