
-- Public, safe projection of a profile by username.
CREATE OR REPLACE FUNCTION public.public_profile(_username text)
RETURNS TABLE (
  id uuid, username text, display_name text, avatar_url text, banner_url text,
  bio text, country text, playstyle_badges text[], availability_status text,
  current_game_activity text, lfg_title text, lfg_body text, lfg_games text[],
  rep_score integer, created_at timestamptz,
  halo_class text, frame_class text
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    p.id, p.username, p.display_name, p.avatar_url, p.banner_url,
    p.bio, p.country, p.playstyle_badges, p.availability_status,
    p.current_game_activity, p.lfg_title, p.lfg_body, p.lfg_games,
    p.rep_score, p.created_at,
    (SELECT si.css_class FROM public.user_inventory ui
       JOIN public.shop_items si ON si.id = ui.item_id
      WHERE ui.user_id = p.id AND ui.equipped = true AND si.type = 'halo' LIMIT 1) AS halo_class,
    (SELECT si.css_class FROM public.user_inventory ui
       JOIN public.shop_items si ON si.id = ui.item_id
      WHERE ui.user_id = p.id AND ui.equipped = true AND si.type = 'avatar_frame' LIMIT 1) AS frame_class
  FROM public.profiles p
  WHERE lower(p.username) = lower(_username)
    AND coalesce(p.is_public, true) = true
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.public_profile(text) TO anon, authenticated;

-- Aggregated counts for the profile page.
CREATE OR REPLACE FUNCTION public.public_profile_stats(_user_id uuid)
RETURNS TABLE (friend_count integer, clip_count integer, crew_count integer)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT
    (SELECT count(*)::int FROM public.friends
       WHERE status = 'accepted' AND (_user_id IN (requester_id, addressee_id))) AS friend_count,
    (SELECT count(*)::int FROM public.media_posts WHERE user_id = _user_id) AS clip_count,
    (SELECT count(*)::int FROM public.club_members WHERE user_id = _user_id) AS crew_count;
$$;

GRANT EXECUTE ON FUNCTION public.public_profile_stats(uuid) TO anon, authenticated;

-- Global search across public profiles + crews. Returns a JSON envelope so a
-- single round trip populates both tabs on the /search page.
CREATE OR REPLACE FUNCTION public.search_all(_q text, _limit integer DEFAULT 20)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  q text := trim(coalesce(_q, ''));
  lim int := least(greatest(coalesce(_limit, 20), 1), 50);
  needle text;
  people jsonb;
  crews  jsonb;
BEGIN
  IF q = '' THEN
    RETURN jsonb_build_object('people', '[]'::jsonb, 'crews', '[]'::jsonb);
  END IF;
  needle := '%' || lower(q) || '%';

  SELECT coalesce(jsonb_agg(row_to_json(x)), '[]'::jsonb) INTO people FROM (
    SELECT p.id, p.username, p.display_name, p.avatar_url, p.bio, p.country
    FROM public.profiles p
    WHERE coalesce(p.is_public, true) = true
      AND (lower(p.username) LIKE needle OR lower(coalesce(p.display_name,'')) LIKE needle)
    ORDER BY (lower(p.username) = lower(q)) DESC, p.rep_score DESC NULLS LAST
    LIMIT lim
  ) x;

  SELECT coalesce(jsonb_agg(row_to_json(x)), '[]'::jsonb) INTO crews FROM (
    SELECT c.id, c.name, c.tag, c.description, c.member_count, c.banner_url
    FROM public.clubs c
    WHERE lower(c.name) LIKE needle OR lower(coalesce(c.tag,'')) LIKE needle
    ORDER BY c.member_count DESC NULLS LAST
    LIMIT lim
  ) x;

  RETURN jsonb_build_object('people', people, 'crews', crews);
END $$;

GRANT EXECUTE ON FUNCTION public.search_all(text, integer) TO anon, authenticated;

-- Mark every notification for the caller as read.
CREATE OR REPLACE FUNCTION public.mark_all_notifications_read()
RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE uid uuid := auth.uid(); n int;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  UPDATE public.notifications SET read_at = now()
   WHERE user_id = uid AND read_at IS NULL;
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n;
END $$;

GRANT EXECUTE ON FUNCTION public.mark_all_notifications_read() TO authenticated;
