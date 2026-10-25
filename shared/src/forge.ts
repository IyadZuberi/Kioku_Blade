/**
 * The forge: the third model call. After a duel the language model is shown a compact digest of what the general
 * has learned about this player (how they fight, where they stand, which of his moves land) and DESIGNS his next
 * arsenal: new combos from his move list, the tactic (press in or keep away), the condition he hides behind, and
 * one new move to teach him. It is creative, so everything it returns is checked here before the game uses it:
 * only moves he can play, bounded length, no spam of one move, enums for the rest. A bad answer is dropped and the
 * game uses its own deterministic arsenal instead.
 */

export const TEACHABLE = ["windSlash", "lunge", "backflip", "waterfowl", "shockwave", "vanish", "stance"] as const;
export const TACTICS = ["crowd", "kite", "mixed"] as const;
export const CONDS = ["none", "afterDeflect", "afterDodge", "whenOpen", "guardBroken"] as const;
export type Tactic = (typeof TACTICS)[number];
export type CondId = (typeof CONDS)[number];

/** Every move name a combo may contain. */
export const FORGE_MOVES = ["leap", "combo", "comboDelay", "overhead", "thrust", "sweep", "grab", "flurry", "windSlash", "waterfowl", "shockwave", "spin", "kick", "lunge", "backflip", "vanish", "stance"] as const;
const PERIL = new Set(["thrust", "sweep", "grab", "lunge"]);

/** What the game sends: small and numeric, never free text from the player. */
export interface BrainDigest {
  boss: number;
  lvl: number;
  duels: number;
  won: boolean;
  /** 0..1 each. */
  style: { agg: number; guard: number; defl: number; dodge: number; jump: number; heal: number };
  /** Share of the fight the player spent close (< 3.4 m), and his hits per 10 s at each distance. */
  near: number;
  hitNear: number;
  hitFar: number;
  /** His move list now. */
  moves: string[];
  /** His moves that landed on this player most / never landed. */
  works: string[];
  failed: string[];
  cond: string;
}

export interface Forge {
  combos: { name: string; moves: string[] }[];
  tactic: Tactic;
  cond: CondId;
  /** A move to add to his arsenal, or "none". */
  teach: string;
  note: string;
}

const num = (v: unknown, lo: number, hi: number, d = 0): number => (typeof v === "number" && Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : d);
const moveList = (v: unknown, max: number): string[] => (Array.isArray(v) ? v.filter((m): m is string => typeof m === "string" && (FORGE_MOVES as readonly string[]).includes(m)).slice(0, max) : []);

/** Parse the digest from an untrusted request body. */
export function parseDigest(x: unknown): BrainDigest | null {
  if (!x || typeof x !== "object") return null;
  const d = x as Record<string, unknown>;
  const s = (d.style && typeof d.style === "object" ? d.style : {}) as Record<string, unknown>;
  const moves = moveList(d.moves, 24);
  if (!moves.length) return null;
  return {
    boss: Math.round(num(d.boss, 1, 3, 1)),
    lvl: num(d.lvl, 0, 1000),
    duels: Math.round(num(d.duels, 0, 100000)),
    won: d.won === true,
    style: { agg: num(s.agg, 0, 1), guard: num(s.guard, 0, 1), defl: num(s.defl, 0, 1), dodge: num(s.dodge, 0, 1), jump: num(s.jump, 0, 1), heal: num(s.heal, 0, 1) },
    near: num(d.near, 0, 1),
    hitNear: num(d.hitNear, 0, 1000),
    hitFar: num(d.hitFar, 0, 1000),
    moves,
    works: moveList(d.works, 4),
    failed: moveList(d.failed, 4),
    cond: (CONDS as readonly string[]).includes(d.cond as string) ? (d.cond as string) : "none",
  };
}

const PROFANITY = /\b(fuck\w*|shit\w*|cunt|bitch\w*|nigg\w*|fag\w*|retard\w*)\b/i;
const words = (s: unknown, max: number): string => (typeof s === "string" ? s.replace(/[^\w\s',.;:!?-]/g, "").replace(/\s+/g, " ").trim().split(" ").filter(Boolean).slice(0, max).join(" ") : "");

/** A combo that is playable: his moves only, bounded length, no move twice in a row, never three perils in a row. */
export function cleanCombo(raw: unknown, allowed: readonly string[], level: number): string[] | null {
  const maxLen = Math.min(10, 3 + Math.floor(level / 3));
  const out: string[] = [];
  for (const m of Array.isArray(raw) ? raw : []) {
    if (typeof m !== "string" || !allowed.includes(m)) return null;
    if (out[out.length - 1] === m) return null;
    out.push(m);
  }
  if (out.length < 3 || out.length > maxLen) return null;
  let run = 0;
  for (const m of out) {
    run = PERIL.has(m) ? run + 1 : 0;
    if (run >= 3) return null;
  }
  return out;
}

/** Check the model's answer against what he can actually do. Never throws; fields it got wrong are dropped. */
export function cleanForge(raw: unknown, ctx: { moves: readonly string[]; level: number; cond: string }): Forge {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const teach = typeof r.teach === "string" && (TEACHABLE as readonly string[]).includes(r.teach) && !ctx.moves.includes(r.teach) && ctx.level >= 3 ? r.teach : "none";
  const allowed = teach === "none" ? ctx.moves : [...ctx.moves, teach];
  const combos: Forge["combos"] = [];
  for (const c of Array.isArray(r.combos) ? r.combos.slice(0, 3) : []) {
    const o = (c && typeof c === "object" ? c : {}) as Record<string, unknown>;
    const moves = cleanCombo(o.moves, allowed, ctx.level);
    const name = words(o.name, 4);
    if (moves && name && !PROFANITY.test(name)) combos.push({ name, moves });
  }
  const note = words(r.note, 16);
  return {
    combos,
    tactic: (TACTICS as readonly string[]).includes(r.tactic as string) ? (r.tactic as Tactic) : "mixed",
    cond: (CONDS as readonly string[]).includes(r.cond as string) ? (r.cond as CondId) : ((CONDS as readonly string[]).includes(ctx.cond) ? (ctx.cond as CondId) : "none"),
    teach,
    note: PROFANITY.test(note) ? "" : note,
  };
}

export const FORGE_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["combos", "tactic", "cond", "teach", "note"],
  properties: {
    combos: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["name", "moves"],
        properties: { name: { type: "string" }, moves: { type: "array", items: { type: "string", enum: [...FORGE_MOVES] } } },
      },
    },
    tactic: { type: "string", enum: [...TACTICS] },
    cond: { type: "string", enum: [...CONDS] },
    teach: { type: "string", enum: [...TEACHABLE, "none"] },
    note: { type: "string" },
  },
} as const;
