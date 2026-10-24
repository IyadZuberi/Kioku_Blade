import { NodeIO } from "@gltf-transform/core";
import { ALL_EXTENSIONS } from "@gltf-transform/extensions";
import { MeshoptDecoder } from "meshoptimizer";
await MeshoptDecoder.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ "meshopt.decoder": MeshoptDecoder });
const doc = await io.read(process.argv[2] ?? "public/assets/arena.glb");
const rows = [];
for (const mesh of doc.getRoot().listMeshes()) {
  let tris = 0, verts = 0;
  for (const p of mesh.listPrimitives()) { const idx = p.getIndices(); tris += (idx ? idx.getCount() : p.getAttribute("POSITION").getCount()) / 3; verts += p.getAttribute("POSITION").getCount(); }
  rows.push({ name: mesh.getName(), tris: Math.round(tris), verts });
}
rows.sort((a, b) => b.tris - a.tris);
console.log("total tris", rows.reduce((a, r) => a + r.tris, 0), "meshes", rows.length);
for (const r of rows.slice(0, 14)) console.log(String(r.tris).padStart(8), String(r.verts).padStart(8), r.name);