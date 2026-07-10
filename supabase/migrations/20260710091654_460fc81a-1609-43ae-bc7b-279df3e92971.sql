
-- 1. Revoke public EXECUTE on SECURITY DEFINER RPCs; restrict to authenticated (server webhook uses service_role)
REVOKE EXECUTE ON FUNCTION public.equip_cosmetic(uuid, boolean) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.purchase_shop_item(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.unlock_cosmetic(text, integer) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.process_payment_grant(uuid, text, text, integer, text, text, integer, jsonb, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.equip_cosmetic(uuid, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.purchase_shop_item(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.unlock_cosmetic(text, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.process_payment_grant(uuid, text, text, integer, text, text, integer, jsonb, text) TO service_role;

-- 2. clan_members: only members of the same clan can see the roster
DROP POLICY IF EXISTS "clan members read" ON public.clan_members;
CREATE POLICY "clan members read" ON public.clan_members
  FOR SELECT TO authenticated
  USING (public.is_clan_member(clan_id, auth.uid()) OR user_id = auth.uid());

-- 3. leaderboard_entries: scope to authenticated (drop USING(true))
DROP POLICY IF EXISTS "lb read" ON public.leaderboard_entries;
CREATE POLICY "lb read" ON public.leaderboard_entries
  FOR SELECT TO authenticated
  USING (auth.uid() IS NOT NULL);

-- 4. tournament_entries: scope to authenticated
DROP POLICY IF EXISTS "entries read" ON public.tournament_entries;
CREATE POLICY "entries read" ON public.tournament_entries
  FOR SELECT TO authenticated
  USING (auth.uid() IS NOT NULL);

-- 5. media_comments: scope to authenticated
DROP POLICY IF EXISTS "Authenticated view media comments" ON public.media_comments;
CREATE POLICY "Authenticated view media comments" ON public.media_comments
  FOR SELECT TO authenticated
  USING (auth.uid() IS NOT NULL);

-- 6. profiles: hide sensitive fields (date_of_birth, email_verified_at) from lookups
--    via column-level GRANTs while keeping display_name/avatar readable for chat/DMs/leaderboards.
--    Owners keep full access via a dedicated view.
REVOKE SELECT ON public.profiles FROM anon, authenticated;
GRANT SELECT (
  id, username, display_name, avatar_url, banner_url, country, timezone, bio,
  playing_hours, availability_status, current_game_activity, playstyle_badges,
  customization_options, created_at, updated_at, is_public, lfg_title, lfg_body,
  lfg_games, dm_policy, show_availability, pro_until, onboarded_at, rep_score,
  gender, age
) ON public.profiles TO authenticated;

-- Owner-only view exposes sensitive fields (date_of_birth, email_verified_at)
CREATE OR REPLACE VIEW public.my_profile
WITH (security_invoker = true) AS
SELECT * FROM public.profiles WHERE id = auth.uid();
GRANT SELECT ON public.my_profile TO authenticated;

-- Replace the permissive SELECT policy: authenticated may read any row (subject to column grants above);
-- date_of_birth / email_verified_at are unreachable via the Data API for non-owners because no role has SELECT on those columns.
DROP POLICY IF EXISTS "Authenticated can view profiles" ON public.profiles;
CREATE POLICY "Authenticated can view profiles" ON public.profiles
  FOR SELECT TO authenticated
  USING (auth.uid() IS NOT NULL);
