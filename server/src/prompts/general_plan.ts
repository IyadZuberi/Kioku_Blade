/**
 * THE MUBIT TASK: general_plan (v2, compact).
 *
 * v1 sent ~1,600 tokens per call (long prose prompt, a 13-key emphasis object in the schema, rich JSON
 * input). Mubit only trains on examples it keeps, and long ones risk being dropped, so v2 says the same
 * in about 600: short instructions, an output of two small arrays instead of the 13-key object, and a
 * compact input (userMessage below). The model's reply is converted back to the Plan shape
 * (normalize) so everything after the call is unchanged. v2 is a new Mubit task (new hash); v1's 80
 * examples stay in Mubit under the old task.
 *
 * FROZEN after seeding starts. Mubit groups calls into one task by system prompt + schema + model
 * (+ tools). Editing any of them silently starts a NEW task with 0 examples. Everything that varies
 * (stats, habits, memory, rules, limits) goes in the user message (PlanInput as JSON). If a change
 * is truly needed it is a new task: tell the user first. The hash is logged at server start.
 */
import { ACCEPTED_COUNTERS, BOSS_MOVES, HABITS, MOVES, rulesPlan, type BossId, type HabitScore, type Limits, type Move, type Plan, type StatsSummary } from "@gr/shared";
import type { TaskDef } from "../mubit/client";

export interface PlanInput {
  /** Which boss is being planned (1 Masatora, 2 Kazemaru, 3 Kurogane the Hollow Shogun). */
  boss: BossId;
  /** Wins in a row against this boss (the gate to the next one is 3, then 6). */
  bossStreak: number;
  fight: number;
  bossLevel: number;
  stats: StatsSummary;
  habits: HabitScore[];
  playerMemory: object;
  globalMemory: object;
  unlocked: Move[];
  designerRules: string[];
  limits: Limits;
}

const BOSS_LINE = ([1, 2, 3] as const).map((b) => `${b}: ${BOSS_MOVES[b].join(" ")}`).join("; ");
const COUNTERS = HABITS.map((h) => `${h}: ${ACCEPTED_COUNTERS[h].join(" ")}`).join("; ");

const SYSTEM = `You plan a samurai general's next duel from a JSON report about the human player. Reply with JSON only.
Report keys: boss; streak (player wins in a row); lvl 1-10; won; st (t seconds, df deflects, late late deflects, bl blocks, hit hits taken, dg dodges, cut cuts landed, sw sweeps jumped, gr grabs landed, hl heals, deaths); hurt (moves that hit them); habits (strongest first: habit, power 0-1); notes (what you wrote about them before); losses (lost in a row); caps [strings, string length, tempo, gap]; rules (extra orders).
Moves by boss: ${BOSS_LINE}.
Habit: counters: ${COUNTERS}.
focus: the top habit with real evidence, else none. strings: up to caps[0] strings of up to caps[1] moves, only the boss's moves, starting with the focus counters. high: moves to favour. low: moves they handled easily. tempo and gap: never above caps; one lower after 2+ losses, one higher after an easy win. intel: one sentence, 20 words max, quoting their numbers. taunt: 10 words max, in character, no slurs. rules beat everything.`;

const HABIT_ENUM = [...HABITS, "none"];
const MOVE_LIST = { type: "array", items: { type: "string", enum: [...MOVES] } } as const;
/** What the model replies: small arrays, not a 13-key object. */
export const PLAN_WIRE_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["focus", "strings", "high", "low", "tempo", "gap", "intel", "taunt"],
  properties: {
    focus: { type: "string", enum: HABIT_ENUM },
    strings: { type: "array", items: MOVE_LIST },
    high: MOVE_LIST,
    low: MOVE_LIST,
    tempo: { type: "integer", enum: [0, 1, 2, 3, 4] },
    gap: { type: "integer", enum: [0, 1, 2, 3] },
    intel: { type: "string" },
    taunt: { type: "string" },
  },
} as const;

const r2 = (x: number) => Math.round(x * 100) / 100;

/** The model's whole input, compact (this is the user message; ~150 tokens). */
export function compactInput(i: PlanInput): Record<string, unknown> {
  const st = i.stats;
  const hurt = Object.entries(st.hitsByMove).filter(([, n]) => (n ?? 0) > 0).sort((a, b) => (b[1] ?? 0) - (a[1] ?? 0)).slice(0, 2).map(([m, n]) => `${m} ${n}`);
  const pm = i.playerMemory as { dossier?: string; consecutive_losses?: number };
  const out: Record<string, unknown> = {
    boss: i.boss,
    streak: i.bossStreak,
    lvl: i.bossLevel,
    won: st.victory,
    st: { t: Math.round(st.fightSeconds), df: st.deflects, late: st.lateDeflects, bl: st.blocks, hit: st.hitsTaken, dg: st.dodged, cut: st.playerHits, sw: st.sweepsJumped, gr: st.grabbed, hl: st.heals, deaths: st.deaths },
    hurt,
    habits: i.habits.slice(0, 3).map((h) => ({ habit: h.habit, power: r2(h.strength) })),
    notes: pm.dossier ?? "",
    losses: pm.consecutive_losses ?? 0,
    caps: [i.limits.maxStrings, i.limits.maxStringLen, i.limits.maxTempoStep, i.limits.maxGapStep],
  };
  if (i.designerRules.length) out.rules = i.designerRules;
  return out;
}

/** The reply, back in the Plan's own shape (what validatePlan reads). Junk passes through for validatePlan to reject. */
export function normalizeWire(raw: unknown): unknown {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return raw;
  const w = raw as Record<string, unknown>;
  if (!("focus" in w)) return raw; // already Plan-shaped (old plans, tests, fallbacks)
  const emphasis = Object.fromEntries(MOVES.map((m) => [m, "normal"]));
  for (const m of Array.isArray(w.low) ? w.low : []) if (m in emphasis) emphasis[m as string] = "low";
  for (const m of Array.isArray(w.high) ? w.high : []) if (m in emphasis) emphasis[m as string] = "high";
  return { focus_habit: w.focus, opening_strings: w.strings, emphasis, tempo_step: w.tempo, gap_step: w.gap, intel: w.intel, taunt: w.taunt };
}

const KEYS = ["focus_habit", "opening_strings", "emphasis", "tempo_step", "gap_step", "intel", "taunt"];

export const generalPlanTask: TaskDef<PlanInput, Plan> = {
  name: "general_plan",
  // Mubit's starter-credit model on its OpenAI route: no provider key, no daily token cap (Groq's free tier
  // ran dry after ~200k tokens a day). The Groq model is the backup (see mubitPlan.ts).
  model: process.env.MUBIT_MODEL ?? "gpt-6-luna",
  baseURL: process.env.MUBIT_BASE_URL ?? "https://api.mubit.ai/openai/v1",
  system: SYSTEM,
  schema: PLAN_WIRE_SCHEMA,
  reasoning: "low",
  userMessage: compactInput,
  normalize: normalizeWire,
  // Shape check only (after normalize); the route runs validatePlan with the real per-level limits.
  validate: (o) => !!o && typeof o === "object" && !Array.isArray(o) && KEYS.every((k) => k in (o as object)),
  fallback: (i) => rulesPlan(i.habits, i.bossLevel, i.unlocked),
};
