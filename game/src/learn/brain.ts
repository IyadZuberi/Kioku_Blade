/**
 * The general's BRAIN: what he has learned about THIS player, kept per player and per general in the browser.
 * Pure (no DOM, no clock), so it is tested.
 *
 * After every duel, won or lost, he:
 *  1. reads how the player fights (STYLE: how much they cut, guard, deflect, dodge, jump, heal),
 *  2. keeps score of which of his own moves hurt this player and which got answered (MOVES),
 *  3. levels up without a ceiling: the level only ever grows, and everything below scales with it,
 *  4. builds new, longer COMBOS from the moves that work and drops the ones that never land,
 *  5. picks the CONDITION under which he can be hurt, aimed at the player's favourite style (they must change it),
 *  6. unlocks the next SKILLS: feints, swings of uneven speed, delayed strikes, answering a dodge...
 */
import type { StatsSummary } from "@gr/shared";
import { arsenalMoves, NO_RANGE, preferFor, SPECIALS, tacticOf, usableCombos, type Combo, type RangeBook } from "./arsenal";

export type Cond = "none" | "afterDeflect" | "afterDodge" | "whenOpen" | "guardBroken";
export interface Style {
  aggression: number;
  guard: number;
  deflect: number;
  dodge: number;
  jump: number;
  heal: number;
}
export interface MoveStat {
  used: number;
  hit: number;
}
export interface Brain {
  v: 1;
  duels: number;
  wins: number;
  /** Grows after every duel, never capped. */
  level: number;
  style: Style;
  moves: Record<string, MoveStat>;
  cond: Cond;
  /** Duels in a row he has been hidden behind the same condition. */
  condRun: number;
  seed: number;
  /** Where the player fights and which distance has hurt them more (see arsenal.ts tacticOf). */
  range: RangeBook;
}

export const FRESH: Brain = { v: 1, duels: 0, wins: 0, level: 0, style: { aggression: 0, guard: 0, deflect: 0, dodge: 0, jump: 0, heal: 0 }, moves: {}, cond: "none", condRun: 0, seed: 1, range: NO_RANGE };

const clamp = (x: number, a: number, b: number) => Math.min(b, Math.max(a, x));
const PERIL = new Set(["thrust", "sweep", "grab", "lunge"]);

/** What the player did in one duel, as shares 0..1. */
export function styleOf(s: StatsSummary): Style {
  const react = s.deflects + s.blocks + s.dodged + s.hitsTaken + 1;
  const secs = Math.max(8, s.fightSeconds);
  return {
    aggression: clamp(s.playerHits / secs / 1.1, 0, 1),
    guard: s.blocks / react,
    deflect: s.deflects / react,
    dodge: s.dodged / react,
    jump: clamp(s.sweepsJumped / 3, 0, 1),
    heal: clamp(s.heals / 3, 0, 1),
  };
}

const blend = (a: Style, b: Style, k: number): Style => ({
  aggression: a.aggression + (b.aggression - a.aggression) * k,
  guard: a.guard + (b.guard - a.guard) * k,
  deflect: a.deflect + (b.deflect - a.deflect) * k,
  dodge: a.dodge + (b.dodge - a.dodge) * k,
  jump: a.jump + (b.jump - a.jump) * k,
  heal: a.heal + (b.heal - a.heal) * k,
});

/** The condition aimed at the player's favourite style: the thing they lean on stops working. */
export function chooseCond(style: Style, prev: Cond, won: boolean): Cond {
  const score: [Cond, number][] = [
    ["afterDodge", style.deflect + style.guard * 0.2],
    ["afterDeflect", style.guard + style.aggression * 0.5],
    ["guardBroken", style.dodge + style.jump * 0.4],
    ["whenOpen", style.aggression * 0.9 + (1 - style.guard) * 0.2],
  ];
  score.sort((a, b) => b[1] - a[1]);
  // beaten under this condition: the next one, so the player has to learn another way
  return score[0][0] === prev && won ? score[1][0] : score[0][0];
}

/** One finished duel: returns the new brain (the old one is left alone). */
export function learn(b: Brain, s: StatsSummary, used: Record<string, number>, range: RangeBook = NO_RANGE): Brain {
  const first = b.duels === 0;
  const style = first ? styleOf(s) : blend(b.style, styleOf(s), 0.55);
  const moves: Record<string, MoveStat> = {};
  for (const [m, v] of Object.entries(b.moves)) moves[m] = { ...v };
  for (const [m, n] of Object.entries(used)) (moves[m] ??= { used: 0, hit: 0 }).used += n;
  for (const [m, n] of Object.entries(s.hitsByMove)) (moves[m] ??= { used: 0, hit: 0 }).hit += n ?? 0;
  // he learns more from a duel the player controlled (a win) or breezed through
  const gain = 1 + (s.victory ? 0.7 : 0.25) + (s.hitsTaken <= 2 ? 0.6 : 0) + (s.victory && s.fightSeconds < 40 ? 0.5 : 0);
  const level = b.level + gain;
  const cond = level < 2 ? "none" : chooseCond(style, b.cond, s.victory);
  // the range book fades a little each duel, so a player who changes where they fight is noticed
  const old = b.range ?? NO_RANGE;
  const book: RangeBook = { nearT: old.nearT * 0.85 + range.nearT, farT: old.farT * 0.85 + range.farT, hitNear: old.hitNear * 0.85 + range.hitNear, hitFar: old.hitFar * 0.85 + range.hitFar };
  return { v: 1, duels: b.duels + 1, wins: b.wins + (s.victory ? 1 : 0), level, style, moves, cond, condRun: cond === b.cond ? b.condRun + 1 : 0, seed: b.seed + 7919, range: book };
}

/** What the brain asks of the fight (applied in Game.beginLearning and read by Boss). */
export interface Behaviour {
  level: number;
  /** His whole move list at this level (his own plus what he has learned). */
  moves: string[];
  /** The tricks among them (lunge, backflip, vanish, stance) the boss class plays itself. */
  extras: string[];
  /** Press in close, make them chase, or no read yet. */
  tactic: "crowd" | "kite" | "mixed";
  /** Combos he plays from the hardest fights, by name. */
  named: Combo[];
  /** × each move's pick weight (moves that landed on this player up, moves that never land down). */
  weights: Record<string, number>;
  chains: string[][];
  /** Chance he starts a learned chain instead of a single move. */
  chainP: number;
  /** Chance a swing is a feint: the wind-up starts, stops, and the real blow comes later. */
  feintP: number;
  /** Each swing runs at 1 ± this of its speed, so a held rhythm stops working. */
  jitter: number;
  /** Answers a dodge at once. */
  counterStep: boolean;
  cond: Cond;
  /** Seconds the condition's window stays open. */
  window: number;
  skills: string[];
}

/** Skills in the order they are learned (level needed, name). */
export const SKILLS: [number, string][] = [
  [1, "feints"],
  [2, "uneven swing speed"],
  [3, "longer combos"],
  [4, "answers your dodge"],
  [6, "delayed strikes"],
  [8, "hides behind a new condition each duel"],
  [10, "chains that never repeat"],
];

/** Pick weights: what works on THIS player goes up, plus a bias against the player's favourite style. */
export function weightsOf(b: Brain, moves: readonly string[]): Record<string, number> {
  const w: Record<string, number> = {};
  const st = b.style;
  const tactic = tacticOf(b.range ?? NO_RANGE);
  for (const m of moves) {
    const s = b.moves[m];
    let x = 1;
    if (tactic === "kite" && (m === "windSlash" || m === "lunge" || m === "backflip" || m === "waterfowl")) x *= 1.5;
    if (tactic === "crowd" && (m === "leap" || m === "combo" || m === "flurry" || m === "kick" || m === "grab")) x *= 1.4;
    if (s && s.used >= 2) x = 0.55 + 1.6 * (s.hit / s.used); // never lands: 0.55; lands every time: 2.15
    if (st.deflect > 0.3 && (m === "comboDelay" || m === "grab" || m === "flurry")) x *= 1 + st.deflect;
    if (st.guard > 0.25 && (m === "grab" || m === "kick" || m === "thrust" || m === "sweep")) x *= 1 + st.guard * 1.2;
    if (st.dodge > 0.25 && (m === "sweep" || m === "spin" || m === "lunge" || m === "shockwave" || m === "windSlash")) x *= 1 + st.dodge * 1.2;
    if (st.aggression > 0.5 && (m === "overhead" || m === "comboDelay" || m === "stance")) x *= 1 + st.aggression * 0.6;
    if (st.aggression < 0.25 && (m === "leap" || m === "windSlash" || m === "flurry")) x *= 1.3;
    w[m] = x;
  }
  return w;
}

function rngOf(seed: number): () => number {
  let a = seed >>> 0 || 1;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** New combos from the moves that work: longer as he levels up, never two perils in a row, delayed strikes against a deflector. */
export function chainsOf(b: Brain, moves: readonly string[], w: Record<string, number>): string[][] {
  const r = rngOf(b.seed);
  const count = clamp(2 + Math.floor(b.level / 2.5), 2, 12);
  const len = clamp(2 + Math.floor(b.level / 2), 2, 10);
  const out: string[][] = [];
  for (let c = 0; c < count; c++) {
    const chain: string[] = [];
    for (let i = 0; i < len; i++) {
      const prev = chain[i - 1];
      if (i > 0 && b.level >= 6 && b.style.deflect > 0.3 && moves.includes("comboDelay") && prev !== "comboDelay" && r() < 0.4) {
        chain.push("comboDelay");
        continue;
      }
      const cand = moves.filter((m) => m !== prev && !(PERIL.has(m) && prev && PERIL.has(prev)));
      const total = cand.reduce((s, m) => s + (w[m] ?? 1), 0);
      let x = r() * total;
      chain.push(cand.find((m) => (x -= w[m] ?? 1) <= 0) ?? cand[cand.length - 1]);
    }
    out.push(chain);
  }
  return out;
}

export function behaviourOf(b: Brain, baseMoves: readonly string[]): Behaviour {
  const L = b.level;
  const moves = arsenalMoves(baseMoves, L);
  const w = weightsOf(b, moves);
  const tactic = tacticOf(b.range ?? NO_RANGE);
  // real combos first (a few more of them, and a different few each duel), then ones he makes up
  const pool = L >= 1 ? usableCombos(moves, preferFor(tactic)) : [];
  const take = Math.min(pool.length, 1 + Math.floor(L / 4));
  const named = Array.from({ length: take }, (_, i) => pool[(b.duels + i) % pool.length]);
  return {
    level: L,
    moves,
    extras: moves.filter((m) => SPECIALS.has(m)),
    tactic,
    named,
    weights: w,
    chains: L >= 1 ? [...named.map((c) => c.moves), ...chainsOf(b, moves, w)] : [],
    chainP: L < 1 ? 0 : clamp(0.2 + 0.04 * L, 0.2, 0.85),
    feintP: L < 1 ? 0 : clamp(0.04 * L + 0.1 * b.style.deflect, 0, 0.5),
    jitter: L < 2 ? 0 : clamp(0.04 + 0.018 * L + 0.12 * b.style.deflect, 0, 0.4),
    counterStep: L >= 4,
    cond: b.cond,
    window: Math.max(0.9, 2.6 - 0.05 * L),
    skills: SKILLS.filter(([n]) => L >= n).map(([, s]) => s),
  };
}

/** Is a cut allowed to hurt him right now? `since` = seconds since the player's last deflect / dodge. */
export function vulnerable(cond: Cond, ctx: { sinceDeflect: number; sinceDodge: number; open: boolean; posture: number; window: number }): boolean {
  switch (cond) {
    case "none":
      return true;
    case "afterDeflect":
      return ctx.open || ctx.sinceDeflect <= ctx.window;
    case "afterDodge":
      return ctx.open || ctx.sinceDodge <= ctx.window;
    case "whenOpen":
      return ctx.open;
    case "guardBroken":
      return ctx.open || ctx.posture >= 55;
  }
}

/** The condition in words, for the banner. */
export const COND_TEXT: Record<Cond, string> = {
  none: "",
  afterDeflect: "Shielded. Cut him only just after you deflect.",
  afterDodge: "Shielded. Cut him only just after you step through a blow.",
  whenOpen: "Shielded. Cut him only while he is open.",
  guardBroken: "Shielded. Break his posture first.",
};

/** What he has understood about the player, in a sentence. */
export function readingOf(b: Brain): string {
  const s = b.style;
  const top = (
    [
      ["deflects", s.deflect],
      ["holds guard", s.guard],
      ["dodges", s.dodge],
      ["attacks", s.aggression],
    ] as [string, number][]
  ).sort((a, c) => c[1] - a[1])[0];
  return b.duels === 0 ? "" : `He has read you: you mostly ${top[0]} (${Math.round(top[1] * 100)}%).`;
}

// ------------------------------------------------------------------ storage

const key = (nick: string, boss: number) => `kioku.brain.${nick}.${boss}`;

export function loadBrain(nick: string, boss: number, storage: Pick<Storage, "getItem"> = localStorage): Brain {
  try {
    const j = JSON.parse(storage.getItem(key(nick, boss)) ?? "null") as Brain | null;
    if (j && j.v === 1 && Number.isFinite(j.level) && j.style && j.moves) return j;
  } catch {
    /* fall through */
  }
  return structuredClone(FRESH);
}

export function saveBrain(nick: string, boss: number, b: Brain, storage: Pick<Storage, "setItem"> = localStorage): void {
  try {
    storage.setItem(key(nick, boss), JSON.stringify(b));
  } catch {
    /* private mode: he forgets when the tab closes */
  }
}
