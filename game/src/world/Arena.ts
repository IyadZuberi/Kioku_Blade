/**
 * The arena: a code-built stage that swaps between the three themes in themes.ts (one per boss).
 * It owns the sky dome, fog, the three lights, the sun/glow mesh the god rays use, and the
 * fighters' rim-light tagging. No model files: it is ready instantly and costs a few thousand
 * triangles instead of half a million.
 */
import * as THREE from "three";
import { type QualitySettings, settingsFor } from "../render/quality";
import { makeSky, setSky } from "./kit";
import { buildTheme, type ThemeId, type ThemeSpec } from "./themes";

/** Walkable half-width and far edge (the duel is clamped to this box, whatever the scenery). */
export const ARENA_HALF = 11.2;
export const RIDGE_Z = -13.2;

/**
 * The fighters' rigid attachments (armour, helmet crest, hat, swords) hang off bones as plain
 * meshes, so they miss the USE_SKINNING rim. Everything under a skinned body's root gets the
 * CHAR_RIM define instead (one recompile when a character appears; character code untouched).
 */
function tagCharacterRim(scene: THREE.Scene): void {
  const roots = new Set<THREE.Object3D>();
  scene.traverse((o) => {
    if (!(o as THREE.SkinnedMesh).isSkinnedMesh) return;
    let r: THREE.Object3D = o;
    while (r.parent && r.parent !== scene) r = r.parent;
    roots.add(r);
  });
  for (const r of roots) {
    r.traverse((o) => {
      const m = o as THREE.Mesh;
      if (!m.isMesh || (m as THREE.SkinnedMesh).isSkinnedMesh) return;
      for (const mat of Array.isArray(m.material) ? m.material : [m.material]) {
        if (!(mat as THREE.MeshStandardMaterial).isMeshStandardMaterial) continue;
        mat.defines ??= {};
        if ("CHAR_RIM" in mat.defines) continue;
        mat.defines.CHAR_RIM = "";
        mat.needsUpdate = true;
      }
    });
  }
}

export class Arena {
  readonly group = new THREE.Group();
  readonly sun: THREE.DirectionalLight;
  readonly fill: THREE.DirectionalLight;
  readonly hemi: THREE.HemisphereLight;
  /** The glow the god rays radiate from (the sun, or the Hollow Tree at night). */
  readonly sunMesh: THREE.Mesh;
  /** Kept for callers that used the old rooftop's `surround.sunMesh`. */
  readonly surround: { sunMesh: THREE.Mesh };
  /** Always true: nothing is streamed any more. */
  loaded = true;
  spec: ThemeSpec | null = null;
  private readonly sky = makeSky();
  private readonly fog = new THREE.FogExp2(0xe4bd98, 0.0085);
  private readonly cache = new Map<ThemeId, ThemeSpec>();
  private renderer: THREE.WebGLRenderer | null = null;
  private envScene = new THREE.Scene();
  private t = 0;
  private rimScan = 0;

  constructor(
    private readonly scene: THREE.Scene,
    private readonly q: QualitySettings = settingsFor("high"),
  ) {
    scene.add(this.group);
    scene.fog = this.fog;
    scene.background = new THREE.Color(0x000000);
    this.group.add(this.sky);
    this.envScene.add(new THREE.Mesh(this.sky.geometry, this.sky.material));

    this.sun = new THREE.DirectionalLight(0xffc784, 3.3);
    this.sun.castShadow = true;
    // One map over the duel ring; only the fighters cast, so it is cheap and the edges stay soft.
    const size = Math.min(this.q.shadowMap, 2048);
    this.sun.shadow.mapSize.set(size, size);
    const sc = this.sun.shadow.camera;
    sc.left = -15;
    sc.right = 15;
    sc.top = 15;
    sc.bottom = -15;
    sc.near = 5;
    sc.far = 90;
    this.sun.shadow.bias = -0.0004;
    this.sun.shadow.normalBias = 0.03;
    this.sun.shadow.radius = 2.5;
    scene.add(this.sun);
    scene.add(this.sun.target);
    this.hemi = new THREE.HemisphereLight(0xd9bfa4, 0x4d3a2e, 1);
    scene.add(this.hemi);
    this.fill = new THREE.DirectionalLight(0x9fb2e0, 0.5);
    scene.add(this.fill);

    this.sunMesh = new THREE.Mesh(new THREE.SphereGeometry(60, 16, 12), new THREE.MeshBasicMaterial({ color: 0xffb36b, fog: false }));
    this.sunMesh.frustumCulled = false;
    this.group.add(this.sunMesh);
    this.surround = { sunMesh: this.sunMesh };
    this.setTheme(1);
  }

  /** Nothing to download any more; kept so the start-up code reads the same. */
  async load(renderer: THREE.WebGLRenderer): Promise<void> {
    this.renderer = renderer;
    this.bakeEnvironment();
  }

  /** Reflections for steel and lacquer come from the current sky only. */
  private bakeEnvironment(): void {
    if (!this.renderer) return;
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    const rt = pmrem.fromScene(this.envScene, 0.02, 0.1, 2000);
    this.scene.environment?.dispose();
    this.scene.environment = rt.texture;
    this.scene.environmentIntensity = 0.45;
    pmrem.dispose();
  }

  setTheme(id: ThemeId): ThemeSpec {
    if (this.spec) this.group.remove(this.spec.group);
    let s = this.cache.get(id);
    if (!s) this.cache.set(id, (s = buildTheme(id, this.q)));
    this.spec = s;
    this.group.add(s.group);
    this.fog.color.setHex(s.fog.color);
    this.fog.density = s.fog.density;
    this.sun.color.setHex(s.key.color);
    this.sun.intensity = s.key.intensity;
    this.sun.position.copy(s.key.dir).multiplyScalar(40);
    this.fill.color.setHex(s.fill.color);
    this.fill.intensity = s.fill.intensity;
    this.fill.position.copy(s.fill.dir).multiplyScalar(30);
    this.hemi.color.setHex(s.hemi.sky);
    this.hemi.groundColor.setHex(s.hemi.ground);
    this.hemi.intensity = s.hemi.intensity;
    setSky(this.sky, s.sky);
    (this.sunMesh.material as THREE.MeshBasicMaterial).color.setHex(s.sunMesh.color);
    this.sunMesh.position.copy(s.sunMesh.at);
    this.bakeEnvironment();
    return s;
  }

  /** Charges the theme's meshes and shaders ahead of time (call hidden, behind a title card). */
  prebuild(ids: ThemeId[]): void {
    for (const id of ids) if (!this.cache.has(id)) this.cache.set(id, buildTheme(id, this.q));
  }

  /** Give the fighters' rigid attachments the character rim (see tagCharacterRim). */
  tagCharacterRim(): void {
    tagCharacterRim(this.scene);
  }

  update(dt: number, wind: number): void {
    this.t += dt;
    (this.sky.material.uniforms.uTime as { value: number }).value = this.t;
    this.spec?.update(this.t, wind);
    // Fallback for bodies that appear after start-up (main.ts tags them before the shader warm-up).
    this.rimScan -= dt;
    if (this.rimScan <= 0) {
      this.rimScan = 1;
      this.tagCharacterRim();
    }
  }
}
