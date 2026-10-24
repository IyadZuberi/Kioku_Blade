import { computeHabits, rulesPlan, type Plan, type StatsSummary } from "@gr/shared";

export interface PlanResult {
  plan: Plan;
  /** "local" = the server was unreachable or slow; the plan came from the same rules code the server uses. */
  source: "mubit" | "rules" | "local";
  valid: boolean;
  bossLevel: number;
  grudge: number;
  intelLines: string[];
  latencyMs: number;
  requestId?: string;
}

export interface PlanRequest {
  nickname: string;
  fightId: string;
  fightNumber: number;
  stats: StatsSummary;
}

const API = (import.meta as { env?: { VITE_API?: string } }).env?.VITE_API ?? "";
let lastLevel = 1;

export function newFightId(): string {
  return globalThis.crypto?.randomUUID?.() ?? `f${Date.now()}${Math.floor(Math.random() * 1e6)}`;
}

export function getNickname(): string {
  try {
    const q = new URLSearchParams(location.search).get("name");
    if (q) return q.slice(0, 20);
    return localStorage.getItem("gr.nickname") || "Wanderer";
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

/** Never rejects and never takes longer than timeoutMs: any failure yields a local rules plan. */
export async function requestPlan(req: PlanRequest, o: { fetchFn?: typeof fetch; timeoutMs?: number } = {}): Promise<PlanResult> {
  const t0 = performance.now();
  const f = o.fetchFn ?? globalThis.fetch.bind(globalThis);
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), o.timeoutMs ?? 6000);
  try {
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
    return j;
  } catch {
    const habits = computeHabits(req.stats);
    return {
      plan: rulesPlan(habits, lastLevel),
      source: "local",
      valid: false,
      bossLevel: lastLevel,
      grudge: 0,
      intelLines: habits.length ? habits.map((h) => `You ${h.evidence}.`) : ["I could not read a clear pattern yet."],
      latencyMs: Math.round(performance.now() - t0),
    };
  } finally {
    clearTimeout(timer);
  }
}
