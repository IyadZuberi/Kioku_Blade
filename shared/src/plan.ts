import { ACCEPTED_COUNTERS } from "./habits";
import { HABITS, MOVES, type HabitId, type HabitScore, type Level3, type Move, type Plan } from "./types";

export const MAX_INTEL_WORDS = 25;
export const MAX_TAUNT_WORDS = 12;
const LEVELS: Level3[] = ["low", "normal", "high"];

/** Strict JSON schema for response_format. All enums; the model never writes a raw number. */
export const PLAN_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["focus_habit", "opening_strings", "emphasis", "tempo_step", "gap_step", "intel", "taunt"],
  properties: {
    focus_habit: { type: "string", enum: [...HABITS, "none"] },
    opening_strings: { type: "array", items: { type: "array", items: { type: "string", enum: [...MOVES] } } },
    emphasis: {
      type: "object",
      additionalProperties: false,
      required: [...MOVES],
      properties: Object.fromEntries(MOVES.map((m) => [m, { type: "string", enum: LEVELS }])),
    },
    tempo_step: { type: "integer", enum: [0, 1, 2, 3, 4] },
    gap_step: { type: "integer", enum: [0, 1, 2, 3] },
    intel: { type: "string" },
    taunt: { type: "string" },
  },
} as const;

export interface Limits {
  maxStrings: number;
  maxStringLen: number;
  maxTempoStep: number;
  maxGapStep: number;
}

/** What the general may do at a boss level (1..10). Monotonic. */
export function limitsForLevel(level: number): Limits {
  const l = Number.isFinite(level) ? Math.min(10, Math.max(1, Math.floor(level))) : 1;
  return {
    maxStrings: 1 + Math.floor((l - 1) / 4.5),
    maxStringLen: 2 + Math.floor((l - 1) / 4.5),
    maxTempoStep: Math.min(4, Math.floor((l - 1) / 2.25)),
    maxGapStep: Math.min(3, Math.floor((l - 1) / 3)),
  };
}

const neutralEmphasis = (): Record<Move, Level3> => Object.fromEntries(MOVES.map((m) => [m, "normal"])) as Record<Move, Level3>;

const PROFANITY = /\b(fuck\w*|shit\w*|cunt|bitch\w*|nigg\w*|fag\w*|retard\w*)\b/i;

function words(s: string, max: number): string {
  const w = s.trim().split(/\s+/).filter(Boolean);
  return w.slice(0, max).join(" ");
}

/** Never throws. `valid` = zero failures before clamping. */
export function validatePlan(raw: unknown, limits: Limits, fallback?: Plan): { plan: Plan; valid: boolean; failures: string[] } {
  const fb = fallback ?? rulesPlan([], 1);
  const failures: string[] = [];
  const fail = (c: string) => {
    if (!failures.includes(c)) failures.push(c);
  };
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return { plan: fb, valid: false, failures: ["invalid_json"] };
  const r = raw as Record<string, unknown>;

  let focus: Plan["focus_habit"] = "none";
  if (r.focus_habit === "none" || (HABITS as readonly unknown[]).includes(r.focus_habit)) focus = r.focus_habit as Plan["focus_habit"];
  else fail("bad_focus");

  const strings: Move[][] = [];
  if (Array.isArray(r.opening_strings)) {
    for (const s of r.opening_strings) {
      if (!Array.isArray(s)) {
        fail("bad_move");
        continue;
      }
      const moves = s.filter((m): m is Move => (MOVES as readonly unknown[]).includes(m));
      if (moves.length !== s.length) fail("bad_move");
      if (moves.length > limits.maxStringLen) fail("string_too_long");
      const cut = moves.slice(0, limits.maxStringLen);
      if (cut.length) strings.push(cut);
    }
  } else fail("bad_move");
  if (strings.length > limits.maxStrings) fail("too_many_strings");

  const emphasis = neutralEmphasis();
  const e = r.emphasis && typeof r.emphasis === "object" && !Array.isArray(r.emphasis) ? (r.emphasis as Record<string, unknown>) : {};
  for (const m of MOVES) {
    if ((LEVELS as unknown[]).includes(e[m])) emphasis[m] = e[m] as Level3;
    else fail("missing_emphasis");
  }

  const step = (v: unknown, max: number, hi: number): number => {
    if (typeof v !== "number" || !Number.isInteger(v) || v < 0 || v > hi) {
      fail("step_over_limit");
      return 0;
    }
    if (v > max) {
      fail("step_over_limit");
      return max;
    }
    return v;
  };
  const tempo = step(r.tempo_step, limits.maxTempoStep, 4) as Plan["tempo_step"];
  const gap = step(r.gap_step, limits.maxGapStep, 3) as Plan["gap_step"];

  const text = (v: unknown, max: number, alt: string): string => {
    if (typeof v !== "string") {
      fail("bad_text");
      return alt;
    }
    if (PROFANITY.test(v)) {
      fail("bad_text");
      return alt;
    }
    const n = v.trim().split(/\s+/).filter(Boolean).length;
    if (n > max) fail("bad_text");
    return words(v, max);
  };

  const plan: Plan = {
    focus_habit: focus,
    opening_strings: strings.slice(0, limits.maxStrings),
    emphasis,
    tempo_step: tempo,
    gap_step: gap,
    intel: text(r.intel, MAX_INTEL_WORDS, fb.intel),
    taunt: text(r.taunt, MAX_TAUNT_WORDS, fb.taunt),
  };

  // Nothing usable left after clamping: use the fallback's content (the call itself stays "invalid").
  const empty = plan.opening_strings.length === 0 && plan.focus_habit === "none" && MOVES.every((m) => plan.emphasis[m] === "normal");
  return { plan: empty && failures.length ? { ...fb, intel: plan.intel || fb.intel, taunt: plan.taunt || fb.taunt } : plan, valid: failures.length === 0, failures };
}

const TAUNTS: Record<HabitId | "none", string> = {
  block_holder: "Your guard is a wall. I have a ram.",
  deflect_expert: "Sharp timing. Now watch my hands lie.",
  dodge_spammer: "Run all you like. The roof is small.",
  jump_dependent: "You leap well. Land well.",
  heal_greedy: "Drink slowly. I will wait.",
  passive: "Waiting will not save you.",
  aggressive: "You rush in. I have been waiting.",
  none: "Show me what you can do.",
};

const clamp = (x: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, x));

/** Deterministic plan from the habit table. Always valid. */
export function rulesPlan(habits: HabitScore[], level: number): Plan {
  const lim = limitsForLevel(level);
  const top = habits[0];
  const emphasis = neutralEmphasis();
  for (const h of habits.slice(0, 2)) for (const m of ACCEPTED_COUNTERS[h.habit]) emphasis[m] = "high";

  const strings: Move[][] = [];
  if (top) {
    const c = ACCEPTED_COUNTERS[top.habit];
    strings.push(c.slice(0, lim.maxStringLen));
    if (lim.maxStrings >= 2) strings.push([...c].reverse().slice(0, lim.maxStringLen));
    const second = habits[1];
    if (lim.maxStrings >= 3 && second) strings.push(ACCEPTED_COUNTERS[second.habit].slice(0, lim.maxStringLen));
  }

  const tempo = top ? clamp(Math.round(top.strength * lim.maxTempoStep), 0, lim.maxTempoStep) : 0;
  const gap = clamp(tempo, 0, lim.maxGapStep);
  const intel = top
    ? words(`You ${top.evidence}. I will answer with ${ACCEPTED_COUNTERS[top.habit].join(" and ")}.`, MAX_INTEL_WORDS)
    : "I cannot read you yet. Show me how you fight.";
  return {
    focus_habit: top ? top.habit : "none",
    opening_strings: strings.filter((s) => s.length),
    emphasis,
    tempo_step: tempo as Plan["tempo_step"],
    gap_step: gap as Plan["gap_step"],
    intel,
    taunt: words(TAUNTS[top ? top.habit : "none"], MAX_TAUNT_WORDS),
  };
}
