// Writes data/seed.json (80 synthetic fights for training). No network, no Mubit.
import { mkdirSync, writeFileSync } from "node:fs";
import { buildSeed } from "../src/sim/sets";

mkdirSync("../data", { recursive: true });
const seed = buildSeed();
writeFileSync("../data/seed.json", JSON.stringify(seed, null, 1));
console.log(`wrote data/seed.json (${seed.length} items)`);