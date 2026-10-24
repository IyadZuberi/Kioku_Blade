import type { ThemeId } from "../world/themes";

/** Names and one-liners for the chapter card and the title (kept out of themes.ts so the UI does not pull in the 3D builders). */
export const ARENA_NAMES: Record<ThemeId, { name: string; line: string }> = {
  1: { name: "Maple Shrine Garden", line: "Late afternoon. The leaves have started to fall." },
  2: { name: "Pampas Cliff", line: "A cold wind. The grass bends toward the sea." },
  3: { name: "Hollow Sanctum", line: "Night. The old tree still burns, far off." },
};
