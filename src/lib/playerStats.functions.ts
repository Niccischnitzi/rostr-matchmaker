// Live-stats pipeline. Battlecard calls refreshBattlecardStats() to ask the
// server to refresh the player_stats_cache from upstream APIs.
// Adapters live in playerStats.server.ts (server-only).
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const refreshBattlecardStats = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { steamAdapter, riotAdapter, fetchSteamPersona } = await import("./playerStats.server");
    const { supabase, userId } = context;

    const { data: linked, error: linkedErr } = await supabase
      .from("linked_accounts")
      .select("platform, external_uid, aggregated_stats")
      .eq("user_id", userId);
    if (linkedErr) return { ok: false as const, error: linkedErr.message, refreshed: 0 };

    const refreshed: Awaited<ReturnType<typeof steamAdapter>> = [];

    for (const acc of linked ?? []) {
      const uid = (acc as { external_uid: string | null }).external_uid;
      const platform = (acc as { platform: string }).platform?.toLowerCase();
      if (!uid) continue;
      try {
        if (platform === "steam") {
          refreshed.push(...(await steamAdapter(uid)));
          // Keep the linked persona fresh (avatar / display name change often).
          const persona = await fetchSteamPersona(uid);
          if (persona) {
            await supabase
              .from("linked_accounts")
              .update({
                gamertag: persona.display_name ?? uid,
                aggregated_stats: persona as never,
              })
              .eq("user_id", userId)
              .eq("platform", "steam");
          }
        }
        if (platform === "riot") refreshed.push(...(await riotAdapter(uid, "val")));
      } catch (e) {
        console.warn("[stats] adapter failed", platform, e);
      }
    }

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
        raw: (r.raw ?? null) as never,
        fetched_at: new Date().toISOString(),
        expires_at: new Date(Date.now() + 15 * 60_000).toISOString(),
      }));
      const { error: upErr } = await supabase
        .from("player_stats_cache")
        .upsert(rows, { onConflict: "user_id,game_key,source" });
      if (upErr) return { ok: false as const, error: upErr.message, refreshed: 0 };
    }

    return {
      ok: true as const,
      refreshed: refreshed.length,
      adaptersConfigured: !!(
        process.env.STEAM_WEB_API_KEY ||
        process.env.TRACKER_GG_API_KEY ||
        process.env.RIOT_API_KEY
      ),
    };
  });
