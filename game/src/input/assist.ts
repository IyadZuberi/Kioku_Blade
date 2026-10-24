import type { DifficultyValues } from "../game/difficulty";

/** Webcam latency eats the deflect window, so gesture mode widens it (never tightens it). */
const STEPS = [0.32, 0.32, 0.29, 0.26, 0.23];

export function assistKnobs(base: DifficultyValues): DifficultyValues {
  const k = structuredClone(base);
  k.deflectEarly = Math.max(base.deflectEarly, 0.32);
  k.deflectLate = Math.max(base.deflectLate, 0.1);
  k.deflectSteps = base.deflectSteps.map((v, i) => Math.max(v, STEPS[i] ?? 0.23));
  return k;
}