/**
 * THE SECOND MUBIT TASK: general_speech.
 *
 * Where `general_plan` decides what the general DOES next (enum-only, scored, frozen), this one decides what
 * he SAYS and what he REMEMBERS: it writes his lines for the next duel in his own voice about THIS player,
 * and rewrites his private dossier of the player (the reflection he carries from fight to fight, fed back into
 * the next plan as playerMemory.dossier). Free text, short, validated and length-capped; never a number the
 * game trusts. If the call fails the game uses canned lines and a dossier built from the habit evidence.
 *
 * Mubit groups calls into a task by model + instructions + output format, so this is task #2 and does not
 * touch general_plan's 80 seeded examples. Same freeze rule: do not edit SYSTEM or SPEECH_SCHEMA once examples
 * are being kept (server/test/frozen.test.ts pins the hash).
 */
import type { BossId } from "@gr/shared";
import type { TaskDef } from "../mubit/client";

export interface SpeechInput {
  boss: BossId;
  /** Who is speaking, in a line. */
  speaker: string;
  fight: number;
  /** How the duel that just ended went. */
  result: "player won" | "player lost";
  bossLevel: number;
  /** The player's habits this fight, strongest first, with the numbers behind them. */
  habits: { habit: string; evidence: string }[];
  /** What the general wrote down about this player last time (empty at first). */
  dossier: string;
  /** The plan the war council just made for him, in words. */
  councilIntel: string;
}

export interface Speech {
  /** What he writes down about this player now (<= 30 words, third person). */
  dossier: string;
  /** Said to the player at the start of the next duel (<= 18 words). */
  greeting: string;
  /** Said when he turns a cut aside (<= 6 words). */
  parry: string;
  /** His last words when he falls (<= 12 words). */
  fall: string;
  /** Said when he beats the player (<= 12 words). */
  win: string;
}

export const SPEECH_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["dossier", "greeting", "parry", "fall", "win"],
  properties: {
    dossier: { type: "string" },
    greeting: { type: "string" },
    parry: { type: "string" },
    fall: { type: "string" },
    win: { type: "string" },
  },
} as const;

const SYSTEM = `You write for a samurai general in a one-on-one sword duel game: his spoken lines and his private notes about the human player. After each duel you get a JSON report: which general is speaking, how the duel went, the player's habits with their numbers, your previous notes about this player (dossier), and what the general's war council plans for the next duel. Reply with JSON only, matching the response schema.

VOICE
- Each general speaks differently. Masatora, the garden duelist: calm, formal, exact, courteous menace. Kazemaru, the spear of the wind: quick, playful, mocking, speaks in images of wind and reeds. Kurogane, the hollow shogun, a shinobi-trained master: low, patient, cold, speaks of smoke, owls and endings.
- Always speak TO the player ("you"), in character, as if he has been studying them. Cite one real habit or number from the report, in his own words (not as a statistic readout).
- No slurs, profanity, modern slang, game words (HP, level, boss) or emoji. Plain text only.

FIELDS (hard limits, count the words)
1. dossier: your updated private notes on this player, third person, at most 30 words. Keep what still holds from the previous dossier, add what this duel showed, drop what it disproved. This is how the general learns.
2. greeting: said at the start of the next duel, at most 18 words, using what you know.
3. parry: shouted as he turns a cut aside, at most 6 words, sharp, may name the habit.
4. fall: his last words if the player beats him, at most 12 words, in character, may admit what the player did better.
5. win: said over the player if he wins, at most 12 words.`;

const words = (s: unknown, max: number): string => (typeof s === "string" ? s.replace(/\s+/g, " ").trim().split(" ").filter(Boolean).slice(0, max).join(" ") : "");
const PROFANITY = /\b(fuck\w*|shit\w*|cunt|bitch\w*|nigg\w*|fag\w*|retard\w*)\b/i;

/** Clamp a model reply to the limits (never throws). Empty fields come back "" and the game uses its canned line. */
export function cleanSpeech(raw: unknown): Speech {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const f = (k: keyof Speech, max: number) => {
    const t = words(r[k], max);
    return PROFANITY.test(t) ? "" : t;
  };
  return { dossier: f("dossier", 30), greeting: f("greeting", 18), parry: f("parry", 6), fall: f("fall", 12), win: f("win", 12) };
}

const NAME: Record<BossId, string> = { 1: "Masatora, the garden duelist", 2: "Kazemaru, the spear of the wind", 3: "Kurogane, the hollow shogun" };
export const speakerOf = (b: BossId): string => NAME[b];

/** Canned notes and lines (the same ones the game falls back to), used when the call fails. */
export function fallbackSpeech(i: SpeechInput): Speech {
  const h = i.habits[0];
  return {
    dossier: h ? `Last duel: ${h.evidence}.`.slice(0, 160) : i.dossier,
    greeting: "",
    parry: "",
    fall: "",
    win: "",
  };
}

export const generalSpeechTask: TaskDef<SpeechInput, Speech> = {
  name: "general_speech",
  // The starter credit's model on Mubit's OpenAI route (no provider key needed); override with MUBIT_SPEECH_MODEL/BASE.
  model: process.env.MUBIT_SPEECH_MODEL ?? "gpt-6-luna",
  baseURL: process.env.MUBIT_SPEECH_BASE ?? "https://api.mubit.ai/openai/v1",
  system: SYSTEM,
  schema: SPEECH_SCHEMA,
  validate: (o) => !!o && typeof o === "object" && !Array.isArray(o) && ["dossier", "greeting", "parry", "fall", "win"].every((k) => typeof (o as Record<string, unknown>)[k] === "string"),
  fallback: fallbackSpeech,
};
