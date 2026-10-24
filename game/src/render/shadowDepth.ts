/**
 * three's shadow pass draws every caster with one shared depth material. When skinned, instanced and
 * plain casters alternate, that material's program is re-resolved on every switch (getProgram, a cache
 * key string per draw): garbage every frame, so GC hitches. Skinned and instanced casters get their own
 * depth material here, so each keeps one program. Casters whose material is alpha-cut keep three's
 * per-material variant (it carries the cut-out).
 * Also: a transparent double-sided material is drawn in two passes, each flagging needsUpdate (a program
 * re-resolve per draw, every frame). Those are drawn in one pass instead.
 */
import * as THREE from "three";

const SKINNED = new THREE.MeshDepthMaterial();
const INSTANCED = new THREE.MeshDepthMaterial();

export function stableShadowDepth(root: THREE.Object3D): void {
  root.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh) return;
    const mats = Array.isArray(m.material) ? m.material : [m.material];
    for (const x of mats) if (x.transparent && x.side === THREE.DoubleSide) x.forceSinglePass = true;
    if (!m.castShadow || m.customDepthMaterial) return;
    if (mats.some((x) => x.alphaTest > 0 || x.alphaToCoverage)) return;
    if ((m as THREE.SkinnedMesh).isSkinnedMesh) m.customDepthMaterial = SKINNED;
    else if ((m as THREE.InstancedMesh).isInstancedMesh) m.customDepthMaterial = INSTANCED;
  });
}
