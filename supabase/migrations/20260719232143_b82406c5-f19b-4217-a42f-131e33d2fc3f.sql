
-- ============================================================
-- 1) Lock down EXECUTE grants on SECURITY DEFINER functions
--    - Revoke from PUBLIC, anon, authenticated on every SECURITY DEFINER
--    - Re-grant to authenticated only for user-callable RPCs
--    - Re-grant to anon only for the tiny public-read helpers
-- ============================================================

DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT p.oid,
           p.proname,
           pg_get_function_identity_arguments(p.oid) AS args
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.prosecdef = true
  LOOP
    EXECUTE format(
      'REVOKE ALL ON FUNCTION public.%I(%s) FROM PUBLIC, anon, authenticated',
      r.proname, r.args
    );
  END LOOP;
END $$;

-- User-callable RPCs (authenticated only)
GRANT EXECUTE ON FUNCTION public.accept_challenge(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_adjust_tokens(uuid, integer, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.boost_lfg(integer, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.check_rate_limit(text, integer, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.decline_challenge(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.delete_clan(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.equip_cosmetic(uuid, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_or_create_conversation(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.join_lfg_ad(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.kick_clan_member(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.leave_clan(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.mark_all_notifications_read() TO authenticated;
GRANT EXECUTE ON FUNCTION public.pair_chemistry(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.profile_rating_summary(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.purchase_shop_item(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.record_daily_login() TO authenticated;
GRANT EXECUTE ON FUNCTION public.report_challenge_winner(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.request_friend(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.search_all(text, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.send_dm_to_user(uuid, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_clan_member_role(uuid, uuid, clan_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.spend_tokens(integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.submit_match_rating(uuid, uuid, smallint, smallint, smallint, text[], text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.submit_match_rating(uuid, match_rating_thumb, text, uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.transfer_clan_leadership(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.unlock_cosmetic(text, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.unread_notification_count() TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_clan_cosmetic(uuid, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.upsert_voice_snippet(text, numeric) TO authenticated;

-- Public read helpers callable by anon + authenticated
GRANT EXECUTE ON FUNCTION public.public_profile(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.public_profile_stats(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.public_user_cosmetics(uuid) TO anon, authenticated;

-- All other SECURITY DEFINER functions (triggers, helpers, admin-only)
-- remain revoked and are only reachable via triggers or service_role.

-- ============================================================
-- 2) Atomic media_posts creation via SECURITY DEFINER RPC.
--    Block direct client INSERTs so token spend cannot be bypassed.
-- ============================================================

CREATE OR REPLACE FUNCTION public.create_media_post(
  _kind text,
  _media_path text DEFAULT NULL,
  _source_url text DEFAULT NULL,
  _title text DEFAULT NULL,
  _body text DEFAULT NULL,
  _game text DEFAULT NULL,
  _duration_s integer DEFAULT NULL,
  _size_bytes bigint DEFAULT NULL
) RETURNS public.media_posts
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
  row_out public.media_posts%ROWTYPE;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF _kind NOT IN ('image','video','clip') THEN RAISE EXCEPTION 'Invalid media kind'; END IF;
  IF nullif(trim(coalesce(_media_path, '')), '') IS NULL
     AND nullif(trim(coalesce(_source_url, '')), '') IS NULL THEN
    RAISE EXCEPTION 'Missing media';
  END IF;
  IF NOT public.check_rate_limit('create_media_post', 30, 300) THEN
    RAISE EXCEPTION 'Slow down — too many uploads.' USING ERRCODE = 'check_violation';
  END IF;

  -- BEFORE INSERT trigger enforce_media_post_cost_trg deducts tokens atomically.
  INSERT INTO public.media_posts (
    user_id, kind, media_path, source_url, title, body, game, duration_s, size_bytes
  ) VALUES (
    uid, _kind,
    nullif(trim(coalesce(_media_path, '')), ''),
    nullif(trim(coalesce(_source_url, '')), ''),
    nullif(left(coalesce(_title, ''), 200), ''),
    nullif(left(coalesce(_body, ''), 2000), ''),
    nullif(trim(coalesce(_game, '')), ''),
    _duration_s,
    _size_bytes
  )
  RETURNING * INTO row_out;

  RETURN row_out;
END $$;

REVOKE ALL ON FUNCTION public.create_media_post(text, text, text, text, text, text, integer, bigint) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_media_post(text, text, text, text, text, text, integer, bigint) TO authenticated;

-- Remove the client-facing INSERT policy so media_posts can only be
-- created through create_media_post (SECURITY DEFINER owns the row).
DROP POLICY IF EXISTS "Users insert own media" ON public.media_posts;

-- ============================================================
-- 3) Prevent self-tampering with sensitive profile columns.
--    Column-level grants: authenticated may UPDATE only safe fields.
--    Trigger stays in place as belt-and-suspenders.
-- ============================================================

REVOKE UPDATE ON public.profiles FROM authenticated;
GRANT UPDATE (
  username,
  display_name,
  avatar_url,
  banner_url,
  age,
  gender,
  country,
  timezone,
  bio,
  playing_hours,
  availability_status,
  current_game_activity,
  playstyle_badges,
  customization_options,
  is_public,
  lfg_title,
  lfg_body,
  lfg_games,
  date_of_birth,
  dm_policy,
  show_availability,
  onboarded_at,
  custom_traits,
  updated_at
) ON public.profiles TO authenticated;

-- Harden the guard trigger: also block username swaps to service-role only paths bypass.
CREATE OR REPLACE FUNCTION public.protect_profile_system_fields()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF session_user IN ('service_role','supabase_admin','postgres') THEN
    RETURN NEW;
  END IF;
  NEW.rep_score := OLD.rep_score;
  NEW.pro_until := OLD.pro_until;
  NEW.email_verified_at := OLD.email_verified_at;
  RETURN NEW;
END $$;
