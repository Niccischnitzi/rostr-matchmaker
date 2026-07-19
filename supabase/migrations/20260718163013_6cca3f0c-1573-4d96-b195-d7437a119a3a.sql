-- Reliable social/LFG actions
CREATE OR REPLACE FUNCTION public.request_friend(_target_user uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
  existing public.friends%ROWTYPE;
  row_out public.friends%ROWTYPE;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF _target_user IS NULL OR _target_user = uid THEN RAISE EXCEPTION 'Invalid friend request'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = _target_user AND coalesce(is_public, true) = true) THEN
    RAISE EXCEPTION 'Player is not available';
  END IF;
  IF NOT public.check_rate_limit('request_friend', 30, 60) THEN
    RAISE EXCEPTION 'Slow down — too many friend requests.' USING ERRCODE = 'check_violation';
  END IF;

  SELECT * INTO existing
  FROM public.friends
  WHERE (requester_id = uid AND addressee_id = _target_user)
     OR (requester_id = _target_user AND addressee_id = uid)
  ORDER BY created_at ASC
  LIMIT 1
  FOR UPDATE;

  IF FOUND THEN
    IF existing.status = 'blocked' THEN RAISE EXCEPTION 'This player is blocked'; END IF;
    IF existing.status = 'pending' AND existing.addressee_id = uid THEN
      UPDATE public.friends SET status = 'accepted', updated_at = now() WHERE id = existing.id RETURNING * INTO row_out;
      RETURN jsonb_build_object('ok', true, 'status', 'accepted', 'matched', true, 'friendship_id', row_out.id);
    END IF;
    RETURN jsonb_build_object('ok', true, 'status', existing.status, 'matched', existing.status = 'accepted', 'friendship_id', existing.id);
  END IF;

  INSERT INTO public.friends (requester_id, addressee_id, status)
  VALUES (uid, _target_user, 'pending')
  RETURNING * INTO row_out;

  INSERT INTO public.notifications (user_id, kind, title, body, ref_id)
  VALUES (_target_user, 'friend_request', 'New rostr request', 'Someone wants to add you on Rostr.', row_out.id::text)
  ON CONFLICT DO NOTHING;

  RETURN jsonb_build_object('ok', true, 'status', 'pending', 'matched', false, 'friendship_id', row_out.id);
END;
$$;

CREATE OR REPLACE FUNCTION public.get_or_create_conversation(_other_user uuid)
RETURNS public.conversations
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
  a uuid;
  b uuid;
  conv public.conversations%ROWTYPE;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF _other_user IS NULL OR _other_user = uid THEN RAISE EXCEPTION 'Invalid conversation target'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = _other_user AND coalesce(is_public, true) = true) THEN
    RAISE EXCEPTION 'Player is not available';
  END IF;
  IF uid < _other_user THEN a := uid; b := _other_user; ELSE a := _other_user; b := uid; END IF;

  INSERT INTO public.conversations (user_a, user_b)
  VALUES (a, b)
  ON CONFLICT (user_a, user_b) DO UPDATE SET last_message_at = public.conversations.last_message_at
  RETURNING * INTO conv;

  RETURN conv;
END;
$$;

CREATE OR REPLACE FUNCTION public.send_dm_to_user(_other_user uuid, _body text DEFAULT NULL, _attachment_url text DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
  conv public.conversations%ROWTYPE;
  msg public.direct_messages%ROWTYPE;
  clean_body text := nullif(trim(coalesce(_body, '')), '');
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF clean_body IS NULL AND nullif(trim(coalesce(_attachment_url, '')), '') IS NULL THEN RAISE EXCEPTION 'Message is empty'; END IF;
  IF clean_body IS NOT NULL AND length(clean_body) > 2000 THEN RAISE EXCEPTION 'Message is too long'; END IF;
  IF NOT public.check_rate_limit('send_dm', 80, 60) THEN
    RAISE EXCEPTION 'Slow down — too many messages.' USING ERRCODE = 'check_violation';
  END IF;

  SELECT * INTO conv FROM public.get_or_create_conversation(_other_user);
  INSERT INTO public.direct_messages (conversation_id, sender_id, body, attachment_url)
  VALUES (conv.id, uid, clean_body, nullif(trim(coalesce(_attachment_url, '')), ''))
  RETURNING * INTO msg;

  INSERT INTO public.notifications (user_id, kind, title, body, ref_id)
  VALUES (_other_user, 'dm', 'New message', coalesce(left(clean_body, 120), 'Sent an attachment'), conv.id::text)
  ON CONFLICT DO NOTHING;

  RETURN jsonb_build_object('ok', true, 'conversation', row_to_json(conv), 'message', row_to_json(msg));
END;
$$;

CREATE OR REPLACE FUNCTION public.join_lfg_ad(_ad_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
  ad public.lfg_ads%ROWTYPE;
  inserted_count int := 0;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF _ad_id IS NULL THEN RAISE EXCEPTION 'Missing LFG'; END IF;
  IF NOT public.check_rate_limit('join_lfg_ad', 20, 60) THEN
    RAISE EXCEPTION 'Slow down — too many LFG joins.' USING ERRCODE = 'check_violation';
  END IF;

  SELECT * INTO ad FROM public.lfg_ads WHERE id = _ad_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'LFG not found'; END IF;
  IF ad.host_id = uid THEN RAISE EXCEPTION 'You already host this LFG'; END IF;
  IF ad.closed_at IS NOT NULL OR ad.expires_at <= now() THEN RAISE EXCEPTION 'This LFG is closed'; END IF;
  IF ad.slots_filled >= ad.slots_total THEN RAISE EXCEPTION 'This LFG is full'; END IF;

  INSERT INTO public.lfg_ad_joiners (ad_id, user_id)
  VALUES (_ad_id, uid)
  ON CONFLICT DO NOTHING;
  GET DIAGNOSTICS inserted_count = ROW_COUNT;

  IF inserted_count > 0 THEN
    UPDATE public.lfg_ads
      SET slots_filled = LEAST(slots_total, slots_filled + 1), updated_at = now()
      WHERE id = _ad_id
      RETURNING * INTO ad;
    INSERT INTO public.notifications (user_id, kind, title, body, ref_id)
    VALUES (ad.host_id, 'lfg_join', 'Someone joined your LFG', 'Open chat to coordinate your squad.', _ad_id::text)
    ON CONFLICT DO NOTHING;
  END IF;

  RETURN jsonb_build_object('ok', true, 'already_joined', inserted_count = 0, 'ad', row_to_json(ad));
END;
$$;

-- Post-game ratings
DO $$ BEGIN
  CREATE TYPE public.match_rating_thumb AS ENUM ('up', 'down');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS public.match_ratings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rater_id uuid NOT NULL,
  rated_id uuid NOT NULL,
  challenge_id uuid NULL,
  club_war_id uuid NULL,
  thumbs public.match_rating_thumb NOT NULL,
  tag text NULL CHECK (tag IS NULL OR tag = ANY (ARRAY['Good comms','Chill','Rage quit','No-show','Great teammate','Smart plays','On time','Positive vibe','Tilted','Carried'])),
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (rater_id <> rated_id),
  CHECK ((challenge_id IS NOT NULL)::int + (club_war_id IS NOT NULL)::int = 1),
  UNIQUE (rater_id, rated_id, challenge_id),
  UNIQUE (rater_id, rated_id, club_war_id)
);
GRANT SELECT, INSERT, DELETE ON public.match_ratings TO authenticated;
GRANT ALL ON public.match_ratings TO service_role;
ALTER TABLE public.match_ratings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can view aggregate-source ratings involving them" ON public.match_ratings;
CREATE POLICY "Users can view aggregate-source ratings involving them" ON public.match_ratings
FOR SELECT TO authenticated
USING (auth.uid() IN (rater_id, rated_id));
DROP POLICY IF EXISTS "Users can create their own match ratings" ON public.match_ratings;
CREATE POLICY "Users can create their own match ratings" ON public.match_ratings
FOR INSERT TO authenticated
WITH CHECK (auth.uid() = rater_id);
DROP POLICY IF EXISTS "Users can remove their own match ratings" ON public.match_ratings;
CREATE POLICY "Users can remove their own match ratings" ON public.match_ratings
FOR DELETE TO authenticated
USING (auth.uid() = rater_id);

CREATE OR REPLACE FUNCTION public.can_rate_match(_rater uuid, _rated uuid, _challenge uuid DEFAULT NULL, _club_war uuid DEFAULT NULL)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE
    WHEN _challenge IS NOT NULL THEN EXISTS (
      SELECT 1 FROM public.challenges c
      WHERE c.id = _challenge
        AND c.status = 'settled'
        AND _rater IN (c.challenger_id, c.opponent_id)
        AND _rated IN (c.challenger_id, c.opponent_id)
        AND _rater <> _rated
    )
    WHEN _club_war IS NOT NULL THEN EXISTS (
      SELECT 1 FROM public.club_wars cw
      JOIN public.club_members cm1 ON cm1.club_id IN (cw.challenger_club_id, cw.defender_club_id) AND cm1.user_id = _rater
      JOIN public.club_members cm2 ON cm2.club_id IN (cw.challenger_club_id, cw.defender_club_id) AND cm2.user_id = _rated
      WHERE cw.id = _club_war
        AND cw.status = 'completed'
        AND _rater <> _rated
    )
    ELSE false
  END;
$$;

CREATE OR REPLACE FUNCTION public.submit_match_rating(_rated_id uuid, _thumbs public.match_rating_thumb, _tag text DEFAULT NULL, _challenge_id uuid DEFAULT NULL, _club_war_id uuid DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE uid uuid := auth.uid(); rid uuid;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF _rated_id IS NULL OR _rated_id = uid THEN RAISE EXCEPTION 'Invalid rating target'; END IF;
  IF NOT public.can_rate_match(uid, _rated_id, _challenge_id, _club_war_id) THEN
    RAISE EXCEPTION 'You can only rate players from completed tracked matches';
  END IF;
  IF NOT public.check_rate_limit('submit_match_rating', 30, 60) THEN
    RAISE EXCEPTION 'Slow down — too many ratings.' USING ERRCODE = 'check_violation';
  END IF;

  INSERT INTO public.match_ratings (rater_id, rated_id, challenge_id, club_war_id, thumbs, tag)
  VALUES (uid, _rated_id, _challenge_id, _club_war_id, _thumbs, _tag)
  ON CONFLICT DO NOTHING
  RETURNING id INTO rid;

  RETURN jsonb_build_object('ok', true, 'rating_id', rid, 'already_rated', rid IS NULL);
END;
$$;

CREATE OR REPLACE FUNCTION public.profile_rating_summary(_user_id uuid)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH base AS (
    SELECT * FROM public.match_ratings WHERE rated_id = _user_id
  ), counts AS (
    SELECT count(*)::int total, count(*) FILTER (WHERE thumbs = 'up')::int positive FROM base
  ), tags AS (
    SELECT coalesce(jsonb_agg(jsonb_build_object('tag', tag, 'count', cnt) ORDER BY cnt DESC, tag), '[]'::jsonb) top_tags
    FROM (
      SELECT tag, count(*)::int cnt FROM base WHERE tag IS NOT NULL GROUP BY tag ORDER BY cnt DESC, tag LIMIT 3
    ) t
  )
  SELECT jsonb_build_object(
    'total', counts.total,
    'positive', counts.positive,
    'show_percentage', counts.total >= 5,
    'positive_pct', CASE WHEN counts.total >= 5 THEN round((counts.positive::numeric / counts.total::numeric) * 100)::int ELSE NULL END,
    'top_tags', tags.top_tags
  ) FROM counts, tags;
$$;

-- Chemistry score helpers
CREATE OR REPLACE FUNCTION public.pair_chemistry(_other_user uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
  games int := 0;
  wins int := 0;
  last_played timestamptz;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF _other_user IS NULL OR _other_user = uid THEN RETURN jsonb_build_object('games', 0, 'show_win_rate', false); END IF;

  WITH matches AS (
    SELECT c.updated_at AS played_at,
           (c.winner_id = uid) AS won
    FROM public.challenges c
    WHERE c.status = 'settled'
      AND uid IN (c.challenger_id, c.opponent_id)
      AND _other_user IN (c.challenger_id, c.opponent_id)
      AND uid <> _other_user
  )
  SELECT count(*)::int, count(*) FILTER (WHERE won)::int, max(played_at)
  INTO games, wins, last_played
  FROM matches;

  RETURN jsonb_build_object(
    'games', coalesce(games, 0),
    'wins', coalesce(wins, 0),
    'show_win_rate', coalesce(games, 0) >= 3,
    'win_rate', CASE WHEN coalesce(games, 0) >= 3 THEN round((wins::numeric / games::numeric) * 100)::int ELSE NULL END,
    'last_played', last_played,
    'streak', 0,
    'trend', 'steady'
  );
END;
$$;

-- Voice snippets
CREATE TABLE IF NOT EXISTS public.voice_snippets (
  user_id uuid PRIMARY KEY,
  storage_path text NOT NULL,
  duration_seconds numeric NOT NULL CHECK (duration_seconds > 0 AND duration_seconds <= 15),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.voice_snippets TO authenticated;
GRANT ALL ON public.voice_snippets TO service_role;
ALTER TABLE public.voice_snippets ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public profiles voice snippets readable" ON public.voice_snippets;
CREATE POLICY "Public profiles voice snippets readable" ON public.voice_snippets
FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = voice_snippets.user_id AND coalesce(p.is_public, true) = true));
DROP POLICY IF EXISTS "Users manage own voice snippet" ON public.voice_snippets;
CREATE POLICY "Users manage own voice snippet" ON public.voice_snippets
FOR ALL TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

DROP TRIGGER IF EXISTS set_voice_snippets_updated_at ON public.voice_snippets;
CREATE TRIGGER set_voice_snippets_updated_at
BEFORE UPDATE ON public.voice_snippets
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE FUNCTION public.upsert_voice_snippet(_storage_path text, _duration_seconds numeric)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE uid uuid := auth.uid();
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF _duration_seconds <= 0 OR _duration_seconds > 15 THEN RAISE EXCEPTION 'Voice snippet must be 15 seconds or less'; END IF;
  IF nullif(trim(_storage_path), '') IS NULL THEN RAISE EXCEPTION 'Missing audio file'; END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = uid AND (date_of_birth IS NULL OR date_of_birth <= (current_date - interval '16 years')::date)
  ) THEN
    RAISE EXCEPTION 'Voice snippets require an age-gated account';
  END IF;

  INSERT INTO public.voice_snippets (user_id, storage_path, duration_seconds)
  VALUES (uid, _storage_path, _duration_seconds)
  ON CONFLICT (user_id) DO UPDATE SET storage_path = excluded.storage_path, duration_seconds = excluded.duration_seconds, updated_at = now();

  RETURN jsonb_build_object('ok', true);
END;
$$;

-- Function execution grants: authenticated only for app actions
REVOKE ALL ON FUNCTION public.request_friend(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.request_friend(uuid) TO authenticated;
REVOKE ALL ON FUNCTION public.get_or_create_conversation(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_or_create_conversation(uuid) TO authenticated;
REVOKE ALL ON FUNCTION public.send_dm_to_user(uuid, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.send_dm_to_user(uuid, text, text) TO authenticated;
REVOKE ALL ON FUNCTION public.join_lfg_ad(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.join_lfg_ad(uuid) TO authenticated;
REVOKE ALL ON FUNCTION public.can_rate_match(uuid, uuid, uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.can_rate_match(uuid, uuid, uuid, uuid) TO authenticated;
REVOKE ALL ON FUNCTION public.submit_match_rating(uuid, public.match_rating_thumb, text, uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.submit_match_rating(uuid, public.match_rating_thumb, text, uuid, uuid) TO authenticated;
REVOKE ALL ON FUNCTION public.profile_rating_summary(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.profile_rating_summary(uuid) TO authenticated;
REVOKE ALL ON FUNCTION public.pair_chemistry(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.pair_chemistry(uuid) TO authenticated;
REVOKE ALL ON FUNCTION public.upsert_voice_snippet(text, numeric) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.upsert_voice_snippet(text, numeric) TO authenticated;