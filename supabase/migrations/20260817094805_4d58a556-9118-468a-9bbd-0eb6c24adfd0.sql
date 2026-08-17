-- ============ WAR SEASONS ============
CREATE TABLE public.war_seasons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  starts_at timestamptz NOT NULL DEFAULT now(),
  ends_at timestamptz NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.war_seasons TO anon, authenticated;
GRANT ALL ON public.war_seasons TO service_role;
ALTER TABLE public.war_seasons ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Seasons are public" ON public.war_seasons FOR SELECT USING (true);

INSERT INTO public.war_seasons (name, slug, starts_at, ends_at, is_active)
VALUES ('Season 1 — Ignition', 'season-1-ignition', now() - interval '3 days', now() + interval '60 days', true);

-- ============ CLAN WARS ============
CREATE TABLE public.clan_wars (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  season_id uuid REFERENCES public.war_seasons(id) ON DELETE SET NULL,
  challenger_clan_id uuid NOT NULL REFERENCES public.clans(id) ON DELETE CASCADE,
  defender_clan_id uuid NOT NULL REFERENCES public.clans(id) ON DELETE CASCADE,
  game text NOT NULL,
  format text NOT NULL DEFAULT 'bo3',
  status text NOT NULL DEFAULT 'pending',
  scheduled_at timestamptz,
  wager_shards integer NOT NULL DEFAULT 0,
  challenger_score integer NOT NULL DEFAULT 0,
  defender_score integer NOT NULL DEFAULT 0,
  reported_by uuid,
  reported_at timestamptz,
  reported_clan_id uuid,
  winner_clan_id uuid,
  settled_at timestamptz,
  created_by uuid NOT NULL DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT clan_wars_distinct_clans CHECK (challenger_clan_id <> defender_clan_id),
  CONSTRAINT clan_wars_format_valid CHECK (format IN ('bo1','bo3','bo5')),
  CONSTRAINT clan_wars_status_valid CHECK (status IN ('pending','accepted','reported','completed','declined','cancelled')),
  CONSTRAINT clan_wars_wager_range CHECK (wager_shards >= 0 AND wager_shards <= 5000)
);
CREATE INDEX clan_wars_challenger_idx ON public.clan_wars (challenger_clan_id, status);
CREATE INDEX clan_wars_defender_idx ON public.clan_wars (defender_clan_id, status);
CREATE INDEX clan_wars_season_idx ON public.clan_wars (season_id, status);
GRANT SELECT ON public.clan_wars TO anon, authenticated;
GRANT ALL ON public.clan_wars TO service_role;
ALTER TABLE public.clan_wars ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Clan wars are public" ON public.clan_wars FOR SELECT USING (true);

-- ============ STAKES ============
CREATE TABLE public.clan_war_stakes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  war_id uuid NOT NULL REFERENCES public.clan_wars(id) ON DELETE CASCADE,
  clan_id uuid NOT NULL REFERENCES public.clans(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  amount integer NOT NULL CHECK (amount > 0),
  status text NOT NULL DEFAULT 'held' CHECK (status IN ('held','paid','refunded')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (war_id, user_id)
);
GRANT SELECT ON public.clan_war_stakes TO authenticated;
GRANT ALL ON public.clan_war_stakes TO service_role;
ALTER TABLE public.clan_war_stakes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Members read stakes of their clan wars" ON public.clan_war_stakes
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_clan_member(clan_id, auth.uid()));

-- ============ HELPERS ============
CREATE OR REPLACE FUNCTION public.can_manage_clan(_clan uuid, _user uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.clan_role_rank(public.clan_role_of(_clan, _user)) >= public.clan_role_rank('officer'::public.clan_role)
$$;
REVOKE ALL ON FUNCTION public.can_manage_clan(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_manage_clan(uuid, uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.notify_clan_officers(_clan uuid, _kind text, _title text, _body text, _link text, _ref uuid)
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  INSERT INTO public.notifications (user_id, kind, title, body, link, ref_id)
  SELECT cm.user_id, _kind, _title, _body, _link, _ref
  FROM public.clan_members cm
  WHERE cm.clan_id = _clan
    AND public.clan_role_rank(cm.role) >= public.clan_role_rank('officer'::public.clan_role)
$$;
REVOKE ALL ON FUNCTION public.notify_clan_officers(uuid, text, text, text, text, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.notify_clan_officers(uuid, text, text, text, text, uuid) TO service_role;

-- ============ CREATE WAR ============
CREATE OR REPLACE FUNCTION public.create_clan_war(
  _challenger_clan uuid, _defender_clan uuid, _game text,
  _format text DEFAULT 'bo3', _scheduled_at timestamptz DEFAULT NULL, _wager integer DEFAULT 0
) RETURNS public.clan_wars LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE uid uuid := auth.uid(); w public.clan_wars; season uuid; bal integer;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF NOT public.check_rate_limit('create_clan_war', 10, 3600) THEN RAISE EXCEPTION 'Slow down — too many war challenges'; END IF;
  IF NOT public.can_manage_clan(_challenger_clan, uid) THEN RAISE EXCEPTION 'Only officers and above can declare war'; END IF;
  IF _challenger_clan = _defender_clan THEN RAISE EXCEPTION 'Pick a rival clan'; END IF;
  IF COALESCE(_wager,0) < 0 OR COALESCE(_wager,0) > 5000 THEN RAISE EXCEPTION 'Invalid wager'; END IF;
  IF EXISTS (
    SELECT 1 FROM public.clan_wars cw WHERE cw.status IN ('pending','accepted','reported')
      AND ((cw.challenger_clan_id = _challenger_clan AND cw.defender_clan_id = _defender_clan)
        OR (cw.challenger_clan_id = _defender_clan AND cw.defender_clan_id = _challenger_clan))
  ) THEN RAISE EXCEPTION 'You already have an open war with that clan'; END IF;

  SELECT id INTO season FROM public.war_seasons WHERE is_active ORDER BY starts_at DESC LIMIT 1;

  IF COALESCE(_wager,0) > 0 THEN
    SELECT balance_points INTO bal FROM public.wallets WHERE user_id = uid FOR UPDATE;
    IF COALESCE(bal,0) < _wager THEN RAISE EXCEPTION 'Not enough Shards to stake that wager'; END IF;
  END IF;

  INSERT INTO public.clan_wars (season_id, challenger_clan_id, defender_clan_id, game, format, scheduled_at, wager_shards, created_by)
  VALUES (season, _challenger_clan, _defender_clan, _game, COALESCE(_format,'bo3'), _scheduled_at, COALESCE(_wager,0), uid)
  RETURNING * INTO w;

  IF w.wager_shards > 0 THEN
    UPDATE public.wallets SET balance_points = balance_points - w.wager_shards, updated_at = now() WHERE user_id = uid;
    INSERT INTO public.token_transactions (user_id, delta, reason, ref_id) VALUES (uid, -w.wager_shards, 'clan_war_stake', w.id);
    INSERT INTO public.clan_war_stakes (war_id, clan_id, user_id, amount) VALUES (w.id, _challenger_clan, uid, w.wager_shards);
  END IF;

  PERFORM public.notify_clan_officers(_defender_clan, 'clan_war_challenge', 'War declared',
    (SELECT name FROM public.clans WHERE id = _challenger_clan) || ' challenged you to a ' || w.format || ' on ' || w.game,
    '/', w.id);
  RETURN w;
END $$;
REVOKE ALL ON FUNCTION public.create_clan_war(uuid, uuid, text, text, timestamptz, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_clan_war(uuid, uuid, text, text, timestamptz, integer) TO authenticated, service_role;

-- ============ RESPOND ============
CREATE OR REPLACE FUNCTION public.respond_clan_war(_war_id uuid, _accept boolean)
RETURNS public.clan_wars LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE uid uuid := auth.uid(); w public.clan_wars; bal integer;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  SELECT * INTO w FROM public.clan_wars WHERE id = _war_id FOR UPDATE;
  IF w.id IS NULL THEN RAISE EXCEPTION 'War not found'; END IF;
  IF w.status <> 'pending' THEN RAISE EXCEPTION 'This war is no longer pending'; END IF;
  IF NOT public.can_manage_clan(w.defender_clan_id, uid) THEN RAISE EXCEPTION 'Only officers and above can respond'; END IF;

  IF NOT _accept THEN
    UPDATE public.clan_wars SET status = 'declined', updated_at = now() WHERE id = w.id RETURNING * INTO w;
    UPDATE public.wallets wa SET balance_points = wa.balance_points + s.amount, updated_at = now()
      FROM public.clan_war_stakes s WHERE s.war_id = w.id AND s.status = 'held' AND wa.user_id = s.user_id;
    INSERT INTO public.token_transactions (user_id, delta, reason, ref_id)
      SELECT user_id, amount, 'clan_war_refund', w.id FROM public.clan_war_stakes WHERE war_id = w.id AND status = 'held';
    UPDATE public.clan_war_stakes SET status = 'refunded' WHERE war_id = w.id AND status = 'held';
    PERFORM public.notify_clan_officers(w.challenger_clan_id, 'clan_war_declined', 'War declined',
      (SELECT name FROM public.clans WHERE id = w.defender_clan_id) || ' declined your challenge', '/', w.id);
    RETURN w;
  END IF;

  IF w.wager_shards > 0 THEN
    SELECT balance_points INTO bal FROM public.wallets WHERE user_id = uid FOR UPDATE;
    IF COALESCE(bal,0) < w.wager_shards THEN RAISE EXCEPTION 'Not enough Shards to match the wager'; END IF;
    UPDATE public.wallets SET balance_points = balance_points - w.wager_shards, updated_at = now() WHERE user_id = uid;
    INSERT INTO public.token_transactions (user_id, delta, reason, ref_id) VALUES (uid, -w.wager_shards, 'clan_war_stake', w.id);
    INSERT INTO public.clan_war_stakes (war_id, clan_id, user_id, amount) VALUES (w.id, w.defender_clan_id, uid, w.wager_shards);
  END IF;

  UPDATE public.clan_wars SET status = 'accepted', updated_at = now() WHERE id = w.id RETURNING * INTO w;
  PERFORM public.notify_clan_officers(w.challenger_clan_id, 'clan_war_accepted', 'War accepted',
    (SELECT name FROM public.clans WHERE id = w.defender_clan_id) || ' accepted your challenge', '/', w.id);
  RETURN w;
END $$;
REVOKE ALL ON FUNCTION public.respond_clan_war(uuid, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.respond_clan_war(uuid, boolean) TO authenticated, service_role;

-- ============ SETTLE ============
CREATE OR REPLACE FUNCTION public.settle_clan_war(_war_id uuid)
RETURNS public.clan_wars LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE w public.clan_wars; winner uuid; loser uuid; pool integer; winners integer; share integer;
BEGIN
  SELECT * INTO w FROM public.clan_wars WHERE id = _war_id FOR UPDATE;
  IF w.status <> 'reported' THEN RAISE EXCEPTION 'War is not awaiting settlement'; END IF;
  winner := CASE WHEN w.challenger_score > w.defender_score THEN w.challenger_clan_id ELSE w.defender_clan_id END;
  loser := CASE WHEN winner = w.challenger_clan_id THEN w.defender_clan_id ELSE w.challenger_clan_id END;

  SELECT COALESCE(SUM(amount),0) INTO pool FROM public.clan_war_stakes WHERE war_id = w.id AND status = 'held';
  SELECT COUNT(*) INTO winners FROM public.clan_war_stakes WHERE war_id = w.id AND status = 'held' AND clan_id = winner;
  IF pool > 0 AND winners > 0 THEN
    share := pool / winners;
    UPDATE public.wallets wa SET balance_points = wa.balance_points + share,
      lifetime_won = wa.lifetime_won + share, updated_at = now()
      FROM public.clan_war_stakes s
      WHERE s.war_id = w.id AND s.status = 'held' AND s.clan_id = winner AND wa.user_id = s.user_id;
    INSERT INTO public.token_transactions (user_id, delta, reason, ref_id)
      SELECT user_id, share, 'clan_war_payout', w.id FROM public.clan_war_stakes WHERE war_id = w.id AND status = 'held' AND clan_id = winner;
    UPDATE public.wallets wa SET lifetime_lost = wa.lifetime_lost + s.amount
      FROM public.clan_war_stakes s
      WHERE s.war_id = w.id AND s.status = 'held' AND s.clan_id = loser AND wa.user_id = s.user_id;
  END IF;
  UPDATE public.clan_war_stakes SET status = 'paid' WHERE war_id = w.id AND status = 'held';

  UPDATE public.clans SET elo = GREATEST(0, elo + 25), updated_at = now() WHERE id = winner;
  UPDATE public.clans SET elo = GREATEST(0, elo - 15), updated_at = now() WHERE id = loser;

  UPDATE public.clan_wars SET status = 'completed', winner_clan_id = winner, settled_at = now(), updated_at = now()
  WHERE id = w.id RETURNING * INTO w;

  PERFORM public.notify_clan_officers(winner, 'clan_war_won', 'War won',
    'Your clan won the war ' || w.challenger_score || '-' || w.defender_score, '/', w.id);
  PERFORM public.notify_clan_officers(loser, 'clan_war_lost', 'War lost',
    'Your clan lost the war ' || w.challenger_score || '-' || w.defender_score, '/', w.id);
  RETURN w;
END $$;
REVOKE ALL ON FUNCTION public.settle_clan_war(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.settle_clan_war(uuid) TO service_role;

-- ============ REPORT RESULT ============
CREATE OR REPLACE FUNCTION public.report_clan_war_result(_war_id uuid, _challenger_score integer, _defender_score integer)
RETURNS public.clan_wars LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE uid uuid := auth.uid(); w public.clan_wars; my_clan uuid; needed integer;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  SELECT * INTO w FROM public.clan_wars WHERE id = _war_id FOR UPDATE;
  IF w.id IS NULL THEN RAISE EXCEPTION 'War not found'; END IF;
  IF w.status NOT IN ('accepted','reported') THEN RAISE EXCEPTION 'This war cannot be scored'; END IF;
  IF public.can_manage_clan(w.challenger_clan_id, uid) THEN my_clan := w.challenger_clan_id;
  ELSIF public.can_manage_clan(w.defender_clan_id, uid) THEN my_clan := w.defender_clan_id;
  ELSE RAISE EXCEPTION 'Only officers and above can report results'; END IF;

  needed := CASE w.format WHEN 'bo1' THEN 1 WHEN 'bo5' THEN 3 ELSE 2 END;
  IF _challenger_score < 0 OR _defender_score < 0 THEN RAISE EXCEPTION 'Scores must be positive'; END IF;
  IF GREATEST(_challenger_score, _defender_score) <> needed THEN
    RAISE EXCEPTION 'A % is won at % map wins', w.format, needed;
  END IF;
  IF _challenger_score = _defender_score THEN RAISE EXCEPTION 'A war cannot end in a draw'; END IF;

  IF w.status = 'reported' AND w.reported_clan_id IS DISTINCT FROM my_clan THEN
    IF w.challenger_score <> _challenger_score OR w.defender_score <> _defender_score THEN
      RAISE EXCEPTION 'Scores do not match the other clan''s report — resolve it together first';
    END IF;
    RETURN public.settle_clan_war(w.id);
  END IF;

  UPDATE public.clan_wars SET status = 'reported', challenger_score = _challenger_score, defender_score = _defender_score,
    reported_by = uid, reported_clan_id = my_clan, reported_at = now(), updated_at = now()
  WHERE id = w.id RETURNING * INTO w;
  PERFORM public.notify_clan_officers(
    CASE WHEN my_clan = w.challenger_clan_id THEN w.defender_clan_id ELSE w.challenger_clan_id END,
    'clan_war_reported', 'Confirm war result',
    'A result of ' || w.challenger_score || '-' || w.defender_score || ' was reported. Confirm it to settle the war.', '/', w.id);
  RETURN w;
END $$;
REVOKE ALL ON FUNCTION public.report_clan_war_result(uuid, integer, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.report_clan_war_result(uuid, integer, integer) TO authenticated, service_role;

-- ============ STANDINGS ============
CREATE OR REPLACE FUNCTION public.clan_war_standings(_season uuid DEFAULT NULL)
RETURNS TABLE (clan_id uuid, clan_name text, clan_tag text, elo integer, wins bigint, losses bigint, map_diff bigint, points bigint)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH season AS (
    SELECT COALESCE(_season, (SELECT id FROM public.war_seasons WHERE is_active ORDER BY starts_at DESC LIMIT 1)) AS id
  ),
  played AS (
    SELECT cw.challenger_clan_id AS clan_id, cw.winner_clan_id = cw.challenger_clan_id AS won,
           cw.challenger_score - cw.defender_score AS diff
    FROM public.clan_wars cw, season s
    WHERE cw.status = 'completed' AND cw.season_id IS NOT DISTINCT FROM s.id
    UNION ALL
    SELECT cw.defender_clan_id, cw.winner_clan_id = cw.defender_clan_id,
           cw.defender_score - cw.challenger_score
    FROM public.clan_wars cw, season s
    WHERE cw.status = 'completed' AND cw.season_id IS NOT DISTINCT FROM s.id
  )
  SELECT c.id, c.name, c.tag, c.elo,
         COUNT(*) FILTER (WHERE p.won) AS wins,
         COUNT(*) FILTER (WHERE NOT p.won) AS losses,
         COALESCE(SUM(p.diff), 0) AS map_diff,
         COUNT(*) FILTER (WHERE p.won) * 3 AS points
  FROM played p JOIN public.clans c ON c.id = p.clan_id
  GROUP BY c.id, c.name, c.tag, c.elo
  ORDER BY points DESC, map_diff DESC, c.elo DESC
  LIMIT 100
$$;
REVOKE ALL ON FUNCTION public.clan_war_standings(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.clan_war_standings(uuid) TO anon, authenticated, service_role;

-- ============ PLATFORM LINKS ============
CREATE OR REPLACE FUNCTION public.upsert_linked_account(_platform text, _gamertag text, _external_uid text DEFAULT NULL)
RETURNS public.linked_accounts LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE uid uuid := auth.uid(); r public.linked_accounts;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF _platform NOT IN ('riot','xbox','psn','twitch','youtube','discord','epic','battlenet','faceit') THEN
    RAISE EXCEPTION 'Unsupported platform';
  END IF;
  IF _gamertag IS NULL OR length(btrim(_gamertag)) < 2 OR length(_gamertag) > 64 THEN
    RAISE EXCEPTION 'Enter a valid handle';
  END IF;
  IF NOT public.check_rate_limit('upsert_linked_account', 30, 3600) THEN RAISE EXCEPTION 'Slow down'; END IF;

  INSERT INTO public.linked_accounts (user_id, platform, gamertag, external_uid)
  VALUES (uid, _platform, btrim(_gamertag), _external_uid)
  ON CONFLICT (user_id, platform) DO UPDATE
    SET gamertag = btrim(_gamertag),
        external_uid = COALESCE(EXCLUDED.external_uid, public.linked_accounts.external_uid),
        updated_at = now()
  RETURNING * INTO r;
  RETURN r;
END $$;
REVOKE ALL ON FUNCTION public.upsert_linked_account(text, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.upsert_linked_account(text, text, text) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.remove_linked_account(_platform text)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE uid uuid := auth.uid();
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  DELETE FROM public.linked_accounts WHERE user_id = uid AND platform = _platform;
  RETURN true;
END $$;
REVOKE ALL ON FUNCTION public.remove_linked_account(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.remove_linked_account(text) TO authenticated, service_role;