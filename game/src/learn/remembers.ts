/**
 * What the General remembers of THIS player, kept in the browser so it works with or without the
 * server: every duel (won or lost) is counted, and the count is his level against them. The server
 * computes the same level (shared playerLevel) for the plan's limits; this one drives his guard,
 * parry, speed and gaps (see bossKnobs) so he is visibly harder the next fight even when offline.
 */
import { playerLevel } from "@gr/shared";

export interface Remembered {
  fights: number;
  wins: number;
  losses: number;
  consecutive_losses: number;
}

export const NOTHING: Remembered = { fights: 0, wins: 0, losses: 0, consecutive_losses: 0 };

const key = (nick: string) => `kioku.memory.${nick}`;

export function loadMemory(nick: string, storage: Pick<Storage, "getItem"> = localStorage): Remembered {
  try {
    const j = JSON.parse(storage.getItem(key(nick)) ?? "null") as Partial<Remembered> | null;
    const n = (v: unknown) => (typeof v === "number" && Number.isFinite(v) && v >= 0 ? Math.floor(v) : 0);
    return j ? { fights: n(j.fights), wins: n(j.wins), losses: n(j.losses), consecutive_losses: n(j.consecutive_losses) } : { ...NOTHING };
  } catch {
    return { ...NOTHING };
  }
}

export function saveMemory(nick: string, m: Remembered, storage: Pick<Storage, "setItem"> = localStorage): void {
  try {
    storage.setItem(key(nick), JSON.stringify(m));
  } catch {
    /* private mode: he forgets when the tab closes */
  }
}

/** One finished duel. */
export function remember(m: Remembered, victory: boolean): Remembered {
  return {
    fights: m.fights + 1,
    wins: m.wins + (victory ? 1 : 0),
    losses: m.losses + (victory ? 0 : 1),
    consecutive_losses: victory ? 0 : m.consecutive_losses + 1,
  };
}

/** 0 until the first duel is over; then 4, 6, 8, 10 (a win streak and wins raise it faster). */
export function levelOf(m: Remembered, bossStreak = 0): number {
  return m.fights === 0 ? 0 : playerLevel(m, bossStreak);
}
