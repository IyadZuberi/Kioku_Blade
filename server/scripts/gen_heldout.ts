// Writes data/heldout.json (60 labelled synthetic fights for evaluation). No network, no Mubit.
import { mkdirSync, writeFileSync } from "node:fs";
import { buildHeldout, buildSeed } from "../src/sim/sets";

mkdirSync("../data", { recursive: true });
const held = buildHeldout(buildSeed());
writeFileSync("../data/heldout.json", JSON.stringify(held, null, 1));
const by: Record<string, number> = {};
for (const h of held) by[h.label.primary] = (by[h.label.primary] ?? 0) + 1;
console.log(`wrote data/heldout.json (${held.length} items)`, by);