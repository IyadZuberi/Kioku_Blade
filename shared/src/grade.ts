import { MOVES, type HabitId, type Move, type Plan } from "./types";

/** Did the plan answer the labelled habit? `valid` is passed through (valid-plan rate). */
export function gradePlan(item: { label: { primary: HabitId | "none"; accepted: Move[] } }, plan: Plan, valid: boolean): { valid: boolean; targetOk: boolean } {
  const { primary, accepted } = item.label;
  if (primary === "none") return { valid, targetOk: plan.focus_habit === "none" };
  const answers = accepted.some((m) => plan.emphasis[m] === "high" || plan.opening_strings.some((s) => s.includes(m)));
  return { valid, targetOk: plan.focus_habit === primary && answers };
}

const highSet = (p: Plan) => MOVES.filter((m) => p.emphasis[m] === "high").join(",");

/** Same focus and the same set of moves at high emphasis (the provider-agreement metric). */
export function agrees(a: Plan, b: Plan): boolean {
  return a.focus_habit === b.focus_habit && highSet(a) === highSet(b);
}