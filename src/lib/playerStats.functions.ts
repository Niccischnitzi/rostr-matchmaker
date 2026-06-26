// Live-stats pipeline. Battlecard calls refreshBattlecardStats() to ask the
// server to refresh the cache from upstream APIs (Steam / Tracker.gg / Riot).
// Until those secrets land, each adapter is a no-op and the client falls back
// to whatever the player_stats_cache table already holds — or to a deterministic
// stub computed from the username so the UI never looks empty.
//
// Adding a real adapter later = drop a fetcher into ADAPTERS below and gate it
// on process.env.<KEY> being set. No client-side changes needed.
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

type AdapterResult = {
  game_key: string;
  source: "steam" | "tracker_gg" | "riot";
  rank_tier?: string | null;
  kd?: number | null;
  win_rate?: number | null;
  hours_played?: number | null;
  headshot_pct?: number | null;
  longest_streak?: number | null;
  raw?: unknown;
};

// === Adapters =============================================================
// Each adapter receives the user's linked external id for that platform and
// returns one or more cache rows. They MUST NOT throw — return [] on any
// failure so one slow API doesn't break the whole refresh.

async function steamAdapter(_externalUid: string): Promise<AdapterResult[]> {
  const key = process.env.STEAM_WEB_API_KEY;
  if (!key) return []; // not configured yet
  // TODO: GetOwnedGames + GetUserStatsForGame for CS2/Dota2 etc.
  return [];
}

async function trackerGgAdapter(_externalUid: string, _gameKey: string): Promise<AdapterResult[]> {
  const key = process.env.TRACKER_GG_API_KEY;
  if (!key) return [];
  // TODO: https://public-api.tracker.gg/v2/<game>/standard/profile/<platform>/<id>
  return [];
}

async function riotAdapter(_externalUid: string, _gameKey: string): Promise<AdapterResult[]> {
  const key = process.env.RIOT_API_KEY;
  if (!key) return [];
  return [];
}

// === Server function ======================================================
export const refreshBattlecardStats = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;

    // Find the user's linked external ids
    const { data: linked, error: linkedErr } = await supabase
      .from("linked_accounts")
      .select("platform, external_uid")
      .eq("user_id", userId);
    if (linkedErr) return { ok: false as const, error: linkedErr.message, refreshed: 0 };

    const refreshed: AdapterResult[] = [];

    for (const acc of linked ?? []) {
      const uid = (acc as { external_uid: string | null }).external_uid;
      const platform = (acc as { platform: string }).platform?.toLowerCase();
      if (!uid) continue;
      try {
        if (platform === "steam") refreshed.push(...await steamAdapter(uid));
        if (platform === "riot")  refreshed.push(...await riotAdapter(uid, "val"));
      } catch (e) {
        console.warn("[stats] adapter failed", platform, e);
      }
    }

    // Persist any rows we got back (RLS scopes to current user).
    if (refreshed.length) {
      const rows = refreshed.map((r) => ({
        user_id: userId,
        game_key: r.game_key,
        source: r.source,
        rank_tier: r.rank_tier ?? null,
        kd: r.kd ?? null,
        win_rate: r.win_rate ?? null,
        hours_played: r.hours_played ?? null,
        headshot_pct: r.headshot_pct ?? null,
        longest_streak: r.longest_streak ?? null,
        raw: r.raw ?? null,
        fetched_at: new Date().toISOString(),
        expires_at: new Date(Date.now() + 15 * 60_000).toISOString(),
      }));
      const { error: upErr } = await supabase
        .from("player_stats_cache")
        .upsert(rows, { onConflict: "user_id,game_key,source" });
      if (upErr) return { ok: false as const, error: upErr.message, refreshed: 0 };
    }

    return { ok: true as const, refreshed: refreshed.length, adaptersConfigured: !!(process.env.STEAM_WEB_API_KEY || process.env.TRACKER_GG_API_KEY || process.env.RIOT_API_KEY) };
  });

// Stub used by the UI when no cache rows exist and no adapters configured.
// Keeps the Battlecard non-empty without lying about being live.
export function deterministicStubStats(seed: string) {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  const rng = () => ((h = (h * 1103515245 + 12345) >>> 0) % 1000) / 1000;
  return {
    kd: Number((1 + rng() * 1.5).toFixed(2)),
    win_rate: Math.floor(48 + rng() * 22),
    hours_played: Math.floor(800 + rng() * 3500),
    headshot_pct: Math.floor(30 + rng() * 35),
    rank_tier: ["Gold III","Platinum I","Diamond II","Ascendant","Immortal"][Math.floor(rng() * 5)],
    longest_streak: Math.floor(2 + rng() * 9),
  };
}
