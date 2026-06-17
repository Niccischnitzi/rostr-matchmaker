
-- activity_events: only owner can read their own activity
DROP POLICY IF EXISTS "Authed read activity" ON public.activity_events;
CREATE POLICY "Own activity read" ON public.activity_events
  FOR SELECT TO authenticated USING (auth.uid() = actor_id);

-- leaderboard_entries: hide audit_flags column from authenticated/anon
REVOKE SELECT (audit_flags) ON public.leaderboard_entries FROM authenticated;
REVOKE SELECT (audit_flags) ON public.leaderboard_entries FROM anon;

-- lfg_boosts: hide tokens_spent column from authenticated/anon
REVOKE SELECT (tokens_spent) ON public.lfg_boosts FROM authenticated;
REVOKE SELECT (tokens_spent) ON public.lfg_boosts FROM anon;

-- profiles: drop the blanket select policy; keep the scoped one
DROP POLICY IF EXISTS "Profiles are viewable by authenticated users" ON public.profiles;

-- user_badges: remove self-award policy; badges must be system-awarded
DROP POLICY IF EXISTS "Self award allowed" ON public.user_badges;
CREATE POLICY "Admins can award badges" ON public.user_badges
  FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Revoke EXECUTE on SECURITY DEFINER functions from anon
REVOKE EXECUTE ON FUNCTION public.boost_lfg(integer, integer) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.spend_tokens(integer) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.record_daily_login() FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.check_rate_limit(text, integer, integer) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.media_uploads_today(uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.media_upload_cost(uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.has_active_pro_subscription(uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, app_role) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.is_conversation_participant(uuid, uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.is_club_member(uuid, uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.club_role_of(uuid, uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.is_clan_member(uuid, uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.clan_role_of(uuid, uuid) FROM anon, public;

GRANT EXECUTE ON FUNCTION public.boost_lfg(integer, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.spend_tokens(integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.record_daily_login() TO authenticated;
GRANT EXECUTE ON FUNCTION public.check_rate_limit(text, integer, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.media_uploads_today(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.media_upload_cost(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_active_pro_subscription(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_conversation_participant(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_club_member(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.club_role_of(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_clan_member(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.clan_role_of(uuid, uuid) TO authenticated;
