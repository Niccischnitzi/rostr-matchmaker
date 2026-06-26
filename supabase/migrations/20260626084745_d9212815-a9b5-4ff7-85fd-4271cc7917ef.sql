-- =========================================================================
-- SECURITY FIXES
-- =========================================================================

-- 1. availability_slots: tighten SELECT to public, opt-in profiles only
DROP POLICY IF EXISTS "Availability is viewable by everyone" ON public.availability_slots;
DROP POLICY IF EXISTS "Anyone can view availability" ON public.availability_slots;
DROP POLICY IF EXISTS "availability_slots_select" ON public.availability_slots;
DROP POLICY IF EXISTS "Public availability viewable" ON public.availability_slots;

CREATE POLICY "Availability viewable for public opt-in profiles or owner"
  ON public.availability_slots
  FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = availability_slots.user_id
        AND p.is_public = true
        AND COALESCE(p.show_availability, false) = true
    )
  );

-- 2. Column-level revokes for sensitive numeric columns
REVOKE SELECT (audit_flags) ON public.leaderboard_entries FROM anon, authenticated;
REVOKE SELECT (tokens_spent) ON public.lfg_boosts FROM anon, authenticated;
REVOKE SELECT (tokens_spent) ON public.media_posts FROM anon, authenticated;

-- 3. Revoke EXECUTE on all SECURITY DEFINER functions from anon
DO $$
DECLARE
  fn record;
BEGIN
  FOR fn IN
    SELECT n.nspname, p.proname, pg_get_function_identity_arguments(p.oid) AS args
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.prosecdef = true
  LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %I.%I(%s) FROM anon, public',
      fn.nspname, fn.proname, fn.args);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %I.%I(%s) TO authenticated, service_role',
      fn.nspname, fn.proname, fn.args);
  END LOOP;
END $$;

-- =========================================================================
-- GAMES DIRECTORY
-- =========================================================================
CREATE TABLE IF NOT EXISTS public.games (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lookup_key TEXT NOT NULL UNIQUE,        -- canonical slug, matches external API ids when possible
  name TEXT NOT NULL,
  category TEXT NOT NULL,                  -- 'shooter' | 'battle_royale' | 'moba' | 'sports' | 'fighting' | 'sim' | 'racing' | 'mmo' | 'card' | 'other'
  publisher TEXT,
  steam_app_id INT,                        -- nullable; populated for Steam titles
  tracker_gg_slug TEXT,                    -- nullable; populated for Tracker.gg supported titles
  riot_game_key TEXT,                      -- 'val' | 'lol' | 'tft' | 'wr'
  icon_url TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  popularity INT NOT NULL DEFAULT 0,       -- higher = ranked first in pickers
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_games_category ON public.games (category);
CREATE INDEX IF NOT EXISTS idx_games_popularity ON public.games (popularity DESC);

GRANT SELECT ON public.games TO anon, authenticated;
GRANT ALL ON public.games TO service_role;

ALTER TABLE public.games ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Games are public" ON public.games
  FOR SELECT TO anon, authenticated USING (true);

CREATE POLICY "Admins manage games" ON public.games
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER games_set_updated_at
  BEFORE UPDATE ON public.games
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- =========================================================================
-- PLAYER STATS CACHE (live-stats fallback)
-- =========================================================================
CREATE TABLE IF NOT EXISTS public.player_stats_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  game_key TEXT NOT NULL REFERENCES public.games(lookup_key) ON DELETE CASCADE,
  source TEXT NOT NULL,                          -- 'steam' | 'tracker_gg' | 'riot' | 'manual' | 'stub'
  rank_tier TEXT,                                -- 'Diamond III', 'Radiant', 'Global Elite', ...
  kd NUMERIC(5,2),
  win_rate NUMERIC(5,2),                         -- 0–100
  hours_played INT,
  headshot_pct NUMERIC(5,2),
  longest_streak INT,
  raw JSONB,                                     -- full API payload for debugging/expansion
  fetched_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '15 minutes'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, game_key, source)
);

CREATE INDEX IF NOT EXISTS idx_stats_cache_user ON public.player_stats_cache (user_id);
CREATE INDEX IF NOT EXISTS idx_stats_cache_expiry ON public.player_stats_cache (expires_at);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.player_stats_cache TO authenticated;
GRANT ALL ON public.player_stats_cache TO service_role;

ALTER TABLE public.player_stats_cache ENABLE ROW LEVEL SECURITY;

-- Owner can always read/write their own cache
CREATE POLICY "Owner reads own stats cache" ON public.player_stats_cache
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Owner writes own stats cache" ON public.player_stats_cache
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Owner updates own stats cache" ON public.player_stats_cache
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Owner deletes own stats cache" ON public.player_stats_cache
  FOR DELETE TO authenticated
  USING (user_id = auth.uid());

-- Anyone signed-in can read stats for public profiles
CREATE POLICY "Public profile stats readable" ON public.player_stats_cache
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = player_stats_cache.user_id
        AND p.is_public = true
    )
  );

CREATE TRIGGER stats_cache_set_updated_at
  BEFORE UPDATE ON public.player_stats_cache
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();