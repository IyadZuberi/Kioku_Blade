/**
 * This player's level (1..10): the general gets harder with EVERY duel he fights against them, won or
 * lost, and faster still when they keep winning. Fairness only holds the level (never lowers it):
 * after 3 losses in a row it stops rising until they win one.
 *   `fights` counts the duel that just ended. Level: 4 after the first duel, 6 after the second ... 10.
 * Used by the server (the plan's limits) and the game (the local ramp when the server is away).
 */
export function playerLevel(p: { fights: number; wins: number; consecutive_losses: number }, bossStreak: number): number {
  const stalled = Math.max(0, p.consecutive_losses - 2); // duels since the 3rd straight loss that did not raise it
  const raw = 2 + 2 * Math.max(0, p.fights - stalled) + Math.max(0, bossStreak) + Math.floor(Math.max(0, p.wins) / 3);
  return Math.min(10, Math.max(1, raw));
}
