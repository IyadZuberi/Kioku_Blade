/**
 * Boss hazards that are not blade contacts: the wind cut Kaze-no-Tomoe throws (windSlash) and the
 * ground ring of the Hollow Shogun's slam (shockwave). The maths is pure and tested; the Hazards
 * class owns the meshes and reports hits to the game, which resolves them with the same guard,
 * deflect and damage rules as any other blow.
 */
import * as THREE from "three";

export const WAVE = { speed: 9, life: 2.4, reach: 1.0, dmg: 16, posture: 16 };
export const RING = { speed: 7.2, r0: 1.4, rMax: 11.5, dmg: 20, posture: 18 };

export interface Wave {
  x: number;
  z: number;
  dx: number;
  dz: number;
  age: number;
  hit: boolean;
  dead: boolean;
}
export interface Ring {
  x: number;
  z: number;
  t: number;
  hit: boolean;
}

/** A wind cut leaving (x,z) toward (tx,tz). */
export function makeWave(x: number, z: number, tx: number, tz: number): Wave {
  let dx = tx - x, dz = tz - z;
  const l = Math.hypot(dx, dz);
  if (l < 1e-6) (dx = 0), (dz = 1);
  else (dx /= l), (dz /= l);
  return { x, z, dx, dz, age: 0, hit: false, dead: false };
}

export function stepWave(w: Wave, dt: number): void {
  w.x += w.dx * WAVE.speed * dt;
  w.z += w.dz * WAVE.speed * dt;
  w.age += dt;
  if (w.age >= WAVE.life) w.dead = true;
}

/** Cleared by being in the air (y above the ankles). */
export function waveHits(w: Wave, px: number, pz: number, py: number): boolean {
  if (w.hit || w.dead || py > 0.8) return false;
  return Math.hypot(px - w.x, pz - w.z) < WAVE.reach;
}

export const ringRadius = (t: number): number => RING.r0 + RING.speed * t;
export const ringHalfWidth = (r: number): number => 0.35 + 0.04 * r;

/** Cleared by jumping (feet off the ground). */
export function ringHits(g: Ring, px: number, pz: number, py: number): boolean {
  if (g.hit || py > 0.35) return false;
  const r = ringRadius(g.t);
  return Math.abs(Math.hypot(px - g.x, pz - g.z) - r) < ringHalfWidth(r);
}

// ----------------------------------------------------------------------------- meshes

interface WaveObj {
  s: Wave;
  mesh: THREE.Group;
}
interface RingObj {
  s: Ring;
  mesh: THREE.Mesh;
}

const waveMat = () => new THREE.MeshBasicMaterial({ color: new THREE.Color(2.4, 2.8, 3.2), transparent: true, opacity: 0.92, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, fog: false });

export class Hazards {
  private waves: WaveObj[] = [];
  private rings: RingObj[] = [];
  private readonly waveGeo = new THREE.RingGeometry(1.0, 1.2, 24, 1, -0.95, 1.9).rotateX(-Math.PI / 2);
  private readonly waveGeo2 = new THREE.RingGeometry(0.8, 0.9, 24, 1, -0.8, 1.6).rotateX(-Math.PI / 2);
  private readonly ringGeo = new THREE.RingGeometry(0.93, 1.0, 72).rotateX(-Math.PI / 2);

  constructor(private readonly scene: THREE.Scene) {}

  addWave(from: THREE.Vector3, to: THREE.Vector3): void {
    const s = makeWave(from.x, from.z, to.x, to.z);
    const g = new THREE.Group();
    const a = new THREE.Mesh(this.waveGeo, waveMat());
    const b = new THREE.Mesh(this.waveGeo2, waveMat());
    a.position.y = 0.45;
    b.position.y = 0.8;
    g.add(a, b);
    g.scale.set(1.3, 1, 1.3);
    g.rotation.y = -Math.atan2(s.dz, s.dx);
    g.position.set(s.x, 0, s.z);
    this.scene.add(g);
    this.waves.push({ s, mesh: g });
  }

  addRing(at: THREE.Vector3): void {
    const m = new THREE.Mesh(
      this.ringGeo,
      new THREE.MeshBasicMaterial({ color: new THREE.Color(3.0, 2.0, 0.8), transparent: true, opacity: 0.9, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, fog: false }),
    );
    m.position.set(at.x, 0.14, at.z);
    m.scale.setScalar(RING.r0);
    this.scene.add(m);
    this.rings.push({ s: { x: at.x, z: at.z, t: 0, hit: false }, mesh: m });
  }

  clear(): void {
    for (const w of this.waves) this.drop(w.mesh);
    for (const r of this.rings) this.drop(r.mesh);
    this.waves = [];
    this.rings = [];
  }

  private drop(o: THREE.Object3D): void {
    this.scene.remove(o);
    o.traverse((c) => {
      const m = c as THREE.Mesh;
      if (m.isMesh) (Array.isArray(m.material) ? m.material : [m.material]).forEach((x) => x.dispose());
    });
  }

  /** Advance everything; `hit` fires once per hazard that reaches a grounded, undodged player. */
  update(dt: number, player: THREE.Vector3, invulnerable: boolean, hit: (kind: "wave" | "ring", at: THREE.Vector3) => void, evaded: (kind: "wave" | "ring") => void): void {
    for (const w of this.waves) {
      const was = Math.hypot(player.x - w.s.x, player.z - w.s.z);
      stepWave(w.s, dt);
      w.mesh.position.set(w.s.x, 0, w.s.z);
      (w.mesh.children as THREE.Mesh[]).forEach((c) => ((c.material as THREE.MeshBasicMaterial).opacity = 0.92 * Math.min(1, (WAVE.life - w.s.age) * 2)));
      if (waveHits(w.s, player.x, player.z, player.y)) {
        w.s.hit = true;
        w.s.dead = true;
        if (invulnerable) evaded("wave");
        else hit("wave", new THREE.Vector3(w.s.x, 0.9, w.s.z));
      } else if (!w.s.hit && was < WAVE.reach + 0.6 && player.y > 0.8) evaded("wave");
    }
    for (const r of this.rings) {
      r.s.t += dt;
      const rad = ringRadius(r.s.t);
      r.mesh.scale.setScalar(rad);
      (r.mesh.material as THREE.MeshBasicMaterial).opacity = 0.9 * Math.max(0, 1 - (rad - RING.r0) / (RING.rMax - RING.r0));
      if (ringHits(r.s, player.x, player.z, player.y)) {
        r.s.hit = true;
        if (invulnerable) evaded("ring");
        else hit("ring", new THREE.Vector3(player.x, 0.3, player.z));
      }
    }
    this.waves = this.waves.filter((w) => (w.s.dead ? (this.drop(w.mesh), false) : true));
    this.rings = this.rings.filter((r) => (ringRadius(r.s.t) > RING.rMax ? (this.drop(r.mesh), false) : true));
  }
}
