/**
 * Loaders for the CC0 Poly Haven files under public/assets/ph (HDRI skies, PBR textures, decimated
 * rock and cliff scans). Everything is requested once and cached; `settled()` resolves when every
 * request made so far is done, so the loading screen can wait for the arenas.
 */
import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { RGBELoader } from "three/addons/loaders/RGBELoader.js";

const BASE = `${(import.meta as { env?: { BASE_URL?: string } }).env?.BASE_URL ?? "/"}assets/ph/`;
const pending = new Set<Promise<unknown>>();
const track = <T>(p: Promise<T>): Promise<T> => {
  pending.add(p);
  const done = () => pending.delete(p);
  p.then(done, done);
  return p;
};

/** Resolves when all asset requests issued so far (and any they trigger) have finished, failed ones included. */
export async function settled(): Promise<void> {
  while (pending.size) await Promise.allSettled([...pending]);
}

let anisotropy = 4;
export const setAnisotropy = (n: number): void => void (anisotropy = n);

const loader = new THREE.TextureLoader();
const texCache = new Map<string, THREE.Texture>();
function tex(file: string, srgb: boolean): THREE.Texture {
  const hit = texCache.get(file);
  if (hit) return hit;
  const t = new THREE.Texture();
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  t.anisotropy = anisotropy;
  texCache.set(file, t);
  track(
    loader.loadAsync(BASE + file).then((img) => {
      t.image = img.image;
      t.needsUpdate = true;
    }),
  ).catch((e) => console.warn("[assets] texture missing", file, e));
  return t;
}

export interface PbrOpts {
  /** Multiplies the photo colour (tint, darken). */
  color?: THREE.ColorRepresentation;
  rough?: number;
  normal?: number;
  vertexColors?: boolean;
  side?: THREE.Side;
}

/** A Poly Haven texture set (diffuse + GL normal) as a standard material; UVs are metres / tile size, set by the geometry. */
export function pbr(name: string, o: PbrOpts = {}): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({
    map: tex(`tex/${name}_diff.jpg`, true),
    normalMap: tex(`tex/${name}_nor.jpg`, false),
    normalScale: new THREE.Vector2(o.normal ?? 1, o.normal ?? 1),
    color: o.color ?? 0xffffff,
    roughness: o.rough ?? 0.92,
    metalness: 0,
    vertexColors: o.vertexColors ?? false,
    side: o.side ?? THREE.FrontSide,
  });
}

const gltf = new GLTFLoader();
const glbCache = new Map<string, Promise<THREE.Group>>();
/** A decimated scan from public/assets/ph/glb. Resolves to a template; clone() it per placement. */
export function glb(name: string): Promise<THREE.Group> {
  let p = glbCache.get(name);
  if (!p) {
    p = track(gltf.loadAsync(`${BASE}glb/${name}.glb`).then((g) => g.scene));
    glbCache.set(name, p);
  }
  return p;
}

export interface Sky {
  texture: THREE.Texture;
  /** Direction of the brightest spot, in the picture's own space. */
  sun: THREE.Vector3;
  /** Brightness of that spot relative to the sky average (a clear sunset is high, mist is low). */
  sunPower: number;
  /** Average colour just above the horizon (fog and distant ground blend toward it). */
  horizon: THREE.Color;
}

const skyCache = new Map<string, Promise<Sky>>();
/** An HDRI sky: the texture plus where its sun is and what colour its horizon is. */
export function sky(name: string): Promise<Sky> {
  let p = skyCache.get(name);
  if (!p) {
    p = track(
      new RGBELoader().loadAsync(`${BASE}hdri/${name}.hdr`).then((t) => {
        t.mapping = THREE.EquirectangularReflectionMapping;
        t.minFilter = THREE.LinearFilter;
        t.generateMipmaps = false;
        const { width: w, height: h, data } = t.image as { width: number; height: number; data: Uint16Array };
        const f = THREE.DataUtils.fromHalfFloat;
        let best = -1, bi = 0, bj = 0, sum = 0, n = 0;
        const hor = new THREE.Color(0, 0, 0);
        let hn = 0;
        for (let j = 0; j < h; j += 2) {
          const el = (0.5 - (j + 0.5) / h) * Math.PI; // row 0 is the zenith
          for (let i = 0; i < w; i += 2) {
            const k = (j * w + i) * 4;
            const r = f(data[k]), g = f(data[k + 1]), b = f(data[k + 2]);
            const l = 0.2126 * r + 0.7152 * g + 0.0722 * b;
            if (el > 0.03 && l > best) (best = l), (bi = i), (bj = j);
            if (el > 0) (sum += l), n++;
            if (el > 0.02 && el < 0.14) hor.r += r, (hor.g += g), (hor.b += b), hn++;
          }
        }
        const az = ((bi + 0.5) / w - 0.5) * Math.PI * 2;
        const el = (0.5 - (bj + 0.5) / h) * Math.PI;
        const sun = new THREE.Vector3(Math.cos(az) * Math.cos(el), Math.sin(el), Math.sin(az) * Math.cos(el));
        // the horizon average is linear HDR: tone it the way the screen will
        hor.multiplyScalar(1 / Math.max(hn, 1));
        const m = Math.max(hor.r, hor.g, hor.b, 1e-4);
        if (m > 1) hor.multiplyScalar(1 / m);
        return { texture: t, sun, sunPower: best / Math.max(sum / Math.max(n, 1), 1e-4), horizon: hor };
      }),
    );
    skyCache.set(name, p);
  }
  return p;
}
