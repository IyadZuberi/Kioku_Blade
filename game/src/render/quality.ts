/**
 * Render quality. Measured on an Intel Iris Xe laptop: 14 fps at the base's settings, 56 fps with
 * the pixel ratio at 1, N8AO off and MSAA off. Intel integrated GPUs (not Arc) default to "low";
 * `?quality=low|high` overrides.
 */
export type Quality = "low" | "high";

export interface QualitySettings {
  pixelRatio: number;
  ao: boolean;
  msaa: number;
  /** Sun shadow map size (texels per side). */
  shadowMap: number;
  /** How many lantern point lights are created (each one costs every lit pixel). */
  pointLights: number;
  /** God-ray samples per pixel. */
  raySamples: number;
  /** Mip levels in the bloom chain. */
  bloomLevels: number;
}

export function pickQuality(rendererName: string, search: string): Quality {
  const q = new URLSearchParams(search).get("quality");
  if (q === "low" || q === "high") return q;
  return /intel/i.test(rendererName) && !/arc/i.test(rendererName) ? "low" : "high";
}

export function settingsFor(q: Quality): QualitySettings {
  return q === "low"
    ? { pixelRatio: 1, ao: false, msaa: 0, shadowMap: 2048, pointLights: 3, raySamples: 24, bloomLevels: 5 }
    : { pixelRatio: 1.5, ao: true, msaa: 4, shadowMap: 4096, pointLights: 99, raySamples: 60, bloomLevels: 8 };
}

/** Tuning knobs for a real machine: ?pr= ?shadow= ?lights= ?rays= ?bloom= (junk and out-of-range values are ignored). */
export function withOverrides(s: QualitySettings, search: string): QualitySettings {
  const p = new URLSearchParams(search);
  const num = (k: string, lo: number, hi: number): number | undefined => {
    const v = p.get(k);
    if (v === null || v.trim() === "") return undefined;
    const n = Number(v);
    return Number.isFinite(n) && n >= lo && n <= hi ? n : undefined;
  };
  return {
    ...s,
    pixelRatio: num("pr", 0.4, 2) ?? s.pixelRatio,
    shadowMap: num("shadow", 256, 4096) ?? s.shadowMap,
    pointLights: num("lights", 0, 99) ?? s.pointLights,
    raySamples: num("rays", 1, 120) ?? s.raySamples,
    bloomLevels: num("bloom", 1, 8) ?? s.bloomLevels,
  };
}

export type QualityStep = { kind: "ao" } | { kind: "msaa" } | { kind: "shadow"; value: number } | { kind: "pr"; value: number };

/**
 * Keeps the frame rate smooth on whatever machine runs it: when the frame rate stays under 50 for three
 * readings in a row, it sheds the next most expensive thing, in order: AO, MSAA, a 4096 shadow map
 * (to 2048), then pixel ratio in 0.15 steps down to 0.7. It never raises anything again, so the
 * picture cannot flicker between settings. A reading of 0 (paused) is ignored.
 */
export class QualityGovernor {
  private low = 0;
  private readonly ladder: QualityStep[] = [];
  constructor(s: QualitySettings, private readonly minFps = 50) {
    if (s.ao) this.ladder.push({ kind: "ao" });
    if (s.msaa > 0) this.ladder.push({ kind: "msaa" });
    if (s.shadowMap > 2048) this.ladder.push({ kind: "shadow", value: 2048 });
    for (let r = s.pixelRatio; r > 0.7 + 1e-6; ) {
      r = Math.max(0.7, Math.round((r - 0.15) * 100) / 100);
      this.ladder.push({ kind: "pr", value: r });
    }
  }

  update(fps: number): QualityStep | null {
    if (fps <= 0) return null;
    this.low = fps < this.minFps ? this.low + 1 : 0;
    if (this.low < 3 || !this.ladder.length) return null;
    this.low = 0;
    return this.ladder.shift()!;
  }
}
