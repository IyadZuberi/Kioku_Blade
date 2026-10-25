import { computeHabits, rulesPlan, type HabitScore, type Plan, type StatsSummary } from "@gr/shared";

export interface PlanResult {
  plan: Plan;
  /** "local" = the server was unreachable or slow; the plan came from the same rules code the server uses. */
  source: "mubit" | "rules" | "local" | "replay";
  valid: boolean;
  bossLevel: number;
  grudge: number;
  intelLines: string[];
  habits: HabitScore[];
  latencyMs: number;
  requestId?: string;
}

export interface PlanRequest {
  nickname: string;
  fightId: string;
  fightNumber: number;
  stats: StatsSummary;
  boss?: 1 | 2 | 3;
  bossStreak?: number;
  /** The level the game computed itself (learn/remembers.ts): what the plan falls back on when the server is away. */
  localLevel?: number;
}

const API = (import.meta as { env?: { VITE_API?: string } }).env?.VITE_API ?? "";
let lastLevel = 1;

export interface GlobalInfo {
  totalFights: number;
  bossLevel: number;
}

/** The crowd banner on the title. null when the server is unreachable (the banner just stays hidden). */
export async function fetchGlobal(fetchFn: typeof fetch = globalThis.fetch.bind(globalThis)): Promise<GlobalInfo | null> {
  try {
    const res = await fetchFn(`${API}/api/global`, { signal: AbortSignal.timeout(3000) });
    if (!res.ok) return null;
    const j = await res.json();
    return typeof j?.totalFights === "number" && typeof j?.bossLevel === "number" ? { totalFights: j.totalFights, bossLevel: j.bossLevel } : null;
  } catch {
    return null;
  }
}

export function newFightId(): string {
  return globalThis.crypto?.randomUUID?.() ?? `f${Date.now()}${Math.floor(Math.random() * 1e6)}`;
}

export function getNickname(): string {
  try {
    const q = new URLSearchParams(location.search).get("name");
    if (q) return q.slice(0, 20);
    // Each browser gets its own default name, so two judges at one booth never share a player row.
    const saved = localStorage.getItem("gr.nickname");
    if (saved) return saved;
    const fresh = `Wanderer-${Math.floor(Math.random() * 0x10000).toString(16).padStart(4, "0")}`;
    localStorage.setItem("gr.nickname", fresh);
    return fresh;
  } catch {
    return "Wanderer";
  }
}

export function setNickname(n: string): void {
  try {
    localStorage.setItem("gr.nickname", n.slice(0, 20));
  } catch {
    /* storage unavailable */
  }
}

const isPlanResponse = (j: any): j is PlanResult =>
  !!j && typeof j === "object" && !!j.plan && typeof j.plan === "object" && typeof j.plan.focus_habit === "string" && Array.isArray(j.plan.opening_strings);

const replayFromUrl = (): boolean => {
  try {
    return new URLSearchParams(location.search).get("replay") === "1";
  } catch {
    return false;
  }
};
let replayPlans: PlanResult[] | null = null;
let replayAt = 0;

/** Stored real plans, round-robin. null when there are none (the caller falls back to a local plan). */
async function nextReplay(f: typeof fetch, signal: AbortSignal): Promise<PlanResult | null> {
  let plans = replayPlans;
  if (!plans) {
    const res = await f(`${API}/api/replay`, { signal });
    const j = res.ok ? await res.json() : null;
    const got: PlanResult[] = Array.isArray(j?.plans) ? j.plans.filter(isPlanResponse).map((p: PlanResult) => ({ ...p, habits: Array.isArray(p.habits) ? p.habits : [], source: "replay" as const })) : [];
    plans = replayPlans = got;
  }
  return plans.length ? plans[replayAt++ % plans.length] : null;
}

/** Forget the fetched replay plans (tests, and after the host reseeds). */
export function resetReplay(): void {
  replayPlans = null;
  replayAt = 0;
}

/** Operator correction: a designer rule, re-sent with the stored fight. Never throws. */
export async function sendOverride(fightId: string, rule: string, hostToken: string, fetchFn: typeof fetch = globalThis.fetch.bind(globalThis)): Promise<{ ok: boolean; status?: number; plan?: Plan }> {
  try {
    const res = await fetchFn(`${API}/api/override`, { method: "POST", headers: { "content-type": "application/json", authorization: `Bearer ${hostToken}` }, body: JSON.stringify({ fightId, rule }) });
    const j = await res.json().catch(() => null);
    return { ok: !!j?.ok, status: res.status, plan: j?.ok && j.plan ? (j.plan as Plan) : undefined };
  } catch {
    return { ok: false };
  }
}

/** Never rejects and never takes longer than timeoutMs: any failure yields a local rules plan. */
export async function requestPlan(req: PlanRequest, o: { fetchFn?: typeof fetch; timeoutMs?: number; replay?: boolean } = {}): Promise<PlanResult> {
  const t0 = performance.now();
  const f = o.fetchFn ?? globalThis.fetch.bind(globalThis);
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), o.timeoutMs ?? 6000);
  try {
    if (o.replay ?? replayFromUrl()) {
      const r = await nextReplay(f, ctrl.signal);
      if (r) return r;
      throw new Error("nothing to replay");
    }
    const res = await f(`${API}/api/fight-end`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(req),
      signal: ctrl.signal,
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const j = await res.json();
    if (!isPlanResponse(j)) throw new Error("not a plan");
    lastLevel = j.bossLevel;
    return { ...j, habits: Array.isArray(j.habits) ? j.habits : [] };
  } catch {
    const habits = computeHabits(req.stats);
    const level = req.localLevel ?? lastLevel;
    return {
      plan: rulesPlan(habits, level),
      source: "local",
      valid: false,
      bossLevel: level,
      grudge: 0,
      habits,
      intelLines: habits.length ? habits.map((h) => `You ${h.evidence}.`) : ["I could not read a clear pattern yet."],
      latencyMs: Math.round(performance.now() - t0),
    };
  } finally {
    clearTimeout(timer);
  }
}
