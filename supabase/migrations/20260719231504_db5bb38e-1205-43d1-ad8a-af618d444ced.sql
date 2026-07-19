
-- 1. Add ref_id to notifications so existing RPCs (request_friend, join_lfg_ad, send_dm_to_user) work.
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS ref_id text;

-- Backfill link from ref_id where sensible so /inbox row clicks navigate.
-- (No-op if already set.)

-- 2. Friend accepted notification trigger
CREATE OR REPLACE FUNCTION public.notify_friend_accepted()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.status = 'accepted' AND (OLD.status IS DISTINCT FROM 'accepted') THEN
    INSERT INTO public.notifications (user_id, kind, title, body, ref_id, link)
    VALUES (NEW.requester_id, 'friend_accepted', 'Rostr accepted', 'You matched — say hi.', NEW.id::text, '/inbox')
    ON CONFLICT DO NOTHING;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_notify_friend_accepted ON public.friends;
CREATE TRIGGER trg_notify_friend_accepted
  AFTER UPDATE ON public.friends
  FOR EACH ROW EXECUTE FUNCTION public.notify_friend_accepted();

-- 3. Clan cosmetic column
ALTER TABLE public.clans ADD COLUMN IF NOT EXISTS cosmetic jsonb NOT NULL DEFAULT '{}'::jsonb;

-- 4. Clan admin RPCs
-- role ordering helper
CREATE OR REPLACE FUNCTION public.clan_role_rank(_role public.clan_role)
RETURNS int LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE _role
    WHEN 'leader' THEN 6
    WHEN 'co_leader' THEN 5
    WHEN 'officer' THEN 4
    WHEN 'veteran' THEN 3
    WHEN 'member' THEN 2
    WHEN 'recruit' THEN 1
    ELSE 0 END;
$$;

CREATE OR REPLACE FUNCTION public.set_clan_member_role(_clan uuid, _user uuid, _role public.clan_role)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  uid uuid := auth.uid();
  caller_role public.clan_role;
  target_role public.clan_role;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF NOT public.check_rate_limit('clan_admin', 30, 60) THEN
    RAISE EXCEPTION 'Slow down.' USING ERRCODE = 'check_violation';
  END IF;
  SELECT role INTO caller_role FROM public.clan_members WHERE clan_id = _clan AND user_id = uid;
  SELECT role INTO target_role FROM public.clan_members WHERE clan_id = _clan AND user_id = _user;
  IF caller_role IS NULL THEN RAISE EXCEPTION 'Not a clan member'; END IF;
  IF target_role IS NULL THEN RAISE EXCEPTION 'Target not in clan'; END IF;
  IF caller_role NOT IN ('leader','co_leader') THEN RAISE EXCEPTION 'Insufficient rank'; END IF;
  IF target_role = 'leader' THEN RAISE EXCEPTION 'Cannot change the leader''s role'; END IF;
  IF _role = 'leader' THEN RAISE EXCEPTION 'Use transfer_clan_leadership'; END IF;
  IF _role = 'co_leader' AND caller_role <> 'leader' THEN RAISE EXCEPTION 'Only the leader can appoint co-leaders'; END IF;
  IF public.clan_role_rank(_role) >= public.clan_role_rank(caller_role) AND caller_role <> 'leader' THEN
    RAISE EXCEPTION 'Cannot promote to your own rank or higher';
  END IF;
  UPDATE public.clan_members SET role = _role WHERE clan_id = _clan AND user_id = _user;

  INSERT INTO public.notifications (user_id, kind, title, body, ref_id, link)
  VALUES (_user, 'clan_role_changed', 'Rank updated',
    'You are now ' || replace(_role::text, '_', '-') || ' in your clan.',
    _clan::text, '/');
  RETURN true;
END $$;

CREATE OR REPLACE FUNCTION public.kick_clan_member(_clan uuid, _user uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  uid uuid := auth.uid();
  caller_role public.clan_role;
  target_role public.clan_role;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF uid = _user THEN RAISE EXCEPTION 'Use leave_clan to leave'; END IF;
  IF NOT public.check_rate_limit('clan_admin', 30, 60) THEN
    RAISE EXCEPTION 'Slow down.' USING ERRCODE = 'check_violation';
  END IF;
  SELECT role INTO caller_role FROM public.clan_members WHERE clan_id = _clan AND user_id = uid;
  SELECT role INTO target_role FROM public.clan_members WHERE clan_id = _clan AND user_id = _user;
  IF caller_role IS NULL THEN RAISE EXCEPTION 'Not a clan member'; END IF;
  IF target_role IS NULL THEN RAISE EXCEPTION 'Target not in clan'; END IF;
  IF caller_role NOT IN ('leader','co_leader') THEN RAISE EXCEPTION 'Insufficient rank'; END IF;
  IF public.clan_role_rank(target_role) >= public.clan_role_rank(caller_role) THEN
    RAISE EXCEPTION 'Cannot kick a peer or superior';
  END IF;
  DELETE FROM public.clan_members WHERE clan_id = _clan AND user_id = _user;
  RETURN true;
END $$;

CREATE OR REPLACE FUNCTION public.leave_clan(_clan uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  uid uuid := auth.uid();
  caller_role public.clan_role;
  cnt int;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  SELECT role INTO caller_role FROM public.clan_members WHERE clan_id = _clan AND user_id = uid;
  IF caller_role IS NULL THEN RAISE EXCEPTION 'Not a clan member'; END IF;
  IF caller_role = 'leader' THEN
    SELECT count(*) INTO cnt FROM public.clan_members WHERE clan_id = _clan AND user_id <> uid;
    IF cnt > 0 THEN
      RAISE EXCEPTION 'Transfer leadership before leaving';
    END IF;
    DELETE FROM public.clans WHERE id = _clan AND owner_id = uid;
    RETURN true;
  END IF;
  DELETE FROM public.clan_members WHERE clan_id = _clan AND user_id = uid;
  RETURN true;
END $$;

CREATE OR REPLACE FUNCTION public.transfer_clan_leadership(_clan uuid, _new_leader uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE uid uuid := auth.uid();
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF uid = _new_leader THEN RAISE EXCEPTION 'Pick a different member'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.clans WHERE id = _clan AND owner_id = uid) THEN
    RAISE EXCEPTION 'Only the leader can transfer leadership';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.clan_members WHERE clan_id = _clan AND user_id = _new_leader) THEN
    RAISE EXCEPTION 'New leader must be a clan member';
  END IF;
  UPDATE public.clan_members SET role = 'co_leader' WHERE clan_id = _clan AND user_id = uid;
  UPDATE public.clan_members SET role = 'leader'   WHERE clan_id = _clan AND user_id = _new_leader;
  UPDATE public.clans SET owner_id = _new_leader, updated_at = now() WHERE id = _clan;

  INSERT INTO public.notifications (user_id, kind, title, body, ref_id, link)
  VALUES (_new_leader, 'clan_role_changed', 'You are the new leader', 'Leadership transferred.', _clan::text, '/');
  RETURN true;
END $$;

CREATE OR REPLACE FUNCTION public.delete_clan(_clan uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE uid uuid := auth.uid();
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.clans WHERE id = _clan AND owner_id = uid) THEN
    RAISE EXCEPTION 'Only the leader can delete the clan';
  END IF;
  DELETE FROM public.clan_members WHERE clan_id = _clan;
  DELETE FROM public.clans WHERE id = _clan;
  RETURN true;
END $$;

CREATE OR REPLACE FUNCTION public.update_clan_cosmetic(_clan uuid, _cosmetic jsonb)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE uid uuid := auth.uid(); caller_role public.clan_role;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  SELECT role INTO caller_role FROM public.clan_members WHERE clan_id = _clan AND user_id = uid;
  IF caller_role NOT IN ('leader','co_leader') THEN RAISE EXCEPTION 'Only leaders can change clan cosmetics'; END IF;
  UPDATE public.clans SET cosmetic = coalesce(_cosmetic, '{}'::jsonb), updated_at = now() WHERE id = _clan;
  RETURN true;
END $$;

-- Lock everything down
REVOKE EXECUTE ON FUNCTION public.set_clan_member_role(uuid, uuid, public.clan_role) FROM anon;
REVOKE EXECUTE ON FUNCTION public.kick_clan_member(uuid, uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.leave_clan(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.transfer_clan_leadership(uuid, uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.delete_clan(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.update_clan_cosmetic(uuid, jsonb) FROM anon;
GRANT EXECUTE ON FUNCTION public.set_clan_member_role(uuid, uuid, public.clan_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.kick_clan_member(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.leave_clan(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.transfer_clan_leadership(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.delete_clan(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_clan_cosmetic(uuid, jsonb) TO authenticated;
