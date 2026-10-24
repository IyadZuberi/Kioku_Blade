/**
 * Drifting particles in a box that wraps around the camera: snow, maple leaves, petals or rising
 * embers (one GPU-animated Points object; the arena theme picks the kind).
 */
import * as THREE from "three";
import { rng } from "../core/math";
import { SUN_DIR } from "../world/materials";

export type ParticleKind = "snow" | "maple" | "petal" | "ember";
const KIND_ID: Record<ParticleKind, number> = { snow: 0, maple: 1, petal: 2, ember: 3 };

export class Snow {
  readonly points: THREE.Points;
  private readonly mat: THREE.ShaderMaterial;

  constructor(count = 1800, kind: ParticleKind = "snow") {
    const R = rng(42);
    const pos = new Float32Array(count * 3);
    const seed = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      pos[i * 3] = R() * 60;
      pos[i * 3 + 1] = R() * 26;
      pos[i * 3 + 2] = R() * 60;
      seed[i] = R();
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    geo.setAttribute("aSeed", new THREE.BufferAttribute(seed, 1));
    this.mat = new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uCam: { value: new THREE.Vector3() },
        uWind: { value: new THREE.Vector3(-1.4, 0, 0.6) },
        uSun: { value: SUN_DIR.clone() },
        uScale: { value: 600 },
        uKind: { value: KIND_ID[kind] },
      },
      vertexShader: /* glsl */ `
        attribute float aSeed;
        uniform float uTime; uniform vec3 uCam; uniform vec3 uWind; uniform float uScale; uniform vec3 uSun; uniform float uKind;
        varying float vA; varying float vGlint; varying float vS;
        void main() {
          vS = aSeed;
          vec3 box = vec3(60.0, 26.0, 60.0);
          vec3 p = position;
          // fall speed (negative = rises), wind share, size, flutter per kind: snow, maple, petal, ember
          float fall = uKind < 0.5 ? 0.7 + aSeed * 0.9 : uKind < 1.5 ? 0.35 + aSeed * 0.5 : uKind < 2.5 ? 0.25 + aSeed * 0.35 : -(0.5 + aSeed * 0.8);
          float windK = uKind < 0.5 ? 1.0 : uKind < 1.5 ? 1.8 : uKind < 2.5 ? 2.3 : 0.4;
          float flut = uKind < 0.5 ? 0.4 : uKind < 1.5 ? 0.9 : uKind < 2.5 ? 1.1 : 0.25;
          p += uWind * uTime * (0.6 + aSeed * 0.6) * windK;
          p.y -= uTime * fall;
          p.x += sin(uTime * (0.8 + aSeed) + aSeed * 40.0) * flut;
          p.z += cos(uTime * (0.6 + aSeed * 0.7) + aSeed * 23.0) * flut;
          vec3 origin = uCam - box * 0.5;
          origin.y = uCam.y - 10.0;
          p = mod(p - origin, box) + origin;
          vec4 mv = viewMatrix * vec4(p, 1.0);
          gl_Position = projectionMatrix * mv;
          float size = uKind < 0.5 ? 0.028 + aSeed * 0.035 : uKind < 1.5 ? 0.1 + aSeed * 0.12 : uKind < 2.5 ? 0.07 + aSeed * 0.07 : 0.03 + aSeed * 0.04;
          gl_PointSize = clamp(size * uScale / -mv.z, 1.0, 14.0);
          vec3 d = normalize(p - cameraPosition);
          vGlint = pow(max(dot(d, uSun), 0.0), 6.0);
          float dist = -mv.z;
          vA = smoothstep(0.3, 1.2, dist) * (1.0 - smoothstep(22.0, 32.0, dist));
        }`,
      fragmentShader: /* glsl */ `
        uniform float uKind;
        varying float vA; varying float vGlint; varying float vS;
        void main() {
          vec2 c = gl_PointCoord - 0.5;
          float d = length(c);
          float a = (1.0 - smoothstep(0.1, 0.5, d)) * vA;
          vec3 col = mix(vec3(0.62, 0.68, 0.86), vec3(3.8, 1.75, 0.8), vGlint);
          if (uKind > 2.5) {
            // embers: hot gold core that flickers per particle
            col = mix(vec3(1.8, 0.8, 0.2), vec3(3.2, 2.0, 0.7), vS) * (0.7 + 0.3 * sin(vS * 60.0));
            a *= 0.9;
          } else if (uKind > 1.5) {
            // petals: pale pink to white
            vec3 pal = vS < 0.5 ? vec3(1.15, 0.8, 0.85) : vec3(1.2, 1.1, 1.05);
            col = mix(pal, pal * 1.8, vGlint);
            a *= 0.8;
          } else if (uKind > 0.5) {
            // maple leaves: red, amber, gold, warmer toward the sun
            vec3 pal = vS < 0.35 ? vec3(1.1, 0.22, 0.08) : (vS < 0.7 ? vec3(1.2, 0.55, 0.1) : vec3(1.25, 0.85, 0.25));
            col = mix(pal, pal * 2.2, vGlint);
            a *= 0.85;
          }
          gl_FragColor = vec4(col * a, a * 0.9);
        }`,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    this.points = new THREE.Points(geo, this.mat);
    this.points.frustumCulled = false;
    this.points.renderOrder = 6;
  }

  setKind(kind: ParticleKind): void {
    this.mat.uniforms.uKind.value = KIND_ID[kind];
  }

  update(t: number, cam: THREE.Vector3, wind: number, viewportH: number): void {
    this.mat.uniforms.uTime.value = t;
    this.mat.uniforms.uCam.value.copy(cam);
    this.mat.uniforms.uWind.value.set(-1.2 - wind * 2.4, 0, 0.5 + wind * 0.8);
    this.mat.uniforms.uScale.value = viewportH * 0.9;
  }
}
