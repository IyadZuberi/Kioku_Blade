import type { DatabaseSync } from "node:sqlite";
import type { HabitId, HabitScore, Move, StatsSummary } from "@gr/shared";

export interface Player {
  nickname: string;
  fights: number;
  wins: number;
  losses: number;
  consecutive_losses: number;
  grudge: number;
  habit_avgs: Partial<Record<HabitId, number>>;
}

const getG = <T>(db: DatabaseSync, key: string, dflt: T): T => {
  const row = db.prepare("SELECT value FROM global WHERE key = ?").get(key) as { value: string } | undefined;
  return row ? (JSON.parse(row.value) as T) : dflt;
};
const setG = (db: DatabaseSync, key: string, v: unknown) => {
  db.prepare("INSERT INTO global(key, value) VALUES(?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value").run(key, JSON.stringify(v));
};

export const getTotalFights = (db: DatabaseSync): number => getG(db, "totalFights", 0);
/** Also used to seed crowd history for the demo (synthetic; label it so). */
export const setTotalFights = (db: DatabaseSync, n: number) => setG(db, "totalFights", n);

export function getPlayer(db: DatabaseSync, nickname: string): Player {
  const r = db.prepare("SELECT * FROM players WHERE nickname = ?").get(nickname) as any;
  if (!r) return { nickname, fights: 0, wins: 0, losses: 0, consecutive_losses: 0, grudge: 0, habit_avgs: {} };
  return { ...r, habit_avgs: JSON.parse(r.habit_avgs) };
}

/** Apply one finished fight to a player (running average of habit strengths; grudge and loss streak). */
export function updatePlayer(db: DatabaseSync, nickname: string, habits: HabitScore[], victory: boolean): Player {
  const p = getPlayer(db, nickname);
  const n = p.fights + 1;
  const avgs = { ...p.habit_avgs };
  const now = new Map(habits.map((h) => [h.habit, h.strength]));
  for (const k of new Set([...Object.keys(avgs), ...now.keys()]) as Set<HabitId>) avgs[k] = ((avgs[k] ?? 0) * p.fights + (now.get(k) ?? 0)) / n;
  const next: Player = {
    nickname,
    fights: n,
    wins: p.wins + (victory ? 1 : 0),
    losses: p.losses + (victory ? 0 : 1),
    consecutive_losses: victory ? 0 : p.consecutive_losses + 1,
    grudge: victory ? 0 : p.grudge + 1,
    habit_avgs: avgs,
  };
  db.prepare(
    `INSERT INTO players(nickname, fights, wins, losses, consecutive_losses, grudge, habit_avgs) VALUES(?,?,?,?,?,?,?)
     ON CONFLICT(nickname) DO UPDATE SET fights=excluded.fights, wins=excluded.wins, losses=excluded.losses,
       consecutive_losses=excluded.consecutive_losses, grudge=excluded.grudge, habit_avgs=excluded.habit_avgs`,
  ).run(nickname, next.fights, next.wins, next.losses, next.consecutive_losses, next.grudge, JSON.stringify(avgs));
  return next;
}

/** Crowd tallies after one fight: total, primary-habit counts, and which moves landed on players. */
export function recordGlobal(db: DatabaseSync, habits: HabitScore[], stats: StatsSummary): void {
  setG(db, "totalFights", getTotalFights(db) + 1);
  const hc = getG<Record<string, number>>(db, "habitCounts", {});
  if (habits[0]) hc[habits[0].habit] = (hc[habits[0].habit] ?? 0) + 1;
  setG(db, "habitCounts", hc);
  const mh = getG<Record<string, number>>(db, "moveHits", {});
  for (const [m, n] of Object.entries(stats.hitsByMove) as [Move, number][]) mh[m] = (mh[m] ?? 0) + n;
  setG(db, "moveHits", mh);
}

export function globalMemory(db: DatabaseSync) {
  const total = getTotalFights(db);
  const hc = getG<Record<string, number>>(db, "habitCounts", {});
  const prevalence = Object.fromEntries(Object.entries(hc).map(([k, v]) => [k, total ? +(v / total).toFixed(3) : 0]));
  return { totalFights: total, habitPrevalence: prevalence, moveHits: getG<Record<string, number>>(db, "moveHits", {}) };
}

export function designerRules(db: DatabaseSync, max = 15): string[] {
  return (db.prepare("SELECT text FROM rules ORDER BY id DESC LIMIT ?").all(max) as { text: string }[]).map((r) => r.text).reverse();
}
