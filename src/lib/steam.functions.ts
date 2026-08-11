// Steam OpenID link + Steam ID sync.
// linkSteam finalizes the link from the client after the OpenID redirect lands
// and immediately syncs the Steam passport (persona, library, playtime) so the
// Universal Gaming Passport and public profiles can render real Steam details.
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const Input = z.object({
  external_id: z.string().regex(/^\d{17}$/),
  display_name: z.string().max(120).nullable().optional(),
  avatar_url: z.string().url().max(500).nullable().optional(),
});

export const linkSteam = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => Input.parse(data))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    // Enforce one rostr account per Steam id.
    const { data: existing } = await supabase
      .from("linked_accounts")
      .select("user_id")
      .eq("platform", "steam")
      .eq("external_uid", data.external_id)
      .maybeSingle();
    if (existing && existing.user_id !== userId) {
      return { error: "This Steam account is already linked to another rostr profile." };
    }

    const { fetchSteamPassport } = await import("./playerStats.server");
    const passport = await fetchSteamPassport(data.external_id).catch(() => null);

    const { error } = await supabase
      .from("linked_accounts")
      .upsert(
        {
          user_id: userId,
          platform: "steam",
          external_uid: data.external_id,
          gamertag: passport?.display_name ?? data.display_name ?? data.external_id,
          verified: true,
          aggregated_stats: (passport ?? {
            steam_id: data.external_id,
            avatar_url: data.avatar_url ?? null,
            display_name: data.display_name ?? null,
            profile_url: `https://steamcommunity.com/profiles/${data.external_id}`,
          }) as never,
        } as never,
        { onConflict: "user_id,platform" } as never
      );
    if (error) return { error: error.message };
    return { ok: true as const, passport };
  });

/** Re-pull the Steam passport + per-game stats for the signed-in user. */
export const syncSteam = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;

    const { data: row } = await supabase
      .from("linked_accounts")
      .select("external_uid")
      .eq("user_id", userId)
      .eq("platform", "steam")
      .maybeSingle();
    const steamId = (row as { external_uid: string | null } | null)?.external_uid;
    if (!steamId) return { error: "No Steam account linked." };

    const { fetchSteamPassport, steamAdapter } = await import("./playerStats.server");
    const passport = await fetchSteamPassport(steamId);
    if (!passport) return { error: "Steam is not reachable right now. Try again shortly." };

    const { error: upErr } = await supabase
      .from("linked_accounts")
      .update({
        gamertag: passport.display_name ?? steamId,
        aggregated_stats: passport as never,
      })
      .eq("user_id", userId)
      .eq("platform", "steam");
    if (upErr) return { error: upErr.message };

    // Refresh per-game rows so the battlecard matches the passport.
    const results = await steamAdapter(steamId).catch(() => []);
    if (results.length) {
      await supabase.from("player_stats_cache").upsert(
        results.map((r) => ({
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
        })),
        { onConflict: "user_id,game_key,source" }
      );
    }

    return { ok: true as const, passport, games: results.length };
  });
