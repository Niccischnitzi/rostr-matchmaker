
-- 1) PROFILES: replace blanket authenticated SELECT + protect system fields
DROP POLICY IF EXISTS "Authenticated can view profiles" ON public.profiles;
CREATE POLICY "Profiles: self or public readable"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (auth.uid() = id OR coalesce(is_public, false) = true);

CREATE OR REPLACE FUNCTION public.protect_profile_system_fields()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF current_setting('role', true) = 'service_role' THEN RETURN NEW; END IF;
  NEW.rep_score := OLD.rep_score;
  NEW.pro_until := OLD.pro_until;
  NEW.email_verified_at := OLD.email_verified_at;
  RETURN NEW;
END $$;
REVOKE EXECUTE ON FUNCTION public.protect_profile_system_fields() FROM anon, authenticated, PUBLIC;

DROP TRIGGER IF EXISTS protect_profile_system_fields_trg ON public.profiles;
CREATE TRIGGER protect_profile_system_fields_trg
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.protect_profile_system_fields();

-- 2) CHALLENGES: lock down direct UPDATEs; require RPCs for accept/decline/settle
DROP POLICY IF EXISTS "challenges update involved" ON public.challenges;
CREATE POLICY "challenges no direct update"
  ON public.challenges FOR UPDATE TO authenticated
  USING (false) WITH CHECK (false);

CREATE OR REPLACE FUNCTION public.accept_challenge(_challenge_id uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE uid uuid := auth.uid(); c public.challenges%ROWTYPE;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  SELECT * INTO c FROM public.challenges WHERE id = _challenge_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Challenge not found'; END IF;
  IF c.opponent_id <> uid THEN RAISE EXCEPTION 'Only the opponent can accept'; END IF;
  IF c.status <> 'pending' THEN RAISE EXCEPTION 'Challenge not pending'; END IF;
  UPDATE public.challenges SET status = 'accepted', updated_at = now() WHERE id = _challenge_id;
  RETURN true;
END $$;

CREATE OR REPLACE FUNCTION public.decline_challenge(_challenge_id uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE uid uuid := auth.uid(); c public.challenges%ROWTYPE;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  SELECT * INTO c FROM public.challenges WHERE id = _challenge_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Challenge not found'; END IF;
  IF uid NOT IN (c.opponent_id, c.challenger_id) THEN RAISE EXCEPTION 'Not involved'; END IF;
  IF c.status = 'settled' THEN RAISE EXCEPTION 'Already settled'; END IF;
  UPDATE public.challenges SET status = 'cancelled', updated_at = now() WHERE id = _challenge_id;
  RETURN true;
END $$;

CREATE TABLE IF NOT EXISTS public.challenge_settlements (
  challenge_id uuid NOT NULL REFERENCES public.challenges(id) ON DELETE CASCADE,
  reporter_id uuid NOT NULL,
  claimed_winner_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (challenge_id, reporter_id)
);
GRANT SELECT ON public.challenge_settlements TO authenticated;
GRANT ALL ON public.challenge_settlements TO service_role;
ALTER TABLE public.challenge_settlements ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "settlements: involved read" ON public.challenge_settlements;
CREATE POLICY "settlements: involved read"
  ON public.challenge_settlements FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.challenges c WHERE c.id = challenge_id
                 AND (c.challenger_id = auth.uid() OR c.opponent_id = auth.uid())));

CREATE OR REPLACE FUNCTION public.report_challenge_winner(_challenge_id uuid, _winner_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE uid uuid := auth.uid(); c public.challenges%ROWTYPE; agree int;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  SELECT * INTO c FROM public.challenges WHERE id = _challenge_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Challenge not found'; END IF;
  IF uid NOT IN (c.challenger_id, c.opponent_id) THEN RAISE EXCEPTION 'Not a participant'; END IF;
  IF _winner_id NOT IN (c.challenger_id, c.opponent_id) THEN RAISE EXCEPTION 'Invalid winner'; END IF;
  IF c.status <> 'accepted' THEN RAISE EXCEPTION 'Challenge not accepted'; END IF;

  INSERT INTO public.challenge_settlements (challenge_id, reporter_id, claimed_winner_id)
    VALUES (_challenge_id, uid, _winner_id)
    ON CONFLICT (challenge_id, reporter_id) DO UPDATE
      SET claimed_winner_id = EXCLUDED.claimed_winner_id, created_at = now();

  SELECT count(*) INTO agree FROM public.challenge_settlements
    WHERE challenge_id = _challenge_id AND claimed_winner_id = _winner_id;

  IF agree >= 2 THEN
    UPDATE public.challenges SET status = 'settled', winner_id = _winner_id, updated_at = now()
      WHERE id = _challenge_id;
    RETURN jsonb_build_object('settled', true, 'winner_id', _winner_id);
  END IF;
  RETURN jsonb_build_object('settled', false, 'awaiting_opponent', true);
END $$;

-- 3) MEDIA_POSTS: server-side cost enforcement via trigger
CREATE OR REPLACE FUNCTION public.enforce_media_post_cost()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE cost int;
BEGIN
  IF current_setting('role', true) = 'service_role' THEN RETURN NEW; END IF;
  IF NEW.kind = 'video' THEN
    cost := public.media_upload_cost(NEW.user_id);
    IF cost > 0 THEN
      UPDATE public.wallets
         SET balance_points = balance_points - cost,
             lifetime_lost = lifetime_lost + cost,
             updated_at = now()
       WHERE user_id = NEW.user_id AND balance_points >= cost;
      IF NOT FOUND THEN RAISE EXCEPTION 'Insufficient tokens'; END IF;
      INSERT INTO public.token_transactions (user_id, delta, reason, ref_id)
        VALUES (NEW.user_id, -cost, 'media_upload', NULL);
    END IF;
    NEW.tokens_spent := cost;
  ELSE
    NEW.tokens_spent := 0;
  END IF;
  RETURN NEW;
END $$;
REVOKE EXECUTE ON FUNCTION public.enforce_media_post_cost() FROM anon, authenticated, PUBLIC;

DROP TRIGGER IF EXISTS enforce_media_post_cost_trg ON public.media_posts;
CREATE TRIGGER enforce_media_post_cost_trg
  BEFORE INSERT ON public.media_posts
  FOR EACH ROW EXECUTE FUNCTION public.enforce_media_post_cost();

-- 4) WEBHOOK_EVENTS: explicit deny for anon/authenticated (documents intent)
DROP POLICY IF EXISTS "webhook_events service_role only" ON public.webhook_events;
CREATE POLICY "webhook_events service_role only"
  ON public.webhook_events FOR ALL TO anon, authenticated
  USING (false) WITH CHECK (false);

-- 5) Revoke EXECUTE from anon/PUBLIC on ALL public SECURITY DEFINER functions
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT p.proname, pg_get_function_identity_arguments(p.oid) AS args
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.prosecdef = true
  LOOP
    BEGIN
      EXECUTE format('REVOKE EXECUTE ON FUNCTION public.%I(%s) FROM anon, PUBLIC',
                     r.proname, r.args);
    EXCEPTION WHEN OTHERS THEN NULL; END;
  END LOOP;
END $$;

-- Trigger/internal helpers: also revoke from authenticated
DO $$
DECLARE fn text;
BEGIN
  FOR fn IN
    SELECT unnest(ARRAY[
      'set_updated_at()',
      'bump_conversation_last_message()',
      'bump_group_last_message()',
      'sync_club_member_count()',
      'sync_clan_member_count()',
      'sync_lfg_slots()',
      'add_owner_as_member()',
      'add_clan_owner_member()',
      'add_group_owner_member()',
      'add_default_club_channel()',
      'enforce_single_club_membership()',
      'handle_new_user()',
      'grant_dev_admin_on_signup()',
      'handle_challenge_status()',
      'sync_email_verified()',
      'validate_availability_slot()',
      'protect_profile_system_fields()',
      'enforce_media_post_cost()',
      'process_payment_grant(uuid,text,text,integer,text,text,integer,jsonb,text)'
    ])
  LOOP
    BEGIN
      EXECUTE format('REVOKE EXECUTE ON FUNCTION public.%s FROM authenticated', fn);
    EXCEPTION WHEN OTHERS THEN NULL; END;
  END LOOP;
END $$;

-- Ensure user-facing RPCs remain callable by authenticated
GRANT EXECUTE ON FUNCTION public.accept_challenge(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.decline_challenge(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.report_challenge_winner(uuid, uuid) TO authenticated;

-- 6) STORAGE: avatars are public-facing profile assets — make them anon-readable
DROP POLICY IF EXISTS "Avatars are viewable by authenticated users" ON storage.objects;
DROP POLICY IF EXISTS "Avatars are publicly viewable" ON storage.objects;
CREATE POLICY "Avatars are publicly viewable"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'avatars');
