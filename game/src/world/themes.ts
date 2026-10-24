/**
 * The three arenas of Kioku, one per general. Each is a believable place in feudal Japan, lit by a real
 * photographed sky (CC0 HDRIs) and dressed with photo-scanned textures and rocks (CC0, Poly Haven)
 * around shapes we build in code:
 *   1  Shrine Courtyard   a mountain shrine in autumn: raked gravel, a vermilion torii, a wooden hall, cedars and maples
 *   2  Castle Rooftop     the keep's snowy clay-tile roof at dusk, paper lanterns swinging (the base game's arena.glb)
 *   3  Sakura Grove       a cherry grove in full bloom, an ancient sakura, a petal carpet, stone lanterns
 * Shapes, layouts and colours are our own; the mood is borrowed from Japanese history and from the games we love.
 */
import * as THREE from "three";
import { rng } from "../core/math";
import type { ParticleKind } from "../fx/Snow";
import type { QualitySettings } from "../render/quality";
import { glb, glbFile, pbr } from "./assets";
import { snowify, type SnowOpts } from "./materials";
import { forest } from "./trees";
import { blob, glowSprite, matVC, merge, piece, ridges, terrainGeo, tmerge, tpiece, xf, type SkySpec } from "./kit";

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

// ============================================================================ 2: castle rooftop at dusk

/** Snow-shader settings per glTF material of the rooftop model (the base game's tuned look). */
const SNOW_ALBEDO = new THREE.Color(0.52, 0.57, 0.7);
const ROOF_SNOW: Record<string, SnowOpts> = {
  clay_tiles: { amount: 0.58, scale: 0.3, patch: 2.8, far: [12, 26], color: new THREE.Color(0.44, 0.48, 0.6) },
  kawara: { amount: 0.3, scale: 0.35 },
  stone: { amount: 0.6, scale: 0.4 },
  wood_dark: { amount: 0.7 },
  lacquer: { amount: 0.9 },
  pine_needles: { amount: 0.6, scale: 0.9 },
};

/**
 * The castle rooftop at dusk (the base game's Blender-built arena.glb: clay-tile floor, ridge, eaves,
 * the five-tier keep, the compound below, snowy pines and paper lanterns), under a dusk sky.
 */
function buildRooftop(q: QualitySettings): ThemeSpec {
  const group = new THREE.Group();
  const lanterns: { o: THREE.Object3D; mat: THREE.MeshStandardMaterial; rest: THREE.Quaternion; phase: number; light?: THREE.PointLight }[] = [];
  void glbFile("assets/arena.glb")
    .then((tpl) => {
      const root = tpl.clone(true);
      const patched = new Set<THREE.Material>();
      root.traverse((o) => {
        const mesh = o as THREE.Mesh;
        if (!mesh.isMesh) return;
        const near = /^Roof_|^Lantern/.test(mesh.name) || /^Lantern/.test(mesh.parent?.name ?? "");
        mesh.receiveShadow = near;
        mesh.castShadow = near && !/_clay|_snow/.test(mesh.name);
        for (const m of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) {
          const mat = m as THREE.MeshStandardMaterial;
          if (patched.has(mat)) continue;
          patched.add(mat);
          const base = mat.name.split("__")[0];
          if (ROOF_SNOW[base]) snowify(mat, ROOF_SNOW[base]);
          if (base === "snow") mat.color.copy(SNOW_ALBEDO);
        }
      });
      const R = rng(17);
      let lights = 0;
      root.traverse((o) => {
        if (!/^LanternHang_\d+/.test(o.name)) return;
        let mat: THREE.MeshStandardMaterial | null = null;
        o.traverse((c) => {
          const m = c as THREE.Mesh;
          if (!m.isMesh || (m.material as THREE.Material).name !== "lantern_paper") return;
          mat ??= ((m.material as THREE.MeshStandardMaterial).clone() as THREE.MeshStandardMaterial);
          mat.emissive.set(0xff9a45);
          m.material = mat;
        });
        if (!mat) return;
        const L: (typeof lanterns)[number] = { o, mat, rest: o.quaternion.clone(), phase: R() * 6 };
        if (o.name.endsWith("_L") && lights < Math.min(2, q.pointLights)) {
          const pl = new THREE.PointLight(0xff8a3c, 16, 13, 1.35);
          pl.position.y = -0.45;
          o.add(pl);
          L.light = pl;
          lights++;
        }
        lanterns.push(L);
      });
      group.add(root);
    })
    .catch((e) => console.warn("[arena] rooftop missing", e));
  // distant ranges in the dusk haze (the sky photo has no ground)
  group.add(
    ridges(
      [
        { radius: 900, height: 150, base: 20, color: 0x2a2838, haze: 0.7, seed: 3, jag: 0.6 },
        { radius: 520, height: 90, base: 0, color: 0x1c1b28, haze: 0.45, seed: 11, jag: 0.8 },
      ],
      0x6e5a66,
    ),
  );
  const sw = new THREE.Quaternion();
  const ax = new THREE.Vector3(1, 0, 0.3).normalize();
  return {
    id: 2,
    name: "Castle Rooftop",
    line: "Dusk over the keep. Snow on the tiles, lanterns in the wind.",
    group,
    hdri: "sky_dusk",
    sunFrom: v3(-0.86, 0.3, -0.49),
    sunMinElev: 0.22,
    fog: { color: 0x6e5a66, density: 0.0105, fromSky: 0.5 },
    key: { color: 0xffc784, intensity: 3.1 },
    fill: { color: 0x93a3d6, intensity: 0.8, dir: v3(-0.4, 0.3, 0.9) },
    hemi: { sky: 0x5f6c96, ground: 0x262c3e, intensity: 0.55 },
    env: 0.55,
    sky: { sun: v3(-0.86, 0.14, -0.49), top: 0x2a2a44, mid: 0x6a5468, horizon: 0xc7967a, sunColor: 0xffb070, disc: 6, glow: 1.2, cloudLit: 0xffb890, cloudDark: 0x3a3048, cloudAmount: 0.6, stars: 0 },
    sunColor: 0xffb070,
    particles: "snow",
    look: { exposure: 1.0, bloom: 0.5, rays: 0.08, gain: [1.03, 0.98, 1.0] },
    update(t, wind) {
      for (const L of lanterns) {
        const s = Math.sin(t * 1.3 + L.phase) * (0.05 + wind * 0.08);
        L.o.quaternion.copy(L.rest).multiply(sw.setFromAxisAngle(ax, s));
        const f = 3.8 + Math.sin(t * 7.1 + L.phase) * 0.35 + Math.sin(t * 12.7 + L.phase * 2) * 0.2;
        L.mat.emissiveIntensity = f;
        if (L.light) L.light.intensity = f * 4;
      }
    },
  };
}

// ============================================================================ 3: sakura grove

/** Fallen petals: a pale pink carpet thinning toward the trees' edges. One instanced draw. */
function petalCarpet(n: number, rMax: number, seed: number): THREE.InstancedMesh {
  const R = rng(seed);
  const geo = new THREE.CircleGeometry(0.022, 5);
  geo.rotateX(-Math.PI / 2);
  const mesh = new THREE.InstancedMesh(geo, new THREE.MeshStandardMaterial({ roughness: 0.8, side: THREE.DoubleSide }), n);
  const m = new THREE.Matrix4();
  const c = new THREE.Color();
  const pinks = [0xe9b4c2, 0xdfa0b2, 0xf0c8d2, 0xd894a8].map((h) => new THREE.Color(h));
  for (let i = 0; i < n; i++) {
    const r = rMax * Math.pow(R(), 0.6);
    const a = R() * Math.PI * 2;
    m.compose(new THREE.Vector3(Math.cos(a) * r, 0.012 + R() * 0.01, Math.sin(a) * r), new THREE.Quaternion().setFromEuler(new THREE.Euler((R() - 0.5) * 0.4, R() * 6.28, (R() - 0.5) * 0.4)), new THREE.Vector3(1 + R(), 1, 0.7 + R() * 0.6));
    mesh.setMatrixAt(i, m);
    mesh.setColorAt(i, c.copy(pinks[i % pinks.length]).multiplyScalar(0.85 + R() * 0.25));
  }
  mesh.receiveShadow = true;
  return mesh;
}

/** The final duel: a cherry grove in full bloom on a spring afternoon, an ancient sakura behind him. */
function buildSakura(): ThemeSpec {
  const R = rng(404);
  const group = new THREE.Group();
  groundPlates(group, pbr("forest_ground_04", { color: 0xb9bf9c, normal: 1.0 }), pbr("forest_ground_04", { color: 0xa8ae8c, normal: 0.9 }), 3.6, 3.6, 2.4, 41);
  // stepping stones across the ring, the path to the old tree
  const stones: THREE.BufferGeometry[] = [];
  for (let i = 0; i < 26; i++) {
    const z = 15 - i * 1.55;
    stones.push(tpiece(blob(0.42 + R() * 0.12, 1, R, 0.25), xf((R() - 0.5) * 0.5, 0.03, z, 0, R() * 6, 0, 1.2, 0.18, 0.95), 1.2));
  }
  group.add(new THREE.Mesh(tmerge(stones), pbr("stone_pathway", { color: 0xd8d2c8 })));
  group.add(petalCarpet(16000, 40, 7));
  // the ancient sakura behind him, then the grove all round
  group.add(forest("sakura", [[0, -31, 2.4]], 61));
  const ring: [number, number, number][] = [];
  for (let i = 0; i < 34; i++) {
    const a = (i / 34) * Math.PI * 2 + (R() - 0.5) * 0.18;
    const r = 23 + R() * 14;
    const x = Math.cos(a) * r, z = Math.sin(a) * r;
    if (z > 12 && Math.abs(x) < 10) continue; // keep the camera's side open
    ring.push([x, z, 1.05 + R() * 0.55]);
  }
  group.add(forest("sakura", ring, 62));
  group.add(forest("cedar", Array.from({ length: 16 }, (_, i): [number, number, number] => {
    const a = Math.PI * (1.15 + (i / 15) * 0.7);
    return [Math.cos(a) * (52 + R() * 10), Math.sin(a) * (52 + R() * 10), 1 + R() * 0.4];
  }), 63));
  const gate = torii(R);
  gate.position.set(0, 0, -19);
  gate.scale.setScalar(0.85);
  group.add(gate);
  const lamps: THREE.MeshStandardMaterial[] = [];
  for (const [x, z] of [[-4.2, -17.5], [4.2, -17.5], [-15.5, -4], [15.5, -4]] as const) {
    const l = toro(R);
    l.group.position.set(x, 0, z);
    l.group.scale.setScalar(1.2);
    group.add(l.group);
    lamps.push(l.glow);
  }
  scatter(group, "rock_moss_set_01", [
    { x: -18, z: -12, s: 1.5, ry: 1 },
    { x: 19, z: -9, s: 1.7, ry: 2.5 },
    { x: -9, z: -24, s: 1.3, ry: 4 },
  ]);
  group.add(
    ridges(
      [
        { radius: 700, height: 110, base: 10, color: 0x6f86a0, haze: 0.75, seed: 5, jag: 0.5 },
        { radius: 380, height: 60, base: 0, color: 0x4e6a5a, haze: 0.5, seed: 9, jag: 0.6 },
      ],
      0xd8dce6,
    ),
  );
  return {
    id: 3,
    name: "Sakura Grove",
    line: "Spring. The old cherry is in full bloom, and the petals do not stop falling.",
    group,
    hdri: "kloofendal_48d_partly_cloudy_puresky",
    sunFrom: SUN_LEFT,
    sunMinElev: 0.6,
    fog: { color: 0xd8dce6, density: 0.0065, fromSky: 0.5 },
    key: { color: 0xfff1e0, intensity: 3.0 },
    fill: { color: 0xc6d4ff, intensity: 0.6, dir: v3(0.4, 0.3, 0.9) },
    hemi: { sky: 0xdfe8f6, ground: 0x6a5a50, intensity: 0.6 },
    env: 1.0,
    sky: { sun: SUN_LEFT, top: 0x6a90c8, mid: 0xa9c2de, horizon: 0xe6e8ee, sunColor: 0xfff4e0, disc: 0, glow: 0.8, cloudLit: 0xffffff, cloudDark: 0xb4bccc, cloudAmount: 0.5, stars: 0 },
    sunColor: 0xfff4e0,
    particles: "petal",
    look: { exposure: 1.0, bloom: 0.38, rays: 0.05, gain: [1.03, 1.0, 1.0] },
    update(t) {
      for (let i = 0; i < lamps.length; i++) lamps[i].emissiveIntensity = 1.4 + Math.sin(t * 6.1 + i * 2.1) * 0.15;
    },
  };
}

export function buildTheme(id: ThemeId, q: QualitySettings): ThemeSpec {
  return id === 1 ? buildShrine() : id === 2 ? buildRooftop(q) : buildSakura();
}
