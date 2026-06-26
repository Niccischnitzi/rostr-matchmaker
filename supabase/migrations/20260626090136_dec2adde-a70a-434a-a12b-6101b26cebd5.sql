
-- 1. availability_slots: drop blanket policy
DROP POLICY IF EXISTS "Authenticated can view availability" ON public.availability_slots;

-- 2. leaderboard_entries: hide audit_flags column
REVOKE SELECT ON public.leaderboard_entries FROM anon, authenticated;
GRANT SELECT (id, tournament_id, user_id, metric, value, recorded_at) ON public.leaderboard_entries TO anon, authenticated;

-- 3. lfg_boosts: hide tokens_spent column
REVOKE SELECT ON public.lfg_boosts FROM anon, authenticated;
GRANT SELECT (id, user_id, starts_at, expires_at) ON public.lfg_boosts TO anon, authenticated;

-- 4. media_posts: hide tokens_spent column
REVOKE SELECT ON public.media_posts FROM anon, authenticated;
GRANT SELECT (id, user_id, kind, title, body, media_path, source_url, game, duration_s, size_bytes, created_at) ON public.media_posts TO anon, authenticated;

-- 5. webhook_events: document/enforce service_role-only access
REVOKE ALL ON public.webhook_events FROM anon, authenticated;
GRANT ALL ON public.webhook_events TO service_role;
COMMENT ON TABLE public.webhook_events IS 'Raw provider webhook payloads. Service role only — never add a SELECT policy for anon/authenticated; reads must go through trusted server functions.';
