// Deterministic placeholder stats used by the UI when no cache rows exist
// and no upstream adapter is configured. Keeps the Battlecard non-empty.
export function deterministicStubStats(seed: string) {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  const rng = () => ((h = (h * 1103515245 + 12345) >>> 0) % 1000) / 1000;
  return {
    kd: Number((1 + rng() * 1.5).toFixed(2)),
    win_rate: Math.floor(48 + rng() * 22),
    hours_played: Math.floor(800 + rng() * 3500),
    headshot_pct: Math.floor(30 + rng() * 35),
    rank_tier: ["Gold III", "Platinum I", "Diamond II", "Ascendant", "Immortal"][Math.floor(rng() * 5)],
    longest_streak: Math.floor(2 + rng() * 9),
  };
}
