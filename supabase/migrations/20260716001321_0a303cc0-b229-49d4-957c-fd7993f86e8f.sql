
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX IF NOT EXISTS profiles_username_trgm ON public.profiles USING gin (username gin_trgm_ops);
CREATE INDEX IF NOT EXISTS profiles_display_name_trgm ON public.profiles USING gin (display_name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS clubs_name_trgm ON public.clubs USING gin (name gin_trgm_ops);

CREATE OR REPLACE FUNCTION public.public_profile(_username text)
RETURNS TABLE(
  id uuid, username text, display_name text, avatar_url text, banner_url text,
  bio text, country text, playstyle_badges text[], availability_status text,
  current_game_activity text, lfg_title text, lfg_body text, lfg_games text[],
  rep_score int, created_at timestamptz, halo_class text, frame_class text
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT
    p.id, p.username, p.display_name, p.avatar_url, p.banner_url,
    p.bio, p.country, p.playstyle_badges, p.availability_status,
    p.current_game_activity, p.lfg_title, p.lfg_body, p.lfg_games,
    p.rep_score, p.created_at,
    (SELECT si.css_class FROM public.user_inventory ui
      JOIN public.shop_items si ON si.id = ui.item_id
      WHERE ui.user_id = p.id AND ui.equipped = true AND si.type = 'halo' LIMIT 1),
    (SELECT si.css_class FROM public.user_inventory ui
      JOIN public.shop_items si ON si.id = ui.item_id
      WHERE ui.user_id = p.id AND ui.equipped = true AND si.type = 'avatar_frame' LIMIT 1)
  FROM public.profiles p
  WHERE p.username = _username AND coalesce(p.is_public, true) = true
  LIMIT 1;
$$;
GRANT EXECUTE ON FUNCTION public.public_profile(text) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.public_profile_stats(_user_id uuid)
RETURNS TABLE(friend_count int, clip_count int, crew_count int)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT
    (SELECT COUNT(*)::int FROM public.friends
       WHERE status = 'accepted' AND (requester_id = _user_id OR addressee_id = _user_id)),
    (SELECT COUNT(*)::int FROM public.media_posts WHERE user_id = _user_id),
    (SELECT COUNT(*)::int FROM public.club_members WHERE user_id = _user_id);
$$;
GRANT EXECUTE ON FUNCTION public.public_profile_stats(uuid) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.search_all(_q text, _limit int DEFAULT 10)
RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  WITH q AS (SELECT trim(_q) AS s),
  people AS (
    SELECT jsonb_build_object(
      'id', p.id, 'username', p.username, 'display_name', p.display_name,
      'avatar_url', p.avatar_url, 'bio', p.bio, 'country', p.country
    ) AS row,
    GREATEST(similarity(p.username, (SELECT s FROM q)), similarity(coalesce(p.display_name,''), (SELECT s FROM q))) AS score
    FROM public.profiles p
    WHERE coalesce(p.is_public, true)
      AND (p.username ILIKE '%' || (SELECT s FROM q) || '%'
           OR coalesce(p.display_name,'') ILIKE '%' || (SELECT s FROM q) || '%')
    ORDER BY score DESC NULLS LAST
    LIMIT _limit
  ),
  crews AS (
    SELECT jsonb_build_object(
      'id', c.id, 'name', c.name, 'tag', c.tag, 'description', c.description,
      'member_count', c.member_count, 'banner_url', c.banner_url
    ) AS row,
    similarity(c.name, (SELECT s FROM q)) AS score
    FROM public.clubs c
    WHERE c.name ILIKE '%' || (SELECT s FROM q) || '%'
    ORDER BY score DESC NULLS LAST
    LIMIT _limit
  )
  SELECT jsonb_build_object(
    'people', coalesce((SELECT jsonb_agg(row) FROM people), '[]'::jsonb),
    'crews',  coalesce((SELECT jsonb_agg(row) FROM crews),  '[]'::jsonb)
  );
$$;
GRANT EXECUTE ON FUNCTION public.search_all(text, int) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.unread_notification_count()
RETURNS int LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT COUNT(*)::int FROM public.notifications
    WHERE user_id = auth.uid() AND read_at IS NULL;
$$;
GRANT EXECUTE ON FUNCTION public.unread_notification_count() TO authenticated;

CREATE OR REPLACE FUNCTION public.mark_all_notifications_read()
RETURNS int LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE n int;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  UPDATE public.notifications SET read_at = now()
    WHERE user_id = auth.uid() AND read_at IS NULL;
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n;
END $$;
GRANT EXECUTE ON FUNCTION public.mark_all_notifications_read() TO authenticated;
