// Server-only stat adapters. Each adapter MUST NOT throw — it returns [] on
// any failure so one slow/broken upstream never breaks a refresh.
export type AdapterResult = {
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

/** Steam appids we surface on the battlecard. */
const STEAM_GAMES: Record<number, string> = {
  730: "cs2",
  570: "dota2",
  1172470: "apex",
  252490: "rust",
  578080: "pubg",
  359550: "r6s",
};

async function steamJson(url: string): Promise<any | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) {
      console.warn("[steam] request failed", res.status, await res.text());
      return null;
    }
    return await res.json();
  } catch (e) {
    console.warn("[steam] request threw", e);
    return null;
  }
}

export async function fetchSteamPersona(steamId: string) {
  const key = process.env.STEAM_WEB_API_KEY;
  if (!key) return null;
  const j = await steamJson(
    `https://api.steampowered.com/ISteamUser/GetPlayerSummaries/v2/?key=${key}&steamids=${steamId}`,
  );
  const p = j?.response?.players?.[0];
  if (!p) return null;
  return {
    display_name: (p.personaname as string) ?? null,
    avatar_url: (p.avatarfull as string) ?? null,
    profile_url: (p.profileurl as string) ?? null,
    country: (p.loccountrycode as string) ?? null,
    created_at: p.timecreated ? new Date(p.timecreated * 1000).toISOString() : null,
  };
}

/**
 * Real Steam Web API adapter: owned games (playtime) + per-game achievement
 * stats where the schema exposes them (CS2 exposes total_kills/total_deaths).
 */
export async function steamAdapter(steamId: string): Promise<AdapterResult[]> {
  const key = process.env.STEAM_WEB_API_KEY;
  if (!key) return [];

  const owned = await steamJson(
    `https://api.steampowered.com/IPlayerService/GetOwnedGames/v1/?key=${key}&steamid=${steamId}&include_appinfo=1&include_played_free_games=1`,
  );
  const games: Array<{ appid: number; playtime_forever?: number; name?: string }> =
    owned?.response?.games ?? [];
  if (!games.length) return [];

  const results: AdapterResult[] = [];

  for (const g of games) {
    const gameKey = STEAM_GAMES[g.appid];
    if (!gameKey) continue;
    const hours = Math.round((g.playtime_forever ?? 0) / 60);

    let kd: number | null = null;
    let headshotPct: number | null = null;
    let winRate: number | null = null;

    const stats = await steamJson(
      `https://api.steampowered.com/ISteamUserStats/GetUserStatsForGame/v2/?appid=${g.appid}&key=${key}&steamid=${steamId}`,
    );
    const list: Array<{ name: string; value: number }> = stats?.playerstats?.stats ?? [];
    if (list.length) {
      const get = (n: string) => list.find((s) => s.name === n)?.value ?? null;
      const kills = get("total_kills");
      const deaths = get("total_deaths");
      const hsKills = get("total_kills_headshot");
      const wins = get("total_matches_won");
      const played = get("total_matches_played");
      if (kills != null && deaths) kd = Number((kills / deaths).toFixed(2));
      if (kills && hsKills != null) headshotPct = Math.round((hsKills / kills) * 100);
      if (wins != null && played) winRate = Math.round((wins / played) * 100);
    }

    results.push({
      game_key: gameKey,
      source: "steam",
      hours_played: hours || null,
      kd,
      headshot_pct: headshotPct,
      win_rate: winRate,
      rank_tier: null,
      longest_streak: null,
      raw: { appid: g.appid, name: g.name ?? null },
    });
  }

  // Nothing tracked? Still surface total library playtime as a generic row.
  if (!results.length) {
    const total = Math.round(games.reduce((a, g) => a + (g.playtime_forever ?? 0), 0) / 60);
    results.push({
      game_key: "steam_library",
      source: "steam",
      hours_played: total || null,
      raw: { games: games.length },
    });
  }

  return results;
}

export async function trackerGgAdapter(_externalUid: string, _gameKey: string): Promise<AdapterResult[]> {
  const key = process.env.TRACKER_GG_API_KEY;
  if (!key) return [];
  return [];
}

export async function riotAdapter(_externalUid: string, _gameKey: string): Promise<AdapterResult[]> {
  const key = process.env.RIOT_API_KEY;
  if (!key) return [];
  return [];
}
