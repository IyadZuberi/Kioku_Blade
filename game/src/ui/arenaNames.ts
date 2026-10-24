import type { ThemeId } from "../world/themes";

/** Names and one-liners for the chapter card and the title (kept out of themes.ts so the UI does not pull in the 3D builders). */
export const ARENA_NAMES: Record<ThemeId, { name: string; line: string }> = {
  1: { name: "Maple Shrine Garden", line: "Late afternoon. The leaves have started to fall." },
  2: { name: "Castle Rooftop", line: "Dusk over the keep. Snow on the tiles, lanterns in the wind." },
  3: { name: "Sakura Grove", line: "Spring. The old cherry is in full bloom, and the petals do not stop falling." },
};
