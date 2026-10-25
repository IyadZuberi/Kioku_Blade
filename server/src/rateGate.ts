/** A per-minute cap on paid calls, shared by everything that talks to Mubit (a posted fight can trigger several). */
export function makeGate(perMinute: number): () => string | null {
  const stamps: number[] = [];
  return () => {
    const now = Date.now();
    while (stamps.length && now - stamps[0] > 60_000) stamps.shift();
    if (stamps.length >= perMinute) return `rate limit: ${perMinute} live calls per minute`;
    stamps.push(now);
    return null;
  };
}
