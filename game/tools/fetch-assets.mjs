// Downloads the CC0 Poly Haven assets the arenas use into public/assets/ph (run once: node tools/fetch-assets.mjs).
// All of them are CC0 (polyhaven.com/license). 1k resolution keeps the download small.
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

const OUT = new URL("../public/assets/ph/", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");
const UA = { "User-Agent": "kioku-game-dev" };
const HDRI = ["autumn_hill_view", "plains_sunset", "kloofendal_misty_morning"];
const MODELS = ["pine_tree_01", "boulder_01", "rock_moss_set_01", "coastal_cliff_01", "coastal_cliff_02", "namaqualand_boulder_02", "stone_01", "dead_tree_trunk", "tree_stump_01"];

const j = (u) => fetch(u, { headers: UA }).then((r) => r.json());
async function save(url, rel) {
  const p = join(OUT, rel);
  await mkdir(dirname(p), { recursive: true });
  const r = await fetch(url, { headers: UA });
  if (!r.ok) throw new Error(`${r.status} ${url}`);
  await writeFile(p, Buffer.from(await r.arrayBuffer()));
}
for (const id of HDRI) {
  const f = await j(`https://api.polyhaven.com/files/${id}`);
  await save(f.hdri["1k"].hdr.url, `hdri/${id}.hdr`);
  console.log("hdri", id);
}
for (const id of TEX) {
  const f = await j(`https://api.polyhaven.com/files/${id}`);
  await save(f.Diffuse["1k"].jpg.url, `tex/${id}_diff.jpg`);
  await save(f["nor_gl"]["1k"].jpg.url, `tex/${id}_nor.jpg`);
  console.log("tex", id);
}
for (const id of MODELS) {
  const f = await j(`https://api.polyhaven.com/files/${id}`);
  const g = f.gltf["1k"].gltf;
  await save(g.url, `models/${id}/${id}.gltf`);
  for (const [rel, v] of Object.entries(g.include ?? {})) await save(v.url, `models/${id}/${rel}`);
  console.log("model", id);
}