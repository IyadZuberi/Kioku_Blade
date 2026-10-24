/**
 * Character looks, done as paint over the shared bodies: the general and the player are the same
 * rigs for every chapter (so every animation, hit window and rim light keeps working), but each
 * boss gets its own palette and a distinctive piece of gear, and the player wears our own colours.
 */
import * as THREE from "three";
import type { BossLook } from "../game/bosses";
import { makeWeapon, type Weapon, type WeaponKind } from "./weapons";

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
  setWeapon?(w: Weapon | null): void;
}

/** Each general's signature weapon (built once). */
const WEAPON_OF: Record<BossLook, WeaponKind> = { ronin: "katana", reed: "yari", hollow: "odachi" };
const weapons = new Map<WeaponKind, Weapon>();
const weapon = (k: WeaponKind) => weapons.get(k) ?? (weapons.set(k, makeWeapon(k)), weapons.get(k)!);

/** Kurogane's sashimono: a tall back banner on a lacquered pole (black field, a white ring). */
function sashimono(): THREE.Group {
  const g = new THREE.Group();
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.016, 1.3, 8), new THREE.MeshStandardMaterial({ color: 0x1a1210, roughness: 0.5 }));
  pole.position.y = 0.45;
  const c = document.createElement("canvas");
  c.width = 64;
  c.height = 192;
  const x = c.getContext("2d")!;
  x.fillStyle = "#121012";
  x.fillRect(0, 0, 64, 192);
  x.strokeStyle = "#e9e1d2";
  x.lineWidth = 7;
  x.beginPath();
  x.arc(32, 52, 19, 0, Math.PI * 2);
  x.stroke();
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const flag = new THREE.Mesh(new THREE.PlaneGeometry(0.28, 0.78), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.95, side: THREE.DoubleSide }));
  // in the plane of the back, beside the pole; the whole banner rides behind the shoulders
  flag.position.set(0.15, 0.7, 0);
  g.add(pole, flag);
  // measured, not guessed (tools: banner vs chest along his facing): this sits ~0.4 m behind the chest
  g.position.z = -0.85;
  g.rotation.x = -0.12;
  g.traverse((o) => (o.castShadow = true));
  return g;
}

/** Kurogane's crest: a gold crescent maedate rising from the helmet brow. */
function crescent(): THREE.Mesh {
  const m = new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.018, 6, 24, Math.PI), new THREE.MeshStandardMaterial({ color: 0xc9a040, metalness: 0.9, roughness: 0.3 }));
  m.position.set(0, 0.32, 0.12);
  m.castShadow = true;
  return m;
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
  root.scale.setScalar(1);
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
  body.setWeapon?.(weapon(WEAPON_OF[look]));
  if (look === "ronin") {
    saved.set(root, { look, mats: new Map(), extras: [] });
    return;
  }
  const mats = new Map<Standardish, { color: THREE.Color; emissive: THREE.Color; ei: number }>();
  // The armour is near-black lacquer, so a multiply barely shows: pull every colour toward the
  // general's own lacquer (Kazemaru: weathered indigo-teal; Kurogane: dried-blood crimson).
  const lacquer = look === "reed" ? new THREE.Color(0x3c6470) : new THREE.Color(0x6a1712);
  const k = look === "reed" ? 0.55 : 0.5;
  for (const m of materials(root)) {
    mats.set(m, { color: m.color.clone(), emissive: m.emissive.clone(), ei: m.emissiveIntensity });
    // the colour multiplies a dark lacquer texture: lift it well past white so the hue reads
    m.color.lerp(lacquer, k).multiplyScalar(look === "reed" ? 2.6 : 2.2);
    // its blacks are true black: a faint self-colour lifts them into the general's lacquer
    m.emissive.copy(lacquer);
    m.emissiveIntensity = look === "reed" ? 0.22 : 0.2;
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
  if (look === "hollow") {
    // the shogun stands a head taller than the others
    root.scale.setScalar(1.12);
    attach(head, crescent());
    attach(body.bones?.get("Spine2"), sashimono());
  }
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
