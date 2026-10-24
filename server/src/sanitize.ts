import crypto from "node:crypto";
import { MOVES, type Move, type StatsSummary } from "@gr/shared";

const STRIP = new RegExp(
  "[" +
    [[0, 31], [127, 159], [0x200b, 0x200f], [0x2028, 0x202f], [0x2060, 0x2060], [0xfeff, 0xfeff]]
      .map(([a, b]) => String.fromCharCode(a) + "-" + String.fromCharCode(b))
      .join("") +
    "]",
  "g",
);

export function cleanNickname(v: unknown): string {
  if (typeof v !== "string") return "Wanderer";
  const s = v.replace(STRIP, "").replace(/\s+/g, " ").trim();
  const cut = Array.from(s).slice(0, 20).join("").trim();
  return cut || "Wanderer";
}

/** ASCII-only token for Mubit session ids. */
export function sessionSlug(nickname: string): string {
  const s = nickname.replace(/[^A-Za-z0-9_-]/g, "").slice(0, 20);
  return s || crypto.createHash("sha1").update(nickname).digest("hex").slice(0, 8);
}

const num = (v: unknown, max = 1_000_000): number => (typeof v === "number" && Number.isFinite(v) ? Math.min(max, Math.max(0, v)) : 0);
const nullable = (v: unknown, lo: number, hi: number): number | null => (typeof v === "number" && Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : null);

/** Coerce an untrusted body into a StatsSummary. null = not an object. Unknown fields dropped. */
export function parseStats(raw: unknown): StatsSummary | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const r = raw as Record<string, unknown>;
  const hits: Partial<Record<Move, number>> = {};
  if (r.hitsByMove && typeof r.hitsByMove === "object")
    for (const m of MOVES) {
      const v = (r.hitsByMove as Record<string, unknown>)[m];
      if (typeof v === "number" && Number.isFinite(v)) hits[m] = num(v);
    }
  return {
    fightSeconds: num(r.fightSeconds),
    deflects: num(r.deflects),
    lateDeflects: num(r.lateDeflects),
    blocks: num(r.blocks),
    hitsTaken: num(r.hitsTaken),
    dodged: num(r.dodged),
    playerHits: num(r.playerHits),
    sweepsJumped: num(r.sweepsJumped),
    grabbed: num(r.grabbed),
    grabsEvaded: num(r.grabsEvaded),
    heals: num(r.heals),
    firstHealAtSeconds: nullable(r.firstHealAtSeconds, 0, 1_000_000),
    medianDeflectTiming: nullable(r.medianDeflectTiming, -5, 5),
    victory: Boolean(r.victory),
    deaths: num(r.deaths),
    hitsByMove: hits,
  };
}
