/** Boss level from the total fights ever played (all players). 1..10. */
export function bossLevel(totalFights: number): number {
  if (!Number.isFinite(totalFights) || totalFights < 0) return 1;
  return Math.min(10, 1 + Math.floor(totalFights / 8));
}
