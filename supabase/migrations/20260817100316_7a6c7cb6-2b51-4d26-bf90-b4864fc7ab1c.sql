ALTER TABLE public.club_wars ADD COLUMN IF NOT EXISTS roster_size integer NOT NULL DEFAULT 5;

CREATE TABLE IF NOT EXISTS public.club_war_participants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  war_id uuid NOT NULL REFERENCES public.club_wars(id) ON DELETE CASCADE,
  club_id uuid NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  slot integer NOT NULL,
  is_standin boolean NOT NULL DEFAULT false,
  joined_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (war_id, user_id),
  UNIQUE (war_id, club_id, slot)
);

CREATE TABLE IF NOT EXISTS public.club_war_submissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  war_id uuid NOT NULL REFERENCES public.club_wars(id) ON DELETE CASCADE,
  club_id uuid NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  map_index integer NOT NULL DEFAULT 1,
  our_score integer NOT NULL DEFAULT 0,
  their_score integer NOT NULL DEFAULT 0,
  proof_url text,
  note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (war_id, user_id, map_index)
);

GRANT SELECT, INSERT, DELETE ON public.club_war_participants TO authenticated;
GRANT ALL ON public.club_war_participants TO service_role;
GRANT SELECT, INSERT ON public.club_war_submissions TO authenticated;
GRANT ALL ON public.club_war_submissions TO service_role;

ALTER TABLE public.club_war_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.club_war_submissions ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.is_war_participant_club_member(_war uuid, _user uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.club_wars w
    WHERE w.id = _war
      AND (public.is_club_member(w.challenger_club_id, _user)
        OR public.is_club_member(w.defender_club_id, _user))
  )
$$;

REVOKE ALL ON FUNCTION public.is_war_participant_club_member(uuid, uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.is_war_participant_club_member(uuid, uuid) TO authenticated, service_role;

DROP POLICY IF EXISTS "war participants readable by involved crews" ON public.club_war_participants;
CREATE POLICY "war participants readable by involved crews"
ON public.club_war_participants FOR SELECT TO authenticated
USING (public.is_war_participant_club_member(war_id, auth.uid()));

DROP POLICY IF EXISTS "members claim own slot" ON public.club_war_participants;
CREATE POLICY "members claim own slot"
ON public.club_war_participants FOR INSERT TO authenticated
WITH CHECK (user_id = auth.uid() AND public.is_club_member(club_id, auth.uid()));

DROP POLICY IF EXISTS "members release own slot" ON public.club_war_participants;
CREATE POLICY "members release own slot"
ON public.club_war_participants FOR DELETE TO authenticated
USING (user_id = auth.uid() OR public.can_manage_club(club_id, auth.uid()));

DROP POLICY IF EXISTS "war submissions readable by involved crews" ON public.club_war_submissions;
CREATE POLICY "war submissions readable by involved crews"
ON public.club_war_submissions FOR SELECT TO authenticated
USING (public.is_war_participant_club_member(war_id, auth.uid()));

DROP POLICY IF EXISTS "participants submit own results" ON public.club_war_submissions;
CREATE POLICY "participants submit own results"
ON public.club_war_submissions FOR INSERT TO authenticated
WITH CHECK (user_id = auth.uid() AND public.is_club_member(club_id, auth.uid()));

-- Crew members can read wars their crew is involved in.
DROP POLICY IF EXISTS "club members read their wars" ON public.club_wars;
CREATE POLICY "club members read their wars"
ON public.club_wars FOR SELECT TO authenticated
USING (
  public.is_club_member(challenger_club_id, auth.uid())
  OR public.is_club_member(defender_club_id, auth.uid())
);

CREATE OR REPLACE FUNCTION public.join_club_war(_war_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_war public.club_wars;
  v_club uuid;
  v_taken int;
  v_slot int;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF NOT public.check_rate_limit('join_club_war', 20, 60) THEN
    RAISE EXCEPTION 'Slow down a moment and try again';
  END IF;

  SELECT * INTO v_war FROM public.club_wars WHERE id = _war_id;
  IF v_war.id IS NULL THEN RAISE EXCEPTION 'War not found'; END IF;
  IF v_war.status NOT IN ('pending', 'accepted', 'active') THEN
    RAISE EXCEPTION 'This war is no longer open for sign-ups';
  END IF;

  IF public.is_club_member(v_war.challenger_club_id, v_uid) THEN
    v_club := v_war.challenger_club_id;
  ELSIF public.is_club_member(v_war.defender_club_id, v_uid) THEN
    v_club := v_war.defender_club_id;
  ELSE
    RAISE EXCEPTION 'You are not in either crew';
  END IF;

  IF EXISTS (SELECT 1 FROM public.club_war_participants WHERE war_id = _war_id AND user_id = v_uid) THEN
    RETURN jsonb_build_object('ok', true, 'already_joined', true);
  END IF;

  SELECT count(*) INTO v_taken FROM public.club_war_participants
   WHERE war_id = _war_id AND club_id = v_club;
  IF v_taken >= v_war.roster_size THEN
    RAISE EXCEPTION 'All % slots are filled', v_war.roster_size;
  END IF;

  SELECT COALESCE(min(s), 1) INTO v_slot
  FROM generate_series(1, v_war.roster_size) AS s
  WHERE NOT EXISTS (
    SELECT 1 FROM public.club_war_participants p
    WHERE p.war_id = _war_id AND p.club_id = v_club AND p.slot = s
  );

  INSERT INTO public.club_war_participants (war_id, club_id, user_id, slot)
  VALUES (_war_id, v_club, v_uid, v_slot);

  RETURN jsonb_build_object('ok', true, 'already_joined', false, 'slot', v_slot, 'club_id', v_club);
END;
$$;

CREATE OR REPLACE FUNCTION public.leave_club_war(_war_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  DELETE FROM public.club_war_participants WHERE war_id = _war_id AND user_id = v_uid;
  RETURN jsonb_build_object('ok', true);
END;
$$;

CREATE OR REPLACE FUNCTION public.submit_club_war_result(
  _war_id uuid,
  _map_index integer,
  _our_score integer,
  _their_score integer,
  _proof_url text DEFAULT NULL,
  _note text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_war public.club_wars;
  v_club uuid;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF NOT public.check_rate_limit('submit_club_war_result', 30, 300) THEN
    RAISE EXCEPTION 'Too many submissions — try again shortly';
  END IF;
  IF _map_index < 1 OR _map_index > 7 THEN RAISE EXCEPTION 'Invalid map number'; END IF;
  IF _our_score < 0 OR _their_score < 0 OR _our_score > 99 OR _their_score > 99 THEN
    RAISE EXCEPTION 'Invalid score';
  END IF;

  SELECT * INTO v_war FROM public.club_wars WHERE id = _war_id;
  IF v_war.id IS NULL THEN RAISE EXCEPTION 'War not found'; END IF;

  IF public.is_club_member(v_war.challenger_club_id, v_uid) THEN
    v_club := v_war.challenger_club_id;
  ELSIF public.is_club_member(v_war.defender_club_id, v_uid) THEN
    v_club := v_war.defender_club_id;
  ELSE
    RAISE EXCEPTION 'You are not in either crew';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.club_war_participants WHERE war_id = _war_id AND user_id = v_uid) THEN
    RAISE EXCEPTION 'Claim a roster slot before submitting results';
  END IF;

  INSERT INTO public.club_war_submissions (war_id, club_id, user_id, map_index, our_score, their_score, proof_url, note)
  VALUES (_war_id, v_club, v_uid, _map_index, _our_score, _their_score, NULLIF(_proof_url, ''), NULLIF(_note, ''))
  ON CONFLICT (war_id, user_id, map_index) DO UPDATE
    SET our_score = EXCLUDED.our_score,
        their_score = EXCLUDED.their_score,
        proof_url = EXCLUDED.proof_url,
        note = EXCLUDED.note;

  RETURN jsonb_build_object('ok', true, 'club_id', v_club, 'map_index', _map_index);
END;
$$;

CREATE OR REPLACE FUNCTION public.club_war_roster(_war_id uuid)
RETURNS TABLE (
  user_id uuid,
  club_id uuid,
  slot integer,
  username text,
  display_name text,
  avatar_url text,
  submissions bigint
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.user_id, p.club_id, p.slot, pr.username, pr.display_name, pr.avatar_url,
         (SELECT count(*) FROM public.club_war_submissions s
           WHERE s.war_id = p.war_id AND s.user_id = p.user_id)
  FROM public.club_war_participants p
  JOIN public.profiles pr ON pr.id = p.user_id
  WHERE p.war_id = _war_id
    AND public.is_war_participant_club_member(_war_id, auth.uid())
  ORDER BY p.club_id, p.slot
$$;

REVOKE ALL ON FUNCTION public.join_club_war(uuid) FROM anon;
REVOKE ALL ON FUNCTION public.leave_club_war(uuid) FROM anon;
REVOKE ALL ON FUNCTION public.submit_club_war_result(uuid, integer, integer, integer, text, text) FROM anon;
REVOKE ALL ON FUNCTION public.club_war_roster(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.join_club_war(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.leave_club_war(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.submit_club_war_result(uuid, integer, integer, integer, text, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.club_war_roster(uuid) TO authenticated, service_role;

ALTER PUBLICATION supabase_realtime ADD TABLE public.club_war_participants;
ALTER PUBLICATION supabase_realtime ADD TABLE public.club_war_submissions;