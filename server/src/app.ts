import express, { type Request, type Response } from "express";
import type { DatabaseSync } from "node:sqlite";
import { MOVES, computeHabits, limitsForLevel, rulesPlan, validatePlan, type HabitScore, type Plan, type StatsSummary } from "@gr/shared";
import { bossLevel } from "./bossLevel";
import { randomUUID } from "node:crypto";
import { addRule, designerRules, getPlayer, getTotalFights, globalMemory, recordGlobal, updatePlayer } from "./memory";
import type { PlanInput } from "./prompts/general_plan";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parseCsv } from "./csv";
import { percentile, readSummary } from "./evalRun";
import { cleanNickname, parseStats, sessionSlug } from "./sanitize";

export interface PlanCall {
  out: unknown;
  ok: boolean;
  latencyMs: number;
  requestId?: string;
  error?: string;
}
export interface Deps {
  db: DatabaseSync;
  /** The only path to an LLM. Must never throw for the caller's sake, but we guard anyway. */
  callPlan: (input: PlanInput, sessionId: string) => Promise<PlanCall>;
  /** Where data/calls.csv and data/eval/summary.csv live (default ../data). */
  dataDir?: string;
}

export interface FightEndResponse {
  plan: Plan;
  source: "mubit" | "rules";
  valid: boolean;
  failures: string[];
  latencyMs: number;
  requestId?: string;
  bossLevel: number;
  grudge: number;
  intelLines: string[];
  habits: HabitScore[];
}

const FIGHT_ID = /^[\w-]{1,64}$/;

/** Lines shown on the Council screen, built locally from the player's own numbers. */
function intelLines(habits: HabitScore[]): string[] {
  if (!habits.length) return ["I could not read a clear pattern yet."];
  return habits.map((h) => `You ${h.evidence}.`);
}

export function createApp(deps: Deps) {
  const { db } = deps;
  const app = express();
  app.use((_req, res, next) => {
    // No cookies or secrets cross this API; the browser may be on another dev origin.
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Headers", "content-type");
    next();
  });
  app.use(express.json({ limit: "100kb" }));

  const inflight = new Map<string, Promise<FightEndResponse>>();

  async function fightEnd(fightId: string, nickname: string, stats: StatsSummary): Promise<FightEndResponse> {
    const habits = computeHabits(stats);
    const level = bossLevel(getTotalFights(db));
    const limits = limitsForLevel(level);
    const player = updatePlayer(db, nickname, habits, stats.victory);
    const gm = globalMemory(db);
    const fallback = rulesPlan(habits, level);

    const input: PlanInput = {
      fight: player.fights,
      bossLevel: level,
      stats,
      habits,
      playerMemory: { fights: player.fights, wins: player.wins, losses: player.losses, consecutive_losses: player.consecutive_losses, habit_avgs: player.habit_avgs },
      globalMemory: { totalFights: gm.totalFights, habitPrevalence: gm.habitPrevalence, moveHits: gm.moveHits },
      unlocked: [...MOVES],
      designerRules: designerRules(db),
      limits,
    };
    const sessionId = `gr-live-${sessionSlug(nickname)}-${fightId}`;

    let call: PlanCall;
    try {
      call = await deps.callPlan(input, sessionId);
    } catch (e) {
      call = { out: undefined, ok: false, latencyMs: 0, error: e instanceof Error ? e.message : String(e) };
    }

    let plan: Plan, valid: boolean, failures: string[], source: "mubit" | "rules";
    if (call.ok) {
      const v = validatePlan(call.out, limits, fallback);
      ({ plan, valid, failures } = v);
      source = "mubit";
    } else {
      plan = fallback;
      valid = false;
      failures = ["call_failed"];
      source = "rules";
    }
    // Two losses in a row: one step less raw speed. Targeting stays.
    if (player.consecutive_losses >= 2) plan = { ...plan, tempo_step: Math.max(0, plan.tempo_step - 1) as Plan["tempo_step"] };

    const res: FightEndResponse = {
      plan,
      source,
      valid,
      failures,
      latencyMs: Math.round(call.latencyMs),
      requestId: call.requestId,
      bossLevel: level,
      grudge: player.grudge,
      intelLines: intelLines(habits),
      habits,
    };
    db.prepare("INSERT INTO fights(fight_id, nickname, ts, stats, source, valid, latency_ms, request_id, boss_level, response, input) VALUES(?,?,?,?,?,?,?,?,?,?,?)").run(
      fightId, nickname, new Date().toISOString(), JSON.stringify(stats), source, valid ? 1 : 0, res.latencyMs, res.requestId ?? null, level, JSON.stringify(res), JSON.stringify(input),
    );
    recordGlobal(db, habits, stats);
    return res;
  }

  app.get("/favicon.ico", (_req, res) => res.status(204).end());
  app.get("/api/health", (_req, res) => res.json({ ok: true }));

  const dataDir = deps.dataDir ?? resolve(process.cwd(), "..", "data");
  app.get("/api/stats", (_req: Request, res: Response) => {
    const rows = readSummary(join(dataDir, "eval", "summary.csv"));
    const callsFile = join(dataDir, "calls.csv");
    const by: Record<string, number[]> = {};
    let total = 0, ok = 0;
    let lastRequestId: string | undefined;
    if (existsSync(callsFile)) {
      const [head, ...recs] = parseCsv(readFileSync(callsFile, "utf8"));
      const col = (n: string) => head.indexOf(n);
      for (const r of recs) {
        total++;
        const good = r[col("ok")] === "true";
        if (good) ok++;
        (by[r[col("served_by")] || "unknown"] ??= []).push(Number(r[col("latency_ms")]) || 0);
        if (r[col("request_id")]) lastRequestId = r[col("request_id")];
      }
    }
    const byServedBy = Object.fromEntries(Object.entries(by).map(([k, v]) => [k, { n: v.length, p50: percentile(v, 50), p95: percentile(v, 95) }]));
    res.json({ rows, calls: { total, ok, byServedBy, lastRequestId } });
  });

  const dashboard = join(dirname(fileURLToPath(import.meta.url)), "..", "dashboard", "index.html");
  app.get("/dashboard", (_req: Request, res: Response) => res.sendFile(dashboard));

  app.get("/api/global", (_req: Request, res: Response) => {
    const g = globalMemory(db);
    res.json({ ...g, bossLevel: bossLevel(g.totalFights) });
  });

  app.post("/api/fight-end", async (req: Request, res: Response) => {
    const b = (req.body ?? {}) as Record<string, unknown>;
    const fightId = typeof b.fightId === "string" ? b.fightId : "";
    const stats = parseStats(b.stats);
    if (!FIGHT_ID.test(fightId) || !stats) {
      res.status(400).json({ error: "fightId and stats are required" });
      return;
    }
    const nickname = cleanNickname(b.nickname);
    const stored = db.prepare("SELECT response FROM fights WHERE fight_id = ?").get(fightId) as { response: string } | undefined;
    if (stored) {
      res.json(JSON.parse(stored.response));
      return;
    }
    let p = inflight.get(fightId);
    if (!p) {
      p = fightEnd(fightId, nickname, stats).finally(() => inflight.delete(fightId));
      inflight.set(fightId, p);
    }
    try {
      res.json(await p);
    } catch (e) {
      res.status(500).json({ error: "internal", detail: e instanceof Error ? e.message : String(e) });
    }
  });

  // Operator correction: a designer rule is added and the same fight is re-sent with it under a new session id,
  // so the corrected answer is what Mubit records (there is no feedback API).
  app.post("/api/override", async (req: Request, res: Response) => {
    const b = (req.body ?? {}) as Record<string, unknown>;
    const fightId = typeof b.fightId === "string" ? b.fightId : "";
    const row = FIGHT_ID.test(fightId) ? (db.prepare("SELECT input FROM fights WHERE fight_id = ?").get(fightId) as { input: string | null } | undefined) : undefined;
    if (!row?.input) {
      res.status(404).json({ error: "unknown fight" });
      return;
    }
    const rule = typeof b.rule === "string" ? b.rule.replace(/\s+/g, " ").trim() : "";
    if (!rule || rule.length > 200) {
      res.status(400).json({ error: "rule must be 1-200 characters" });
      return;
    }
    addRule(db, rule);
    const input = { ...(JSON.parse(row.input) as PlanInput), designerRules: designerRules(db) };
    let call: PlanCall;
    try {
      call = await deps.callPlan(input, `gr-fix-${randomUUID()}`);
    } catch (e) {
      call = { out: undefined, ok: false, latencyMs: 0, error: e instanceof Error ? e.message : String(e) };
    }
    if (!call.ok) {
      res.json({ ok: false, error: call.error ?? "call failed" });
      return;
    }
    const v = validatePlan(call.out, input.limits, rulesPlan(input.habits, input.bossLevel));
    res.json({ ok: true, plan: v.plan, valid: v.valid, requestId: call.requestId });
  });

  // Stored real plans for demo fallback (Wi-Fi or Mubit down). Always labelled "replay".
  app.get("/api/replay", (_req: Request, res: Response) => {
    const rows = db.prepare("SELECT response FROM fights ORDER BY rowid DESC LIMIT 20").all() as { response: string }[];
    res.json({ plans: rows.map((r) => ({ ...JSON.parse(r.response), source: "replay" })) });
  });

  // Malformed JSON and other body errors: a JSON 400, not an HTML page.
  app.use((err: unknown, _req: Request, res: Response, _next: express.NextFunction) => {
    res.status(400).json({ error: "bad request" });
  });
  return app;
}

export { getPlayer };
