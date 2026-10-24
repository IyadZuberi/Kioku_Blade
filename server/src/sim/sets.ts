import crypto from "node:crypto";
import seedrandom from "seedrandom";
import { ACCEPTED_COUNTERS, HABITS, type HabitId, type Move } from "@gr/shared";
import type { PlanInput } from "../prompts/general_plan";
import { genInput, type Archetype } from "./archetypes";

export interface HeldoutItem {
  id: string;
  input: PlanInput;
  label: { primary: HabitId | "none"; accepted: Move[] };
}

const hash = (x: unknown) => crypto.createHash("sha1").update(JSON.stringify(x)).digest("hex");

function plan(per: number, mixed: number, none: number): Archetype[] {
  return [...HABITS.flatMap((h) => Array<Archetype>(per).fill(h)), ...Array<Archetype>(mixed).fill("mixed"), ...Array<Archetype>(none).fill("none")];
}

/** 80 items for training (sent with storage on). Fixed RNG seed: reproducible. */
export function buildSeed(): PlanInput[] {
  const r = seedrandom("gr-seed-1");
  const seen = new Set<string>();
  const out: PlanInput[] = [];
  for (const [i, a] of plan(9, 12, 5).entries()) {
    let x = genInput(a, r, i);
    while (seen.has(hash(x))) x = genInput(a, r, i);
    seen.add(hash(x));
    out.push(x);
  }
  return out;
}

/** 60 labelled items for evaluation (never stored). Different RNG seed, deduped against the seed set. */
export function buildHeldout(seed: PlanInput[]): HeldoutItem[] {
  const r = seedrandom("gr-heldout-1");
  const seen = new Set(seed.map(hash));
  const out: HeldoutItem[] = [];
  for (const [i, a] of plan(6, 12, 6).entries()) {
    let x = genInput(a, r, i);
    while (seen.has(hash(x))) x = genInput(a, r, i);
    seen.add(hash(x));
    const primary = (x.habits[0]?.habit ?? "none") as HabitId | "none";
    out.push({ id: `ho-${i}`, input: x, label: { primary, accepted: primary === "none" ? [] : ACCEPTED_COUNTERS[primary] } });
  }
  return out;
}