/**
 * The story of Kioku and every line of dialogue. Pure data: the subtitle player shows it.
 *
 * Kaede is the last survivor of Kiri, a mountain village burned twelve winters ago by three generals of
 * the Order of the Remembering Blade. The Order's creed is that a warrior is a pattern, and a pattern
 * can be learned: they study every opponent and never forget one. Kaede hunts them through three
 * gates, and every time she falls, they remember a little more of how she fights.
 */
import type { BossId } from "@gr/shared";

export type Speaker = "narrator" | "kaede" | "masatora" | "kazemaru" | "kurogane";

export interface Line {
  /** Stable key. */
  id: string;
  who: Speaker;
  text: string;
}

export const SPEAKER_NAME: Record<Speaker, string> = {
  narrator: "",
  kaede: "Kaede",
  masatora: "Masatora",
  kazemaru: "Kazemaru",
  kurogane: "Kurogane",
};

const L = (id: string, who: Speaker, text: string): Line => ({ id, who, text });

/** Before the very first duel: why these fights. */
export const PROLOGUE: Line[] = [
  L("pro-1", "narrator", "Twelve winters ago, three generals rode into the mountain village of Kiri."),
  L("pro-2", "narrator", "By dawn it was ash. They wrote down the name of every warrior who stood against them."),
  L("pro-3", "narrator", "They call themselves the Order of the Remembering Blade. They never forget a fighter. They study you, and they learn."),
  L("pro-4", "narrator", "One child lived. Kaede took up her father's sword, and she has come for them."),
  L("pro-5", "narrator", "Three gates. Three generals. And each one will remember how you fight."),
];

const BOSS_SPEAKER: Record<BossId, Speaker> = { 1: "masatora", 2: "kazemaru", 3: "kurogane" };
export const speakerOf = (b: BossId): Speaker => BOSS_SPEAKER[b];

/** The first meeting with each general. */
export const MEET: Record<BossId, Line[]> = {
  1: [
    L("m1-1", "masatora", "The girl from Kiri. I remember the night your village burned."),
    L("m1-2", "kaede", "Then remember this, Masatora. I have come for all three of you."),
    L("m1-3", "masatora", "Show me your blade. I will learn every cut of it."),
  ],
  2: [
    L("m2-1", "kazemaru", "Masatora fell to you? Then the wind has carried your name to me."),
    L("m2-2", "kaede", "Your spear burned our fields, Kazemaru. Today it breaks."),
    L("m2-3", "kazemaru", "A sword cannot reach where my spear begins. Come, little ghost."),
  ],
  3: [
    L("m3-1", "kurogane", "So. The last ember of Kiri walks into my keep."),
    L("m3-2", "kaede", "Kurogane. You gave the order. You held the torch."),
    L("m3-3", "kurogane", "I have given a thousand orders, and I remember everyone who knelt. Kneel."),
  ],
};

/** A rematch: one line from him (the war council's taunt replaces it when there is one). */
export const AGAIN: Record<BossId, Line> = {
  1: L("a1", "masatora", "You return. I watched how you fought. This time I know your rhythm."),
  2: L("a2", "kazemaru", "Again? The wind remembers every step you took."),
  3: L("a3", "kurogane", "Every time you fall, I learn you better."),
};

/** His last words as he falls, and Kaede's answer. */
export const FALL: Record<BossId, Line[]> = {
  1: [L("f1-1", "masatora", "My memory... ends here."), L("f1-2", "kaede", "One.")],
  2: [L("f2-1", "kazemaru", "The wind... stops..."), L("f2-2", "kaede", "Two.")],
  3: [L("f3-1", "kurogane", "The keep... falls..."), L("f3-2", "kaede", "It is finished. Rest now, Kiri.")],
};

/** When she is beaten for good. */
export const TRIUMPH: Record<BossId, Line> = {
  1: L("t1", "masatora", "I will remember how you fell."),
  2: L("t2", "kazemaru", "Too slow. The wind remembers."),
  3: L("t3", "kurogane", "Rise again, girl. I will learn you again."),
};
