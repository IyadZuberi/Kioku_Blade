/**
 * Character looks, done as paint over the shared bodies: the general and the player are the same
 * rigs for every chapter (so every animation, hit window and rim light keeps working), but each
 * boss gets its own palette and a distinctive piece of gear, and the player wears our own colours.
 */
import * as THREE from "three";
import type { BossLook } from "../game/bosses";

type Standardish = THREE.MeshStandardMaterial | THREE.MeshPhysicalMaterial;
interface Saved {
  look: string;
  mats: Map<Standardish, { color: THREE.Color; emissive: THREE.Color; ei: number }>;
  extras: THREE.Object3D[];
}
const saved = new WeakMap<THREE.Object3D, Saved>();

const isStd = (m: THREE.Material): m is Standardish => (m as Standardish).isMeshStandardMaterial === true;

interface BodyLike {
  rig: { root: THREE.Object3D };
  bones?: Map<string, THREE.Bone>;
}

function materials(root: THREE.Object3D): Standardish[] {
  const out = new Set<Standardish>();
  root.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh) return;
    for (const x of Array.isArray(m.material) ? m.material : [m.material]) if (isStd(x)) out.add(x);
  });
  return [...out];
}

function restore(root: THREE.Object3D): void {
  const s = saved.get(root);
  if (!s) return;
  for (const [m, o] of s.mats) {
    m.color.copy(o.color);
    m.emissive.copy(o.emissive);
    m.emissiveIntensity = o.ei;
  }
  for (const e of s.extras) e.removeFromParent();
  saved.delete(root);
}

function straw(): THREE.Mesh {
  const g = new THREE.ConeGeometry(0.62, 0.3, 24, 1, false);
  const hat = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ color: 0xc9b57a, roughness: 0.95, side: THREE.DoubleSide }));
  hat.position.set(0, 0.26, 0.02);
  hat.castShadow = true;
  return hat;
}

/** Tint + gear for a boss's look. Idempotent: applying the same look twice does nothing. */
export function applyBossLook(body: BodyLike, look: BossLook): void {
  const root = body.rig.root;
  if (saved.get(root)?.look === look) return;
  restore(root);
  if (look === "ronin") return;
  const mats = new Map<Standardish, { color: THREE.Color; emissive: THREE.Color; ei: number }>();
  const mul = look === "reed" ? new THREE.Color(0.62, 0.95, 0.9) : new THREE.Color(0.5, 0.36, 0.38);
  for (const m of materials(root)) {
    mats.set(m, { color: m.color.clone(), emissive: m.emissive.clone(), ei: m.emissiveIntensity });
    m.color.multiply(mul);
  }
  const extras: THREE.Object3D[] = [];
  const head = body.bones?.get("Head");
  const attach = (bone: THREE.Bone | undefined, o: THREE.Object3D) => {
    if (!bone) return;
    const s = bone.getWorldScale(new THREE.Vector3());
    o.scale.multiplyScalar(1 / (s.x || 1));
    o.position.multiplyScalar(1 / (s.x || 1));
    bone.add(o);
    extras.push(o);
  };
  if (look === "reed") attach(head, straw());
  saved.set(root, { look, mats, extras });
}

/** The player's own palette: the base game's red and brown become indigo and ink, with the white and gold kept. */
export function applyPlayerLook(body: BodyLike): void {
  const root = body.rig.root;
  if (saved.get(root)?.look === "player") return;
  const mats = new Map<Standardish, { color: THREE.Color; emissive: THREE.Color; ei: number }>();
  const hsl = { h: 0, s: 0, l: 0 };
  for (const m of materials(root)) {
    m.color.getHSL(hsl);
    const redish = hsl.s > 0.25 && (hsl.h < 0.07 || hsl.h > 0.93);
    const brown = hsl.s > 0.25 && hsl.h >= 0.07 && hsl.h < 0.12;
    if (!redish && !brown) continue;
    mats.set(m, { color: m.color.clone(), emissive: m.emissive.clone(), ei: m.emissiveIntensity });
    m.color.setHSL(redish ? 0.61 : 0.58, Math.min(0.6, hsl.s * 0.8), Math.max(0.16, hsl.l * (redish ? 1.05 : 0.9)));
  }
  saved.set(root, { look: "player", mats, extras: [] });
}
