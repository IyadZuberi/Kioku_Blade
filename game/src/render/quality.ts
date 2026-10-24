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

/**
 * Dynamic resolution: if the frame rate stays low for three readings in a row, lower the pixel
 * ratio by 0.15 (down to a floor). It never raises it again, so the picture cannot flicker.
 * Returns the new ratio when it changes, otherwise null. A reading of 0 (paused) is ignored.
 */
export class ResolutionGovernor {
  private low = 0;
  constructor(
    private ratio: number,
    private readonly floor = 0.6,
    private readonly minFps = 28,
  ) {}

  update(fps: number): number | null {
    if (fps <= 0) return null;
    this.low = fps < this.minFps ? this.low + 1 : 0;
    if (this.low < 3 || this.ratio <= this.floor) return null;
    this.low = 0;
    this.ratio = Math.max(this.floor, Math.round((this.ratio - 0.15) * 100) / 100);
    return this.ratio;
  }
}
