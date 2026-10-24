/**
 * The generals' signature weapons, built in code (world metres, +Y from the grip toward the tip, the
 * edge toward +Z): Masatora's katana, Kazemaru's yari (straight spear) and Kurogane's odachi (great
 * sword). Each comes with the blade's hit segment along +Y and the steel material, whose glow shows
 * when the general stands ready to parry.
 */
import * as THREE from "three";

export type WeaponKind = "katana" | "yari" | "odachi";

export interface Weapon {
  group: THREE.Group;
  /** Hit segment along +Y, metres from the grip: [hilt, tip]. */
  hilt: number;
  tip: number;
  /** The polished steel: its emissive is driven for the parry stance. */
  steel: THREE.MeshStandardMaterial;
}

const steelMat = () => new THREE.MeshStandardMaterial({ color: 0xd9dde2, metalness: 1, roughness: 0.22, side: THREE.DoubleSide, emissive: new THREE.Color(0x5aa8ff), emissiveIntensity: 0 });
const lacquer = (c: number) => new THREE.MeshStandardMaterial({ color: c, metalness: 0.1, roughness: 0.45 });
const wrap = () => new THREE.MeshStandardMaterial({ color: 0x1a1414, roughness: 0.9 });
const brass = () => new THREE.MeshStandardMaterial({ color: 0x8a6a2c, metalness: 0.9, roughness: 0.4 });

const cyl = (r0: number, r1: number, y0: number, y1: number, m: THREE.Material, seg = 10) => {
  const g = new THREE.Mesh(new THREE.CylinderGeometry(r1, r0, y1 - y0, seg), m);
  g.position.y = (y0 + y1) / 2;
  return g;
};

/** A slightly curved single-edged blade from y0 to y1: tapered box segments with a kissaki at the tip. */
function curvedBlade(y0: number, y1: number, width: number, sori: number, m: THREE.Material): THREE.Mesh {
  const n = 12;
  const pos: number[] = [];
  const idx: number[] = [];
  const th = width * 0.22;
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const y = y0 + (y1 - y0) * t;
    const z = -sori * Math.sin(t * Math.PI * 0.5) * t; // the spine curves back
    const w = i === n ? 0 : width * (1 - 0.25 * t);
    // spine (back, -Z side), edge (+Z), and two flats (±X) at the ridge
    pos.push(0, y, z - w * 0.5, th * 0.5, y, z, 0, y, z + w * 0.5, -th * 0.5, y, z);
  }
  for (let i = 0; i < n; i++) {
    const a = i * 4, b = a + 4;
    for (let k = 0; k < 4; k++) {
      const k1 = (k + 1) % 4;
      idx.push(a + k, b + k, a + k1, a + k1, b + k, b + k1);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return new THREE.Mesh(g, m);
}

export function makeWeapon(kind: WeaponKind): Weapon {
  const group = new THREE.Group();
  const steel = steelMat();
  if (kind === "katana") {
    group.add(cyl(0.017, 0.016, -0.26, 0.06, wrap()), cyl(0.045, 0.045, 0.06, 0.075, brass(), 16), curvedBlade(0.075, 1.05, 0.034, 0.03, steel));
    return { group, hilt: 0.09, tip: 1.05, steel };
  }
  if (kind === "odachi") {
    group.add(cyl(0.02, 0.019, -0.46, 0.07, wrap()), cyl(0.06, 0.06, 0.07, 0.09, brass(), 18), curvedBlade(0.09, 1.62, 0.042, 0.05, steel));
    return { group, hilt: 0.12, tip: 1.62, steel };
  }
  // yari: a long red-lacquered shaft held near its middle, a brass collar and a straight leaf blade
  group.add(cyl(0.02, 0.018, -1.05, 1.3, lacquer(0x5a1610), 10), cyl(0.026, 0.026, 1.28, 1.36, brass(), 12));
  const blade = new THREE.Mesh(new THREE.OctahedronGeometry(1, 0), steel);
  blade.scale.set(0.022, 0.2, 0.014);
  blade.position.y = 1.56;
  group.add(blade);
  return { group, hilt: 0.4, tip: 1.76, steel };
}
