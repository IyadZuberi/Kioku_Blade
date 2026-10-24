import { appendFileSync, existsSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";

export interface CallRow {
  ts: string;
  task: string;
  task_hash: string;
  session_id: string;
  store: boolean;
  ok: boolean;
  latency_ms: number;
  prompt_tokens?: number;
  completion_tokens?: number;
  request_id?: string;
  served_by: string;
  error?: string;
}

const COLS = ["ts", "task", "task_hash", "session_id", "store", "ok", "latency_ms", "prompt_tokens", "completion_tokens", "request_id", "served_by", "error"] as const;
export const CALLS_CSV = resolve(process.cwd(), "..", "data", "calls.csv");

const cell = (v: unknown) => {
  const s = v === undefined || v === null ? "" : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

/** Append one row to data/calls.csv (header written once). Never throws: logging must not break a fight. */
export function logCall(row: CallRow, file: string = CALLS_CSV): void {
  try {
    mkdirSync(dirname(file), { recursive: true });
    if (!existsSync(file)) appendFileSync(file, COLS.join(",") + "\n");
    appendFileSync(file, COLS.map((c) => cell(row[c])).join(",") + "\n");
  } catch {
    /* ignore */
  }
}
