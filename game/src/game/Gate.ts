/**
 * The gate to the next general: a great vermilion torii rises out of the ground and its opening fills
 * with a slow, misty light (soft-edged, drifting, brightest at the heart), with motes rising through it.
 * After a victory that unlocks a new chapter the player walks through it (see Game.beginGate).
 */
import * as THREE from "three";
import { rng } from "../core/math";
import { torii } from "../world/themes";

const S = 1.25;
const SHEET_W = 7.4 * S;
const SHEET_H = 5.0 * S;
const RISE = 1.7;
const MOTES = 90;

const portalMat = () =>
  new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
    uniforms: { uTime: { value: 0 }, uOpen: { value: 0 } },
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: /* glsl */ `
      uniform float uTime, uOpen;
      varying vec2 vUv;
      float h(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      float n(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
        return mix(mix(h(i), h(i + vec2(1, 0)), f.x), mix(h(i + vec2(0, 1)), h(i + vec2(1, 1)), f.x), f.y); }
      float fbm(vec2 p) { float a = 0.5, s = 0.0; for (int k = 0; k < 3; k++) { s += a * n(p); p *= 2.03; a *= 0.5; } return s; }
      void main() {
        vec2 c = vUv - 0.5;
        // soft edges: nothing at the posts and lintel, full light inside
        float edge = smoothstep(0.0, 0.16, vUv.x) * smoothstep(1.0, 0.84, vUv.x) * smoothstep(0.0, 0.05, vUv.y) * smoothstep(1.0, 0.86, vUv.y);
        float mist = fbm(vec2(c.x * 3.0 + sin(c.y * 5.0 + uTime * 0.3) * 0.3, c.y * 2.0 - uTime * 0.18));
        float heart = exp(-dot(c * vec2(1.6, 1.1), c * vec2(1.6, 1.1)) * 6.0);
        // the light fills from the ground up as the gate opens
        float fill = smoothstep(uOpen * 1.25 - 0.05, uOpen * 1.25 - 0.3, vUv.y);
        float wisps = smoothstep(0.35, 0.85, mist);
        float a = edge * fill * (0.08 + 0.55 * wisps + 0.75 * heart * (0.6 + 0.4 * mist));
        vec3 col = mix(vec3(1.0, 0.66, 0.36), vec3(1.0, 0.96, 0.88), heart) * 1.8;
        gl_FragColor = vec4(col * a * uOpen, 1.0);
      }`,
  });

export class Gate {
  readonly group = new THREE.Group();
  private readonly frame: THREE.Group;
  private readonly portal: THREE.ShaderMaterial;
  private readonly motes: THREE.Points;
  private readonly moteSeed: Float32Array;
  /** Where a body must cross to count as through (world z; the gate faces +z, toward the arena). */
  z = 0;

  constructor(scene: THREE.Scene) {
    this.frame = torii(rng(5));
    this.frame.scale.setScalar(S);
    this.group.add(this.frame);
    this.portal = portalMat();
    const sheet = new THREE.Mesh(new THREE.PlaneGeometry(SHEET_W, SHEET_H), this.portal);
    sheet.position.y = SHEET_H / 2 + 0.05;
    this.frame.add(sheet);
    sheet.scale.setScalar(1 / S);
    sheet.position.y /= S;
    // motes drifting up through the opening
    const R = rng(77);
    const pos = new Float32Array(MOTES * 3);
    this.moteSeed = new Float32Array(MOTES * 3);
    for (let i = 0; i < MOTES; i++) {
      this.moteSeed[i * 3] = (R() - 0.5) * SHEET_W * 0.85;
      this.moteSeed[i * 3 + 1] = R();
      this.moteSeed[i * 3 + 2] = R() * 6.28;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(pos, 3).setUsage(THREE.DynamicDrawUsage));
    this.motes = new THREE.Points(g, new THREE.PointsMaterial({ color: new THREE.Color(2.2, 1.7, 1.1), size: 0.09, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending }));
    this.motes.frustumCulled = false;
    this.group.add(this.motes);
    this.group.visible = false;
    scene.add(this.group);
  }

  place(x: number, z: number): void {
    this.group.position.set(x, 0, z);
    this.group.visible = true;
    this.z = z;
    this.frame.position.y = -9 * S;
    this.portal.uniforms.uOpen.value = 0;
  }

  hide(): void {
    this.group.visible = false;
  }

  /** Seconds since the gate began rising; true while it is still coming up out of the ground. */
  rising(t: number): boolean {
    return t < RISE;
  }

  /** `t`: seconds since place(); `time`: game clock (for the drift). */
  update(t: number, time: number): void {
    const r = Math.min(1, t / RISE);
    this.frame.position.y = -9 * S * Math.pow(1 - r, 3);
    const open = THREE.MathUtils.smoothstep(t, RISE * 0.7, RISE + 1.6);
    this.portal.uniforms.uOpen.value = open;
    this.portal.uniforms.uTime.value = time;
    const p = this.motes.geometry.attributes.position as THREE.BufferAttribute;
    const H = SHEET_H;
    for (let i = 0; i < MOTES; i++) {
      const s = this.moteSeed;
      const y = ((s[i * 3 + 1] + time * 0.08) % 1) * H;
      p.setXYZ(i, s[i * 3] + Math.sin(time * 0.7 + s[i * 3 + 2]) * 0.25, y + 0.1, Math.sin(time * 0.5 + s[i * 3 + 2] * 2) * 0.6);
    }
    p.needsUpdate = true;
    (this.motes.material as THREE.PointsMaterial).opacity = open * 0.9;
  }
}
