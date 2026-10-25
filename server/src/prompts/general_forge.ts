/**
 * THE THIRD MUBIT TASK: general_forge. After a duel the model designs the general's next arsenal.
 *
 * general_plan chooses WHAT he favours (enums, scored); general_speech writes WHAT HE SAYS; this one is the
 * creative step: it invents new combos from the moves he can play (inspired by the hardest fights in games),
 * chooses whether he should press in or keep away from THIS player, which condition he hides behind, and which
 * new move to teach him. Everything it returns is checked by cleanForge (shared/src/forge.ts) before the game
 * uses it, and a bad answer means the game's own deterministic arsenal is used instead.
 *
 * Mubit groups calls into a task by model + instructions + output format: this is task #3 and touches neither
 * of the others. Same freeze rule once examples are being kept (server/test/frozen.test.ts pins the hash).
 */
import { FORGE_SCHEMA, cleanForge, type BrainDigest, type Forge } from "@gr/shared";
import type { TaskDef } from "../mubit/client";

const SYSTEM = `You design the next fighting arsenal for a samurai general in a one-on-one sword duel game, after he lost to or beat a human player. You get a JSON digest of what he has learned about this player: boss (1 Masatora, 2 Kazemaru, 3 Kurogane), lvl (his level, grows every duel), won (the player won), style (0-1 shares: agg attacks, guard holds block, defl deflects, dodge, jump, heal), near (share of the fight spent close), hitNear and hitFar (how often he has hit them close and far), moves (everything he can play now), works (his moves that landed most), failed (moves that never land), cond (the condition he currently hides behind). Reply with JSON only.

Moves: combo and flurry are strings of cuts; comboDelay has delayed cuts that break a reflex deflect; overhead is a heavy cut; leap closes distance; thrust, sweep and grab are perils (cannot be deflected: the player must step, jump or kick); windSlash throws a cut from range; waterfowl is a leaping flurry; shockwave is a slam with a ring; spin, kick (breaks a held guard), lunge, backflip and vanish (smoke) are signature moves, usable only if they are in moves.

Design:
1. combos: up to 3 new combos of 3 to 8 moves from moves (or from teach). Name each in 2-4 words. Never the same move twice in a row, never three perils in a row, and do not use moves in failed unless you are fixing them. Aim them at THIS player: delayed cuts for a reflex deflector; perils and kick for someone who holds block; ranged and area moves for a dodger; leap and lunge to close on someone who keeps away; far combos against someone who stays close.
2. tactic: kite (keep away, cut from range) if they fight close and hitFar is not clearly worse than hitNear; crowd (press in) if they keep away; mixed if unclear.
3. cond: the condition he can be hurt under, aimed at their favourite style: afterDodge for a deflector, afterDeflect for someone who holds block, guardBroken for a dodger, whenOpen for an attacker; none only at lvl 0-1. Prefer changing it if won is true and it is the same as the current one.
4. teach: one new move for his arsenal from windSlash, lunge, backflip, waterfowl, shockwave, vanish, stance that is not already in moves, or none. Only when lvl is at least 3.
5. note: one sentence, 14 words max, what he decided, in plain words.`;

export const generalForgeTask: TaskDef<BrainDigest, Forge> = {
  name: "general_forge",
  // The starter credit's model on Mubit's OpenAI route (no provider key needed); override with MUBIT_FORGE_MODEL/BASE.
  model: process.env.MUBIT_FORGE_MODEL ?? "gpt-6-luna",
  baseURL: process.env.MUBIT_FORGE_BASE ?? "https://api.mubit.ai/openai/v1",
  system: SYSTEM,
  schema: FORGE_SCHEMA,
  reasoning: "low",
  validate: (o) => !!o && typeof o === "object" && !Array.isArray(o) && ["combos", "tactic", "cond", "teach", "note"].every((k) => k in (o as object)),
  fallback: (d) => cleanForge(null, { moves: d.moves, level: d.lvl, cond: d.cond }),
};
