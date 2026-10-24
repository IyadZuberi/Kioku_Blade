/**
 * Chapter progress: beat boss 1 three times in a row to reach boss 2, boss 2 six times in a row to
 * reach boss 3. A defeat resets the streak (the player stays on the same boss). Pure functions plus
 * a tiny localStorage mirror, keyed by player name.
 */
import type { BossId } from "@gr/shared";
import { BOSSES } from "./bosses";

export interface Progress {
  boss: BossId;
  streak: number;
  /** Highest boss the player may choose. */
  unlocked: BossId;
  cleared: boolean;
}

export const fresh = (): Progress => ({ boss: 1, streak: 0, unlocked: 1, cleared: false });

export function afterFight(p: Progress, victory: boolean): { next: Progress; advanced: boolean } {
  if (!victory) return { next: { ...p, streak: 0 }, advanced: false };
  const streak = p.streak + 1;
  const gate = BOSSES[p.boss].gate;
  if (gate > 0 && streak >= gate) {
    const boss = (p.boss + 1) as BossId;
    return { next: { ...p, boss, streak: 0, unlocked: (Math.max(p.unlocked, boss) as BossId) }, advanced: true };
  }
  return { next: { ...p, streak, cleared: p.cleared || p.boss === 3 }, advanced: false };
}

/** Choose an unlocked boss (the streak restarts unless it is the current one). */
export function select(p: Progress, boss: BossId): Progress {
  if (boss > p.unlocked) return p;
  if (boss === p.boss) return p;
  return { ...p, boss, streak: 0 };
}

export const unlockAll = (p: Progress): Progress => ({ ...p, unlocked: 3 });

const key = (nick: string) => `kioku.progress.${nick}`;

export function loadProgress(nick: string): Progress {
  try {
    const raw = localStorage.getItem(key(nick));
    if (!raw) return fresh();
    const j = JSON.parse(raw) as Partial<Progress>;
    const boss = j.boss === 2 || j.boss === 3 ? j.boss : 1;
    const unlocked = j.unlocked === 2 || j.unlocked === 3 ? j.unlocked : 1;
    return { boss: Math.min(boss, unlocked) as BossId, streak: Math.max(0, Math.min(99, Math.floor(Number(j.streak) || 0))), unlocked, cleared: !!j.cleared };
  } catch {
    return fresh();
  }
}

export function saveProgress(nick: string, p: Progress): void {
  try {
    localStorage.setItem(key(nick), JSON.stringify(p));
  } catch {
    /* storage unavailable: progress lasts for this session only */
  }
}