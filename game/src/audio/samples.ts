/**
 * Recorded sound effects (CC0, Kenney's Impact Sounds and RPG Audio, public/assets/audio), layered under
 * the synthesised ones: steel on steel, blade whooshes, footsteps by ground, a bell for the big moments.
 * Loaded after the audio context starts; until a group has loaded it is simply silent (the synth plays).
 */
const BASE = (import.meta as { env?: { BASE_URL?: string } }).env?.BASE_URL ?? "/";

export type Group = "clash-light" | "clash-medium" | "clash-heavy" | "bell" | "thud" | "slice" | "cloth" | "step-snow" | "step-grass" | "step-gravel";

const FILES: Record<Group, string[]> = {
  "clash-light": ["impactMetal_light_000", "impactMetal_light_001", "impactMetal_light_002"],
  "clash-medium": ["impactMetal_medium_000", "impactMetal_medium_001", "impactMetal_medium_002"],
  "clash-heavy": ["impactMetal_heavy_000", "impactMetal_heavy_001", "impactMetal_heavy_002"],
  bell: ["impactBell_heavy_000", "impactBell_heavy_001"],
  thud: ["impactGeneric_light_000", "impactGeneric_light_001"],
  slice: ["knifeSlice", "knifeSlice2", "drawKnife1", "drawKnife2", "drawKnife3"],
  cloth: ["cloth1", "cloth2", "cloth3"],
  "step-snow": ["footstep_snow_000", "footstep_snow_001", "footstep_snow_002"],
  "step-grass": ["footstep_grass_000", "footstep_grass_001", "footstep_grass_002"],
  "step-gravel": ["footstep_concrete_000", "footstep_concrete_001", "footstep_concrete_002"],
};

export class Samples {
  private readonly bufs = new Map<Group, AudioBuffer[]>();
  private last = new Map<Group, number>();

  constructor(private readonly ctx: BaseAudioContext) {
    for (const g of Object.keys(FILES) as Group[]) void this.load(g);
  }

  private async load(g: Group): Promise<void> {
    const out: AudioBuffer[] = [];
    for (const f of FILES[g]) {
      try {
        const r = await fetch(`${BASE}assets/audio/${f}.ogg`);
        if (r.ok) out.push(await this.ctx.decodeAudioData(await r.arrayBuffer()));
      } catch {
        /* a missing file is just a quieter game */
      }
    }
    if (out.length) this.bufs.set(g, out);
  }

  /** One buffer of the group (never the same one twice in a row), or null while it has not loaded. */
  pick(g: Group): AudioBuffer | null {
    const b = this.bufs.get(g);
    if (!b) return null;
    let i = Math.floor(Math.random() * b.length);
    if (b.length > 1 && i === this.last.get(g)) i = (i + 1) % b.length;
    this.last.set(g, i);
    return b[i];
  }
}
