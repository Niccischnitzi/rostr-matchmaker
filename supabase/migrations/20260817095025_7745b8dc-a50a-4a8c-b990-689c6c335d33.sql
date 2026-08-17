-- Crews use public.clubs, so move the war system onto clubs.
DROP FUNCTION IF EXISTS public.create_clan_war(uuid, uuid, text, text, timestamptz, integer);
DROP FUNCTION IF EXISTS public.respond_clan_war(uuid, boolean);
DROP FUNCTION IF EXISTS public.report_clan_war_result(uuid, integer, integer);
DROP FUNCTION IF EXISTS public.settle_clan_war(uuid);
DROP FUNCTION IF EXISTS public.clan_war_standings(uuid);
DROP TABLE IF EXISTS public.clan_war_stakes;
DROP TABLE IF EXISTS public.clan_wars;

ALTER TABLE public.clubs ADD COLUMN IF NOT EXISTS elo integer NOT NULL DEFAULT 1000;

ALTER TABLE public.club_wars
  ADD COLUMN IF NOT EXISTS season_id uuid REFERENCES public.war_seasons(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS challenger_score integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS defender_score integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS reported_by uuid,
  ADD COLUMN IF NOT EXISTS reported_club_id uuid,
  ADD COLUMN IF NOT EXISTS reported_at timestamptz,
  ADD COLUMN IF NOT EXISTS settled_at timestamptz,
  ADD COLUMN IF NOT EXISTS wager_shards integer NOT NULL DEFAULT 0;

ALTER TABLE public.club_wars DROP CONSTRAINT IF EXISTS club_wars_status_check;
ALTER TABLE public.club_wars ADD CONSTRAINT club_wars_status_check
  CHECK (status IN ('pending','accepted','declined','active','reported','completed','cancelled'));
ALTER TABLE public.club_wars DROP CONSTRAINT IF EXISTS club_wars_format_valid;
UPDATE public.club_wars SET format = 'bo3' WHERE format NOT IN ('bo1','bo3','bo5');
ALTER TABLE public.club_wars ADD CONSTRAINT club_wars_format_valid CHECK (format IN ('bo1','bo3','bo5'));
ALTER TABLE public.club_wars DROP CONSTRAINT IF EXISTS club_wars_wager_range;
ALTER TABLE public.club_wars ADD CONSTRAINT club_wars_wager_range CHECK (wager_shards >= 0 AND wager_shards <= 5000);

-- Wars are only written through the guarded actions below.
DROP POLICY IF EXISTS "Club officers can create wars" ON public.club_wars;
DROP POLICY IF EXISTS "Club officers can update their wars" ON public.club_wars;
DROP POLICY IF EXISTS "Challenger officers can delete pending wars" ON public.club_wars;
REVOKE INSERT, UPDATE, DELETE ON public.club_wars FROM authenticated;

CREATE TABLE IF NOT EXISTS public.club_war_stakes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  war_id uuid NOT NULL REFERENCES public.club_wars(id) ON DELETE CASCADE,
  club_id uuid NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  amount integer NOT NULL CHECK (amount > 0),
  status text NOT NULL DEFAULT 'held' CHECK (status IN ('held','paid','refunded')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (war_id, user_id)
);
GRANT SELECT ON public.club_war_stakes TO authenticated;
GRANT ALL ON public.club_war_stakes TO service_role;
ALTER TABLE public.club_war_stakes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Members read stakes of their club wars" ON public.club_war_stakes;
CREATE POLICY "Members read stakes of their club wars" ON public.club_war_stakes
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_club_member(club_id, auth.uid()));

CREATE OR REPLACE FUNCTION public.can_manage_club(_club uuid, _user uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.club_role_of(_club, _user) IN ('owner','officer')
$$;
REVOKE ALL ON FUNCTION public.can_manage_club(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_manage_club(uuid, uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.notify_club_officers(_club uuid, _kind text, _title text, _body text, _link text, _ref uuid)
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  INSERT INTO public.notifications (user_id, kind, title, body, link, ref_id)
  SELECT cm.user_id, _kind, _title, _body, _link, _ref
  FROM public.club_members cm
  WHERE cm.club_id = _club AND cm.role IN ('owner','officer')
$$;
REVOKE ALL ON FUNCTION public.notify_club_officers(uuid, text, text, text, text, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.notify_club_officers(uuid, text, text, text, text, uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.create_club_war(
  _challenger_club uuid, _defender_club uuid, _game text,
  _format text DEFAULT 'bo3', _scheduled_at timestamptz DEFAULT NULL, _wager integer DEFAULT 0
) RETURNS public.club_wars LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE uid uuid := auth.uid(); w public.club_wars; season uuid; bal integer;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF NOT public.check_rate_limit('create_club_war', 10, 3600) THEN RAISE EXCEPTION 'Slow down — too many war challenges'; END IF;
  IF NOT public.can_manage_club(_challenger_club, uid) THEN RAISE EXCEPTION 'Only officers and owners can declare war'; END IF;
  IF _challenger_club = _defender_club THEN RAISE EXCEPTION 'Pick a rival crew'; END IF;
  IF COALESCE(_wager,0) < 0 OR COALESCE(_wager,0) > 5000 THEN RAISE EXCEPTION 'Invalid wager'; END IF;
  IF EXISTS (
    SELECT 1 FROM public.club_wars cw WHERE cw.status IN ('pending','accepted','active','reported')
      AND ((cw.challenger_club_id = _challenger_club AND cw.defender_club_id = _defender_club)
        OR (cw.challenger_club_id = _defender_club AND cw.defender_club_id = _challenger_club))
  ) THEN RAISE EXCEPTION 'You already have an open war with that crew'; END IF;

  SELECT id INTO season FROM public.war_seasons WHERE is_active ORDER BY starts_at DESC LIMIT 1;

  IF COALESCE(_wager,0) > 0 THEN
    SELECT balance_points INTO bal FROM public.wallets WHERE user_id = uid FOR UPDATE;
    IF COALESCE(bal,0) < _wager THEN RAISE EXCEPTION 'Not enough Shards to stake that wager'; END IF;
  END IF;

  INSERT INTO public.club_wars (season_id, challenger_club_id, defender_club_id, game_title, ruleset, format, starts_at, wager_shards, wager_pool, created_by)
  VALUES (season, _challenger_club, _defender_club, _game, COALESCE(_format,'bo3'), COALESCE(_format,'bo3'), _scheduled_at, COALESCE(_wager,0), COALESCE(_wager,0) * 2, uid)
  RETURNING * INTO w;

  IF w.wager_shards > 0 THEN
    UPDATE public.wallets SET balance_points = balance_points - w.wager_shards, updated_at = now() WHERE user_id = uid;
    INSERT INTO public.token_transactions (user_id, delta, reason, ref_id) VALUES (uid, -w.wager_shards, 'club_war_stake', w.id);
    INSERT INTO public.club_war_stakes (war_id, club_id, user_id, amount) VALUES (w.id, _challenger_club, uid, w.wager_shards);
  END IF;

  PERFORM public.notify_club_officers(_defender_club, 'club_war_challenge', 'War declared',
    (SELECT name FROM public.clubs WHERE id = _challenger_club) || ' challenged you to a ' || w.format || ' on ' || w.game_title, '/', w.id);
  RETURN w;
END $$;
REVOKE ALL ON FUNCTION public.create_club_war(uuid, uuid, text, text, timestamptz, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_club_war(uuid, uuid, text, text, timestamptz, integer) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.respond_club_war(_war_id uuid, _accept boolean)
RETURNS public.club_wars LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE uid uuid := auth.uid(); w public.club_wars; bal integer;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  SELECT * INTO w FROM public.club_wars WHERE id = _war_id FOR UPDATE;
  IF w.id IS NULL THEN RAISE EXCEPTION 'War not found'; END IF;
  IF w.status <> 'pending' THEN RAISE EXCEPTION 'This war is no longer pending'; END IF;
  IF NOT public.can_manage_club(w.defender_club_id, uid) THEN RAISE EXCEPTION 'Only officers and owners can respond'; END IF;

  IF NOT _accept THEN
    UPDATE public.club_wars SET status = 'declined', updated_at = now() WHERE id = w.id RETURNING * INTO w;
    UPDATE public.wallets wa SET balance_points = wa.balance_points + s.amount, updated_at = now()
      FROM public.club_war_stakes s WHERE s.war_id = w.id AND s.status = 'held' AND wa.user_id = s.user_id;
    INSERT INTO public.token_transactions (user_id, delta, reason, ref_id)
      SELECT user_id, amount, 'club_war_refund', w.id FROM public.club_war_stakes WHERE war_id = w.id AND status = 'held';
    UPDATE public.club_war_stakes SET status = 'refunded' WHERE war_id = w.id AND status = 'held';
    PERFORM public.notify_club_officers(w.challenger_club_id, 'club_war_declined', 'War declined',
      (SELECT name FROM public.clubs WHERE id = w.defender_club_id) || ' declined your challenge', '/', w.id);
    RETURN w;
  END IF;

  IF w.wager_shards > 0 THEN
    SELECT balance_points INTO bal FROM public.wallets WHERE user_id = uid FOR UPDATE;
    IF COALESCE(bal,0) < w.wager_shards THEN RAISE EXCEPTION 'Not enough Shards to match the wager'; END IF;
    UPDATE public.wallets SET balance_points = balance_points - w.wager_shards, updated_at = now() WHERE user_id = uid;
    INSERT INTO public.token_transactions (user_id, delta, reason, ref_id) VALUES (uid, -w.wager_shards, 'club_war_stake', w.id);
    INSERT INTO public.club_war_stakes (war_id, club_id, user_id, amount) VALUES (w.id, w.defender_club_id, uid, w.wager_shards);
  END IF;

  UPDATE public.club_wars SET status = 'accepted', updated_at = now() WHERE id = w.id RETURNING * INTO w;
  PERFORM public.notify_club_officers(w.challenger_club_id, 'club_war_accepted', 'War accepted',
    (SELECT name FROM public.clubs WHERE id = w.defender_club_id) || ' accepted your challenge', '/', w.id);
  RETURN w;
END $$;
REVOKE ALL ON FUNCTION public.respond_club_war(uuid, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.respond_club_war(uuid, boolean) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.settle_club_war(_war_id uuid)
RETURNS public.club_wars LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE w public.club_wars; winner uuid; loser uuid; pool integer; winners integer; share integer;
BEGIN
  SELECT * INTO w FROM public.club_wars WHERE id = _war_id FOR UPDATE;
  IF w.status <> 'reported' THEN RAISE EXCEPTION 'War is not awaiting settlement'; END IF;
  winner := CASE WHEN w.challenger_score > w.defender_score THEN w.challenger_club_id ELSE w.defender_club_id END;
  loser := CASE WHEN winner = w.challenger_club_id THEN w.defender_club_id ELSE w.challenger_club_id END;

  SELECT COALESCE(SUM(amount),0) INTO pool FROM public.club_war_stakes WHERE war_id = w.id AND status = 'held';
  SELECT COUNT(*) INTO winners FROM public.club_war_stakes WHERE war_id = w.id AND status = 'held' AND club_id = winner;
  IF pool > 0 AND winners > 0 THEN
    share := pool / winners;
    UPDATE public.wallets wa SET balance_points = wa.balance_points + share,
      lifetime_won = wa.lifetime_won + share, updated_at = now()
      FROM public.club_war_stakes s
      WHERE s.war_id = w.id AND s.status = 'held' AND s.club_id = winner AND wa.user_id = s.user_id;
    INSERT INTO public.token_transactions (user_id, delta, reason, ref_id)
      SELECT user_id, share, 'club_war_payout', w.id FROM public.club_war_stakes WHERE war_id = w.id AND status = 'held' AND club_id = winner;
    UPDATE public.wallets wa SET lifetime_lost = wa.lifetime_lost + s.amount
      FROM public.club_war_stakes s
      WHERE s.war_id = w.id AND s.status = 'held' AND s.club_id = loser AND wa.user_id = s.user_id;
  END IF;
  UPDATE public.club_war_stakes SET status = 'paid' WHERE war_id = w.id AND status = 'held';

  UPDATE public.clubs SET elo = GREATEST(0, elo + 25), updated_at = now() WHERE id = winner;
  UPDATE public.clubs SET elo = GREATEST(0, elo - 15), updated_at = now() WHERE id = loser;

  UPDATE public.club_wars SET status = 'completed', winner_club_id = winner, settled_at = now(), ends_at = now(), updated_at = now()
  WHERE id = w.id RETURNING * INTO w;

  PERFORM public.notify_club_officers(winner, 'club_war_won', 'War won',
    'Your crew won the war ' || w.challenger_score || '-' || w.defender_score, '/', w.id);
  PERFORM public.notify_club_officers(loser, 'club_war_lost', 'War lost',
    'Your crew lost the war ' || w.challenger_score || '-' || w.defender_score, '/', w.id);
  RETURN w;
END $$;
REVOKE ALL ON FUNCTION public.settle_club_war(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.settle_club_war(uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.report_club_war_result(_war_id uuid, _challenger_score integer, _defender_score integer)
RETURNS public.club_wars LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE uid uuid := auth.uid(); w public.club_wars; my_club uuid; needed integer;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  SELECT * INTO w FROM public.club_wars WHERE id = _war_id FOR UPDATE;
  IF w.id IS NULL THEN RAISE EXCEPTION 'War not found'; END IF;
  IF w.status NOT IN ('accepted','active','reported') THEN RAISE EXCEPTION 'This war cannot be scored'; END IF;
  IF public.can_manage_club(w.challenger_club_id, uid) THEN my_club := w.challenger_club_id;
  ELSIF public.can_manage_club(w.defender_club_id, uid) THEN my_club := w.defender_club_id;
  ELSE RAISE EXCEPTION 'Only officers and owners can report results'; END IF;

  needed := CASE w.format WHEN 'bo1' THEN 1 WHEN 'bo5' THEN 3 ELSE 2 END;
  IF _challenger_score < 0 OR _defender_score < 0 THEN RAISE EXCEPTION 'Scores must be positive'; END IF;
  IF GREATEST(_challenger_score, _defender_score) <> needed THEN
    RAISE EXCEPTION 'A % is won at % map wins', w.format, needed;
  END IF;
  IF _challenger_score = _defender_score THEN RAISE EXCEPTION 'A war cannot end in a draw'; END IF;

  IF w.status = 'reported' AND w.reported_club_id IS DISTINCT FROM my_club THEN
    IF w.challenger_score <> _challenger_score OR w.defender_score <> _defender_score THEN
      RAISE EXCEPTION 'Scores do not match the other crew''s report — agree on the result first';
    END IF;
    RETURN public.settle_club_war(w.id);
  END IF;

  UPDATE public.club_wars SET status = 'reported', challenger_score = _challenger_score, defender_score = _defender_score,
    reported_by = uid, reported_club_id = my_club, reported_at = now(), updated_at = now()
  WHERE id = w.id RETURNING * INTO w;
  PERFORM public.notify_club_officers(
    CASE WHEN my_club = w.challenger_club_id THEN w.defender_club_id ELSE w.challenger_club_id END,
    'club_war_reported', 'Confirm war result',
    'A result of ' || w.challenger_score || '-' || w.defender_score || ' was reported. Confirm it to settle the war.', '/', w.id);
  RETURN w;
END $$;
REVOKE ALL ON FUNCTION public.report_club_war_result(uuid, integer, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.report_club_war_result(uuid, integer, integer) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.club_war_standings(_season uuid DEFAULT NULL)
RETURNS TABLE (club_id uuid, club_name text, club_tag text, elo integer, wins bigint, losses bigint, map_diff bigint, points bigint)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH season AS (
    SELECT COALESCE(_season, (SELECT id FROM public.war_seasons WHERE is_active ORDER BY starts_at DESC LIMIT 1)) AS id
  ),
  played AS (
    SELECT cw.challenger_club_id AS club_id, cw.winner_club_id = cw.challenger_club_id AS won,
           cw.challenger_score - cw.defender_score AS diff
    FROM public.club_wars cw, season s
    WHERE cw.status = 'completed' AND cw.season_id IS NOT DISTINCT FROM s.id
    UNION ALL
    SELECT cw.defender_club_id, cw.winner_club_id = cw.defender_club_id,
           cw.defender_score - cw.challenger_score
    FROM public.club_wars cw, season s
    WHERE cw.status = 'completed' AND cw.season_id IS NOT DISTINCT FROM s.id
  )
  SELECT c.id, c.name, c.tag, c.elo,
         COUNT(*) FILTER (WHERE p.won) AS wins,
         COUNT(*) FILTER (WHERE NOT p.won) AS losses,
         COALESCE(SUM(p.diff), 0) AS map_diff,
         COUNT(*) FILTER (WHERE p.won) * 3 AS points
  FROM played p JOIN public.clubs c ON c.id = p.club_id
  GROUP BY c.id, c.name, c.tag, c.elo
  ORDER BY points DESC, map_diff DESC, c.elo DESC
  LIMIT 100
$$;
REVOKE ALL ON FUNCTION public.club_war_standings(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.club_war_standings(uuid) TO authenticated, service_role;