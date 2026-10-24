import { MOVES, type HabitId, type HabitScore, type Move, type Plan } from "@gr/shared";

const words = (s: string, n: number) => s.trim().split(/\s+/).filter(Boolean).slice(0, n).join(" ");

/** Council text: the player's real numbers first, then the plan's own sentence. At most 3 lines, no duplicates. */
export function formatIntel(plan: Plan, intelLines: string[]): string[] {
  const out: string[] = [];
  for (const l of [...intelLines.slice(0, 2), plan.intel]) {
    const t = words(l, 25);
    if (t && !out.includes(t)) out.push(t);
  }
  // A line that is only the start of another line adds nothing.
  return out.filter((l, i) => !out.some((o, j) => j !== i && o.length > l.length && o.startsWith(l))).slice(0, 3);
}

export interface Bar {
  habit: HabitId;
  prev: number;
  now: number;
}

/** Debrief rows: how strong each habit was last fight vs this one. Strongest first, at most 4. */
export function habitBars(prev: HabitScore[], now: HabitScore[]): Bar[] {
  const p = new Map(prev.map((h) => [h.habit, h.strength]));
  const n = new Map(now.map((h) => [h.habit, h.strength]));
  const ids = [...new Set<HabitId>([...p.keys(), ...n.keys()])];
  return ids
    .map((habit) => ({ habit, prev: p.get(habit) ?? 0, now: n.get(habit) ?? 0 }))
    .sort((a, b) => Math.max(b.prev, b.now) - Math.max(a.prev, a.now))
    .slice(0, 4);
}

export const highMoves = (plan: Plan): Move[] => MOVES.filter((m) => plan.emphasis[m] === "high");

/** Honest provenance line: where this plan came from. */
export function sourceLine(r: { source: "mubit" | "rules" | "local"; latencyMs: number; requestId?: string; valid: boolean }): string {
  if (r.source === "mubit") return `planned by mubit · ${r.latencyMs} ms${r.requestId ? " · " + r.requestId : ""}${r.valid ? "" : " · clamped"}`;
  if (r.source === "rules") return "planned by the rules table (mubit off or unreachable)";
  return "planned locally (offline)";
}

export const HABIT_LABEL: Record<HabitId, string> = {
  block_holder: "Holds the guard",
  deflect_expert: "Deflects well",
  dodge_spammer: "Dodges a lot",
  jump_dependent: "Jumps the sweep",
  heal_greedy: "Drinks early",
  passive: "Waits and watches",
  aggressive: "Rushes in",
};
