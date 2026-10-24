import { MOVES, type Move, type StatsSummary } from "@gr/shared";
import type { DuelStats } from "../game/Game";

/** DuelStats is cumulative for the whole session; a mark remembers where a fight began. */
export type StatsMark = Omit<DuelStats, "timings" | "contactErr" | "hitLog"> & { timings: number; contactErr: number; hitLog: number };

export function mark(s: DuelStats): StatsMark {
  return { ...s, timings: s.timings.length, contactErr: s.contactErr.length, hitLog: s.hitLog.length };
}

const median = (xs: number[]): number | null => {
  if (!xs.length) return null;
  const a = [...xs].sort((x, y) => x - y);
  const m = a.length >> 1;
  return a.length % 2 ? a[m] : (a[m - 1] + a[m]) / 2;
};

const isMove = (s: string): s is Move => (MOVES as readonly string[]).includes(s);

/** This fight only: DuelStats now minus the mark. hitLog line = "<state>@<t> <attack> press-<..> win=<..>". */
export function summarize(now: DuelStats, start: StatsMark, fightSeconds: number, firstHealAtSeconds: number | null): StatsSummary {
  const d = (k: keyof StatsMark) => Math.max(0, (now[k as keyof DuelStats] as number) - (start[k] as number));
  const hitsByMove: Partial<Record<Move, number>> = {};
  for (const line of now.hitLog.slice(start.hitLog)) {
    const name = line.split(/\s+/)[1];
    if (name && isMove(name)) hitsByMove[name] = (hitsByMove[name] ?? 0) + 1;
  }
  return {
    fightSeconds: Math.max(0, fightSeconds),
    deflects: d("deflects"),
    lateDeflects: d("lateDeflects"),
    blocks: d("blocks"),
    hitsTaken: d("hitsTaken"),
    dodged: d("dodged"),
    playerHits: d("playerHits"),
    sweepsJumped: d("sweepsJumped"),
    grabbed: d("grabbed"),
    grabsEvaded: d("grabsEvaded"),
    heals: d("heals"),
    firstHealAtSeconds,
    medianDeflectTiming: median(now.timings.slice(start.timings)),
    victory: now.victory,
    deaths: d("deaths"),
    hitsByMove,
  };
}
