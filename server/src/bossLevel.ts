/** Boss level from the total fights ever played (all players). 1..10. */
export function bossLevel(totalFights: number): number {
  if (!Number.isFinite(totalFights) || totalFights < 0) return 1;
  return Math.min(10, 1 + Math.floor(totalFights / 8));
}

/**
 * This player's level (1..10): the general gets harder with EVERY duel he fights against them, won or
 * lost, and faster still when they keep winning. Fairness only holds the level (never lowers it):
 * after 3 losses in a row it stops rising until they win one.
 *   fights counts the duel that just ended. Level: 2 after the first duel, 4 after the second, ... 10.
 */
export function playerLevel(p: { fights: number; wins: number; consecutive_losses: number }, bossStreak: number): number {
  const stalled = Math.max(0, p.consecutive_losses - 2); // duels since the 3rd straight loss that did not raise it
  const raw = 2 + 2 * Math.max(0, p.fights - stalled) + Math.max(0, bossStreak) + Math.floor(Math.max(0, p.wins) / 3);
  return Math.min(10, Math.max(1, raw));
}
