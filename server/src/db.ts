import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { DatabaseSync } from "node:sqlite";

/** Built-in node:sqlite (Node 22.5+; no native build needed). Pass ":memory:" in tests. */
export function openDb(path: string): DatabaseSync {
  if (path !== ":memory:") mkdirSync(dirname(path), { recursive: true });
  const db = new DatabaseSync(path);
  db.exec(`
    CREATE TABLE IF NOT EXISTS players (
      nickname TEXT PRIMARY KEY, fights INTEGER NOT NULL DEFAULT 0, wins INTEGER NOT NULL DEFAULT 0,
      losses INTEGER NOT NULL DEFAULT 0, consecutive_losses INTEGER NOT NULL DEFAULT 0,
      grudge INTEGER NOT NULL DEFAULT 0, habit_avgs TEXT NOT NULL DEFAULT '{}');
    CREATE TABLE IF NOT EXISTS fights (
      fight_id TEXT PRIMARY KEY, nickname TEXT NOT NULL, ts TEXT NOT NULL, stats TEXT NOT NULL,
      source TEXT NOT NULL, valid INTEGER NOT NULL, latency_ms REAL, request_id TEXT, boss_level INTEGER, response TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS global (key TEXT PRIMARY KEY, value TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS rules (id INTEGER PRIMARY KEY AUTOINCREMENT, text TEXT NOT NULL UNIQUE COLLATE NOCASE, ts TEXT NOT NULL);
  `);
  return db;
}
