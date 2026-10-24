// Error-bounded mesh simplification of the shipped arena (keeps props, thins the repeated roof tiles).
//   node tools/simplify_arena.mjs <in.glb> <out.glb> [ratio=0.3] [error=0.002]
import { statSync } from "node:fs";
import { NodeIO } from "@gltf-transform/core";
import { ALL_EXTENSIONS } from "@gltf-transform/extensions";
import { meshopt, prune, simplify, weld } from "@gltf-transform/functions";
import { MeshoptDecoder, MeshoptEncoder, MeshoptSimplifier } from "meshoptimizer";

const [src, dst, ratioArg, errArg] = process.argv.slice(2);
if (!src || !dst) throw new Error("usage: simplify_arena.mjs in.glb out.glb [ratio] [error]");
await Promise.all([MeshoptEncoder.ready, MeshoptDecoder.ready, MeshoptSimplifier.ready]);
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ "meshopt.encoder": MeshoptEncoder, "meshopt.decoder": MeshoptDecoder });
const doc = await io.read(src);
const count = () => doc.getRoot().listMeshes().reduce((a, m) => a + m.listPrimitives().reduce((b, p) => b + (p.getIndices()?.getCount() ?? 0) / 3, 0), 0);
const before = count();
await doc.transform(weld(), simplify({ simplifier: MeshoptSimplifier, ratio: Number(ratioArg ?? 0.3), error: Number(errArg ?? 0.002), lockBorder: true }), prune());
await doc.transform(meshopt({ encoder: MeshoptEncoder, level: "medium" }));
await io.write(dst, doc);
console.log(`triangles ${Math.round(before)} -> ${Math.round(count())}; ${(statSync(dst).size / 1048576).toFixed(2)} MB`);