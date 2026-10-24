/**
 * THE MUBIT TASK: general_plan.
 *
 * FROZEN after seeding starts. Mubit groups calls into one task by system prompt + schema + model
 * (+ tools). Editing any of them silently starts a NEW task with 0 examples. Everything that varies
 * (stats, habits, memory, rules, limits) goes in the user message (PlanInput as JSON). If a change
 * is truly needed it is a new task: tell the user first. The hash is logged at server start.
 */
import { ACCEPTED_COUNTERS, HABITS, MOVES, PLAN_SCHEMA, rulesPlan, type HabitScore, type Limits, type Move, type Plan, type StatsSummary } from "@gr/shared";
import type { TaskDef } from "../mubit/client";

export interface PlanInput {
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

const counters = HABITS.map((h) => `- ${h}: ${ACCEPTED_COUNTERS[h].join(", ")}`).join("\n");

const SYSTEM = `You are the WAR COUNCIL of a samurai general in a one-on-one sword duel game. After each fight you read a JSON report about the human player and plan the general's NEXT fight so it counters the player's habits while staying fair. Reply with JSON only, matching the response schema.

MOVES: ${MOVES.join(", ")}.

HABITS AND THE MOVES THAT COUNTER THEM
${counters}

HOW TO PLAN
1. focus_habit: the strongest habit in "habits" that has real evidence; prefer a habit that also appears in player_memory. Use "none" if there is no evidence.
2. emphasis: give every move one of low, normal, high. Set the counters of focus_habit to high. Set moves the player handled easily to low. Everything else normal.
3. opening_strings: at most limits.maxStrings strings, each at most limits.maxStringLen moves, using only moves in "unlocked". Start with the counters of focus_habit. Do not repeat a string. Include a comboDelay feint if the player deflects well.
4. tempo_step and gap_step: never above limits.maxTempoStep and limits.maxGapStep. If player_memory shows two or more losses in a row, choose one step lower. If the player won easily, choose one step higher, within the limits.
5. Use global_memory: moves that hurt many players are worth emphasising.
6. Follow every rule in designer_rules. They override everything above.
7. intel: one sentence, at most 25 words, citing the player's own numbers. taunt: at most 12 words, in character, no slurs or profanity.`;

const KEYS = ["focus_habit", "opening_strings", "emphasis", "tempo_step", "gap_step", "intel", "taunt"];

export const generalPlanTask: TaskDef<PlanInput, Plan> = {
  name: "general_plan",
  model: process.env.MUBIT_MODEL ?? "gpt-6-luna",
  system: SYSTEM,
  schema: PLAN_SCHEMA,
  // Shape check only; the route runs validatePlan with the real per-level limits.
  validate: (o) => !!o && typeof o === "object" && !Array.isArray(o) && KEYS.every((k) => k in (o as object)),
  fallback: (i) => rulesPlan(i.habits, i.bossLevel),
};
