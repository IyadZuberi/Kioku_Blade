// Re-encode the textures inside the decimated scans (public/assets/ph/glb) as 1024px JPEG: same look, a fraction of the download.
import { readdirSync, statSync } from "node:fs";
import { createRequire } from "node:module";
import { NodeIO } from "@gltf-transform/core";
import { ALL_EXTENSIONS } from "@gltf-transform/extensions";
import { textureCompress } from "@gltf-transform/functions";

const require = createRequire(import.meta.url);
const sharp = require(process.env.SHARP ?? "sharp");
const dir = new URL("../public/assets/ph/glb/", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
for (const f of readdirSync(dir).filter((x) => x.endsWith(".glb"))) {
  const p = dir + f;
  const before = statSync(p).size;
  const doc = await io.read(p);
  await doc.transform(textureCompress({ encoder: sharp, targetFormat: "jpeg", resize: [1024, 1024], quality: 82 }));
  await io.write(p, doc);
  console.log(f, (before / 1e6).toFixed(2), "->", (statSync(p).size / 1e6).toFixed(2), "MB");
}
