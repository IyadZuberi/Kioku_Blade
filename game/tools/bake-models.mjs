// Decimates the downloaded Poly Haven photoscans to a real-time budget and packs each as one .glb.
//   node tools/bake-models.mjs [targetTris=6000]
import { readdirSync, statSync, mkdirSync } from "node:fs";
import { NodeIO } from "@gltf-transform/core";
import { ALL_EXTENSIONS } from "@gltf-transform/extensions";
import { prune, simplify, weld, dedup } from "@gltf-transform/functions";
import { MeshoptSimplifier } from "meshoptimizer";

const TARGET = Number(process.argv[2] ?? 6000);
const ROOT = new URL("../public/assets/ph/", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");
await MeshoptSimplifier.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
mkdirSync(ROOT + "glb", { recursive: true });
const tris = (doc) => doc.getRoot().listMeshes().reduce((n, m) => n + m.listPrimitives().reduce((k, p) => k + (p.getIndices()?.getCount() ?? p.getAttribute("POSITION").getCount()) / 3, 0), 0);
for (const id of readdirSync(ROOT + "models")) {
  const doc = await io.read(`${ROOT}models/${id}/${id}.gltf`);
  const before = tris(doc);
  await doc.transform(weld(), simplify({ simplifier: MeshoptSimplifier, ratio: Math.min(1, TARGET / before), error: 0.02, lockBorder: false }), dedup(), prune());
  await io.write(`${ROOT}glb/${id}.glb`, doc);
  console.log(id.padEnd(24), Math.round(before), "->", Math.round(tris(doc)), (statSync(`${ROOT}glb/${id}.glb`).size / 1e6).toFixed(2), "MB");
}