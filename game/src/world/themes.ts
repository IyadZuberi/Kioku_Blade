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
import { forest } from "./trees";
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
  group.add(forest("cedar", ringTrees(30, 32, 66, 3.6), 17));
  group.add(forest("maple", [...ringTrees(14, 30, 44, 3.0), ...[-1, 1].flatMap((s) => [0, 1].map((i): [number, number, number] => [s * (25 + R() * 3), -14 + i * 7 + R() * 2, 1.0 + R() * 0.3]))], 23));
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
  const n = q.shadowMap >= 4096 ? 5000 : 3200;
  group.add(grassField({ count: n, rMin: 13.0, rMax: 62, hMin: 0.7, hMax: 1.9, low: 0x8a8438, high: 0xd0b45a, tip: 0xf6e8b4, seed: 3, hole: 13.8 }, uniforms));
  group.add(grassField({ count: 8000, rMin: 1.0, rMax: 24, hMin: 0.25, hMax: 0.75, low: 0x8a8a3c, high: 0xc4b468, tip: 0xe8d8a0, seed: 8 }, uniforms));
  group.add(forest("pine", [[16, -17, 1.5], [-24, -20, 1.2], [25, -8, 1.0]], 29));
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

/** A sloped ishigaki wall run of length `len`, curving in from a wide base to a narrower top, along local X. */
function ishigaki(len: number, h: number, x: number, z: number, ry: number, base = 2.4, top = 1.25): THREE.BufferGeometry {
  const shape = new THREE.Shape();
  const half = (y: number) => top + (base - top) * Math.pow(1 - y / h, 2.3);
  const n = 8;
  shape.moveTo(-base, 0);
  for (let i = 1; i <= n; i++) shape.lineTo(-half((i / n) * h), (i / n) * h);
  for (let i = n; i >= 0; i--) shape.lineTo(half((i / n) * h), (i / n) * h);
  const g = new THREE.ExtrudeGeometry(shape, { depth: len, bevelEnabled: false, steps: 1 });
  g.translate(0, 0, -len / 2);
  g.rotateY(Math.PI / 2); // extrude axis -> X
  return tpiece(g, xf(x, 0, z, 0, ry, 0), 2.6);
}

/** Plaster parapet (dobei) with a tiled cap that sits on top of a wall run. */
function parapet(len: number, x: number, y: number, z: number, ry: number, plaster: THREE.BufferGeometry[], roofs: THREE.BufferGeometry[], R: () => number): void {
  plaster.push(piece(new THREE.BoxGeometry(len, 1.9, 0.62), "#dcd5c4", xf(x, y + 0.95, z, 0, ry, 0), 0.06, R));
  roofs.push(tpiece(new THREE.BoxGeometry(len + 0.2, 0.22, 1.5), xf(x, y + 2.05, z, 0, ry, 0), 1.6));
  roofs.push(tpiece(new THREE.BoxGeometry(len + 0.2, 0.24, 0.5), xf(x, y + 2.25, z, 0, ry, 0), 1.6));
}

function ruinedCastle(R: () => number): THREE.Group {
  const g = new THREE.Group();
  const stone: THREE.BufferGeometry[] = [];
  const plaster: THREE.BufferGeometry[] = [];
  const roofs: THREE.BufferGeometry[] = [];
  // curtain walls on a wide arc behind the ring; some runs are whole (parapet on top), some are broken stumps
  const runs = 10;
  for (let i = 0; i < runs; i++) {
    if (i % 3 === 1) continue; // gaps where the wall has gone
    const a0 = Math.PI * 0.1 + (i / runs) * Math.PI * 0.8;
    const r = 40 + (i % 2) * 2.5;
    const len = (2 * Math.PI * r * 0.8) / runs * 0.8;
    const x = Math.cos(a0) * r, z = -Math.sin(a0) * r;
    const ry = a0 - Math.PI / 2;
    const broken = R() < 0.5;
    const h = broken ? 2.2 + R() * 2.6 : 6.4;
    stone.push(ishigaki(len, h, x, z, ry, 2.4, broken ? 1.5 : 1.25));
    if (!broken) parapet(len, x, h, z, ry, plaster, roofs, R);
  }
  // gatehouse at the back: two stone piers and a plaster gate tower bridging them
  const gx = 0, gz = -46;
  stone.push(ishigaki(8, 8.4, gx - 7, gz, 0, 3, 1.8), ishigaki(8, 8.4, gx + 7, gz, 0, 3, 1.8));
  plaster.push(piece(new THREE.BoxGeometry(22, 5.2, 5.4), "#dcd5c4", xf(gx, 8.4 + 2.6 + 1.4, gz), 0.05, R));
  roofs.push(tpiece(new THREE.BoxGeometry(25, 0.5, 8.4), xf(gx, 8.4 + 5.6 + 1.4 + 0.2, gz), 2.4));
  roofs.push(tpiece(new THREE.BoxGeometry(23, 1.4, 6.0), xf(gx, 8.4 + 5.6 + 1.4 + 1.0, gz), 2.4));
  roofs.push(tpiece(new THREE.BoxGeometry(24, 0.3, 1.2), xf(gx, 8.4 + 5.6 + 1.4 + 1.85, gz), 2.4));
  // dark opening, a wooden lintel and the gate leaves
  stone.push(tpiece(new THREE.BoxGeometry(6, 0.9, 4.6), xf(gx, 8.4 + 0.45, gz), 2.6));
  const rubble: THREE.BufferGeometry[] = [];
  for (let i = 0; i < 46; i++) rubble.push(tpiece(blob(0.35 + R() * 0.7, 0, R, 0.4), xf((R() - 0.5) * 60, 0.15, -6 - R() * 38, R(), R(), R(), 1, 0.65, 1), 1.6));
  g.add(new THREE.Mesh(tmerge(stone), pbr("japanese_stone_wall", { color: 0xb9b4a8 })));
  g.add(new THREE.Mesh(merge(plaster), matVC(0.95)));
  g.add(new THREE.Mesh(tmerge(roofs), pbr("grey_roof_tiles", { color: 0x5c5d63 })));
  g.add(new THREE.Mesh(tmerge(rubble), pbr("mossy_stone_wall", { color: 0xaaa597 })));
  // the keep, far off in the mist: tiered stone base, kplaster storeys, dark kroofs
  const keep = new THREE.Group();
  const base = tmerge(stoneBase(34, 34, 14, 0, 0, 0, () => 0.05));
  keep.add(new THREE.Mesh(base, pbr("japanese_stone_wall", { color: 0xb0aca0 })));
  const kplaster: THREE.BufferGeometry[] = [];
  const kroofs: THREE.BufferGeometry[] = [];
  let y = 14;
  for (let k = 0; k < 4; k++) {
    const w = 22 - k * 4;
    kplaster.push(piece(new THREE.BoxGeometry(w, 5.2, w * 0.8), "#d9d3c2", xf(0, y + 2.6, 0), 0.05, R));
    kroofs.push(tpiece(new THREE.BoxGeometry(w + 6, 0.9, w * 0.8 + 6), xf(0, y + 5.7, 0), 2.4));
    kroofs.push(tpiece(new THREE.BoxGeometry(w + 2, 1.4, w * 0.8 + 2), xf(0, y + 6.7, 0), 2.4));
    y += 6.2;
  }
  keep.add(new THREE.Mesh(merge(kplaster), matVC(0.95)));
  keep.add(new THREE.Mesh(tmerge(kroofs), pbr("grey_roof_tiles", { color: 0x55565c })));
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

function buildCastle(): ThemeSpec {
  const R = rng(303);
  const group = new THREE.Group();
  groundPlates(group, pbr("mossy_cobblestone", { color: 0x9c9a92, normal: 1.2, rough: 0.88 }), pbr("rocky_trail", { color: 0x8a8678 }), 3.2, 6, 2.2, 31);
  group.add(ruinedCastle(R));
  const flags = banners(R);
  group.add(flags.group);
  group.add(forest("ginkgo", [[-95, -150, 3.2], [-60, -60, 1.3], [38, -70, 1.5]], 31, { glow: 0.35 }));
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
