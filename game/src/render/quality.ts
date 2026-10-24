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
}

export function pickQuality(rendererName: string, search: string): Quality {
  const q = new URLSearchParams(search).get("quality");
  if (q === "low" || q === "high") return q;
  return /intel/i.test(rendererName) && !/arc/i.test(rendererName) ? "low" : "high";
}

export function settingsFor(q: Quality): QualitySettings {
  return q === "low" ? { pixelRatio: 1, ao: false, msaa: 0 } : { pixelRatio: 1.5, ao: true, msaa: 4 };
}
