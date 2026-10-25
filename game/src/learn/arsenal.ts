/**
 * The arsenal: real combos from the hardest fights, written in this game's own moves, and the moves a general
 * learns to add as he levels up. Pure data and small pure functions, so they are tested.
 *
 * Every combo says WHY it is hard, because each one breaks a different habit:
 *  - delayed strikes break the rhythm of a deflect-on-reflex player,
 *  - peril strings (thrust, sweep, grab) cannot be deflected, they must be stepped, jumped or kicked,
 *  - guard-breaks punish a player who holds block,
 *  - ranged strings punish a player who only fights up close, gap-closers punish one who kites.
 */

export type Range = "close" | "far" | "mixed";
export interface Combo {
  id: string;
  name: string;
  /** The fight it comes from. */
  from: string;
  moves: string[];
  range: Range;
  /** Why it is hard, in a line. */
  why: string;
  /** What breaks it. */
  answer: string;
}

export const LIBRARY: Combo[] = [
  { id: "ashina-cross", name: "Ashina Cross", from: "Sekiro: Isshin, the Sword Saint", moves: ["thrust", "sweep", "overhead"], range: "close", why: "Two perils in a row, then a cut that follows your dodge.", answer: "Mikiri the thrust, jump the sweep, deflect the last." },
  { id: "owl-feint", name: "The Owl's Patience", from: "Sekiro: Owl (Father)", moves: ["comboDelay", "grab", "comboDelay"], range: "close", why: "Delayed cuts: your reflex deflect lands early and you are open.", answer: "Wait for the blade, not the wind-up." },
  { id: "smoke-needles", name: "Smoke and Needles", from: "Sekiro: Owl (Father)", moves: ["vanish", "windSlash", "grab"], range: "mixed", why: "He disappears, cuts from range, then closes for a grab you cannot deflect.", answer: "Move on the smoke, step the grab." },
  { id: "waterfowl", name: "Waterfowl Dance", from: "Elden Ring: Malenia, Blade of Miquella", moves: ["leap", "flurry", "grab"], range: "mixed", why: "A leap into a flurry that keeps going; one guarded cut and the next lands.", answer: "Deflect each cut, do not hold block." },
  { id: "dragon-flash", name: "Dragon Flash", from: "Sekiro: Isshin, the Sword Saint", moves: ["lunge", "backflip", "windSlash"], range: "far", why: "A lunge across the room, a spring away, a thrown cut: the far player is never safe.", answer: "Close the gap on the spring, deflect the cut." },
  { id: "hollow-crown", name: "The Hollow Crown", from: "Elden Ring: Malenia / Dark Souls: Artorias", moves: ["kick", "combo", "overhead"], range: "close", why: "A guard-breaking kick into a full string: holding block is the mistake.", answer: "Jump the kick, deflect the string." },
  { id: "last-blossom", name: "The Last Blossom", from: "Ghost of Tsushima: Lord Shimura", moves: ["shockwave", "combo", "flurry"], range: "mixed", why: "A slam that rings out across the floor, then two strings back to back.", answer: "Jump the ring, answer the strings." },
  { id: "kite-snipe", name: "Wind Through the Reeds", from: "Ghost of Tsushima: Khotun Khan / Bloodborne: Ludwig", moves: ["windSlash", "backflip", "windSlash", "lunge"], range: "far", why: "He keeps his distance and cuts from range until you commit, then dives.", answer: "Deflect the cuts and close in at once." },
  { id: "tempest", name: "Tempest", from: "Sekiro: Genichiro Ashina / Nioh: Tachibana Muneshige", moves: ["spin", "sweep", "combo"], range: "close", why: "A whirl, a low sweep, then a string: the dodge-spammer runs out of room.", answer: "Jump the sweep, deflect the string." },
  { id: "pressure", name: "No Breath", from: "Dark Souls: Ornstein and Smough", moves: ["combo", "comboDelay", "flurry", "thrust"], range: "close", why: "Four strings with changing rhythm and no gap to heal or breathe in.", answer: "Stay on the deflect; step the thrust." },
  { id: "bait", name: "The Bait", from: "Bloodborne: Lady Maria", moves: ["leap", "grab", "overhead"], range: "mixed", why: "A leap to bait the dodge, a grab on the landing, a cut after.", answer: "Do not dodge the leap early; step the grab." },
  { id: "storm", name: "Storm of Blades", from: "Elden Ring: Maliketh / Nioh: Date Masamune", moves: ["windSlash", "shockwave", "waterfowl", "flurry"], range: "mixed", why: "Ranged cuts, a ring, then a leaping flurry: the long chain of a boss who has seen you before.", answer: "Keep moving, deflect the flurry." },
];

/** Moves a general adds to his arsenal as his level grows (level needed, move). All are built from the base clips. */
export const UNLOCKS: [number, string][] = [
  [5, "windSlash"],
  [8, "lunge"],
  [11, "backflip"],
  [14, "waterfowl"],
  [17, "shockwave"],
  [20, "vanish"],
  [24, "stance"],
];
/** Moves that are real attacks the boss plays through the move system (the rest are tricks the boss class picks itself). */
export const SPECIALS = new Set(["lunge", "backflip", "vanish", "stance"]);

/** His move list at this level: his own, plus what he has learned. */
export function arsenalMoves(base: readonly string[], level: number, taught: readonly string[] = []): string[] {
  const out = [...base];
  for (const m of taught) if (!out.includes(m)) out.push(m); // moves the language model chose to teach him
  for (const [need, m] of UNLOCKS) if (level >= need && !out.includes(m)) out.push(m);
  return out;
}

/** Which combos he can already play, with the player's style in mind (close fighter: far combos; kiter: close ones). */
export function usableCombos(moves: readonly string[], prefer: Range = "mixed"): Combo[] {
  const have = new Set(moves);
  const ok = LIBRARY.filter((c) => c.moves.every((m) => have.has(m)));
  const first = ok.filter((c) => c.range === prefer || c.range === "mixed");
  const pool = first.length >= 2 ? first : ok;
  // the ones that suit the player's range come first
  return [...pool.filter((c) => c.range === prefer), ...pool.filter((c) => c.range !== prefer)];
}

/** The tactic against this player: where they stand, and which distance has hurt them more. */
export interface RangeBook {
  nearT: number;
  farT: number;
  /** Times he hit the player while they were near / far. */
  hitNear: number;
  hitFar: number;
}
export const NO_RANGE: RangeBook = { nearT: 0, farT: 0, hitNear: 0, hitFar: 0 };

/** "crowd": press the player in close; "kite": make them chase; "mixed": no clear read yet. */
export function tacticOf(r: RangeBook): "crowd" | "kite" | "mixed" {
  const total = r.nearT + r.farT;
  if (total < 20) return "mixed";
  const prefersNear = r.nearT / total;
  // Test the other distance: a close fighter is made to chase, a kiter is crowded.
  // Once both have been tried, the one that has hurt them more per second wins.
  const enough = r.nearT >= 8 && r.farT >= 8;
  if (enough) {
    const nearRate = r.hitNear / r.nearT;
    const farRate = r.hitFar / r.farT;
    if (Math.abs(nearRate - farRate) > 0.01) return nearRate > farRate ? "crowd" : "kite";
  }
  return prefersNear >= 0.5 ? "kite" : "crowd";
}

/** What kind of range preference this combo suits. */
export const preferFor = (t: "crowd" | "kite" | "mixed"): Range => (t === "kite" ? "far" : t === "crowd" ? "close" : "mixed");
