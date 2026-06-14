
-- ============== LFG AD VIEWS ==============
CREATE TABLE public.lfg_ad_views (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ad_owner_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  viewer_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX lfg_ad_views_owner_created_idx ON public.lfg_ad_views (ad_owner_id, created_at DESC);
CREATE UNIQUE INDEX lfg_ad_views_unique_viewer ON public.lfg_ad_views (ad_owner_id, viewer_id) WHERE viewer_id IS NOT NULL;

GRANT SELECT, INSERT ON public.lfg_ad_views TO authenticated;
GRANT ALL ON public.lfg_ad_views TO service_role;
ALTER TABLE public.lfg_ad_views ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners see their views" ON public.lfg_ad_views FOR SELECT TO authenticated USING (auth.uid() = ad_owner_id);
CREATE POLICY "Authed can record view" ON public.lfg_ad_views FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL AND auth.uid() <> ad_owner_id);

-- ============== REPORTS ==============
CREATE TYPE public.report_target AS ENUM ('profile','media_post','direct_message','crew','comment');
CREATE TYPE public.report_status AS ENUM ('open','reviewing','upheld','dismissed');

CREATE TABLE public.user_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  target_type public.report_target NOT NULL,
  target_id TEXT NOT NULL,
  reason TEXT NOT NULL,
  details TEXT,
  status public.report_status NOT NULL DEFAULT 'open',
  reviewer_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_at TIMESTAMPTZ
);
CREATE INDEX user_reports_status_idx ON public.user_reports (status, created_at DESC);

GRANT SELECT, INSERT, UPDATE ON public.user_reports TO authenticated;
GRANT ALL ON public.user_reports TO service_role;
ALTER TABLE public.user_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Reporters see own" ON public.user_reports FOR SELECT TO authenticated USING (auth.uid() = reporter_id OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "Authed file report" ON public.user_reports FOR INSERT TO authenticated WITH CHECK (auth.uid() = reporter_id);
CREATE POLICY "Mods resolve" ON public.user_reports FOR UPDATE TO authenticated USING (public.has_role(auth.uid(),'admin'));

-- ============== BLOCKS ==============
CREATE TABLE public.user_blocks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  blocker_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  blocked_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (blocker_id, blocked_id),
  CHECK (blocker_id <> blocked_id)
);

GRANT SELECT, INSERT, DELETE ON public.user_blocks TO authenticated;
GRANT ALL ON public.user_blocks TO service_role;
ALTER TABLE public.user_blocks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "See my blocks" ON public.user_blocks FOR SELECT TO authenticated USING (auth.uid() = blocker_id);
CREATE POLICY "Create my block" ON public.user_blocks FOR INSERT TO authenticated WITH CHECK (auth.uid() = blocker_id);
CREATE POLICY "Remove my block" ON public.user_blocks FOR DELETE TO authenticated USING (auth.uid() = blocker_id);

-- ============== RATE LIMITS ==============
CREATE TABLE public.rate_limit_events (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  action TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX rate_limit_lookup_idx ON public.rate_limit_events (user_id, action, created_at DESC);
GRANT SELECT, INSERT ON public.rate_limit_events TO authenticated;
GRANT ALL ON public.rate_limit_events TO service_role;
ALTER TABLE public.rate_limit_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Insert my events" ON public.rate_limit_events FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Read my events" ON public.rate_limit_events FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.check_rate_limit(_action TEXT, _limit INT, _window_seconds INT)
RETURNS BOOLEAN
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public
AS $$
DECLARE uid UUID := auth.uid(); cnt INT;
BEGIN
  IF uid IS NULL THEN RETURN FALSE; END IF;
  SELECT COUNT(*) INTO cnt FROM public.rate_limit_events
   WHERE user_id = uid AND action = _action AND created_at > now() - make_interval(secs => _window_seconds);
  IF cnt >= _limit THEN RETURN FALSE; END IF;
  INSERT INTO public.rate_limit_events (user_id, action) VALUES (uid, _action);
  RETURN TRUE;
END $$;

-- ============== PROFILE ADDITIONS ==============
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS date_of_birth DATE,
  ADD COLUMN IF NOT EXISTS email_verified_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS dm_policy TEXT NOT NULL DEFAULT 'everyone' CHECK (dm_policy IN ('everyone','friends','none')),
  ADD COLUMN IF NOT EXISTS show_availability BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS pro_until TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS onboarded_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS rep_score INT NOT NULL DEFAULT 0;

-- ============== LOGIN STREAKS ==============
CREATE TABLE public.login_streaks (
  user_id UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  current_streak INT NOT NULL DEFAULT 0,
  longest_streak INT NOT NULL DEFAULT 0,
  last_login_date DATE,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.login_streaks TO authenticated;
GRANT ALL ON public.login_streaks TO service_role;
ALTER TABLE public.login_streaks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Own streak read" ON public.login_streaks FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Own streak upsert ins" ON public.login_streaks FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Own streak upsert upd" ON public.login_streaks FOR UPDATE TO authenticated USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.record_daily_login()
RETURNS TABLE(streak INT, reward INT)
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public
AS $$
DECLARE uid UUID := auth.uid(); today DATE := (now() AT TIME ZONE 'UTC')::date;
  prev DATE; cur INT; rew INT := 0;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  SELECT last_login_date, current_streak INTO prev, cur FROM public.login_streaks WHERE user_id = uid;
  IF prev IS NULL THEN
    INSERT INTO public.login_streaks (user_id, current_streak, longest_streak, last_login_date)
      VALUES (uid, 1, 1, today)
      ON CONFLICT (user_id) DO UPDATE SET current_streak=1, longest_streak=GREATEST(login_streaks.longest_streak,1), last_login_date=today, updated_at=now();
    cur := 1; rew := 5;
  ELSIF prev = today THEN
    RETURN QUERY SELECT cur, 0; RETURN;
  ELSIF prev = today - INTERVAL '1 day' THEN
    cur := cur + 1;
    rew := LEAST(25, 5 + (cur - 1) * 2);
    UPDATE public.login_streaks SET current_streak=cur, longest_streak=GREATEST(longest_streak,cur), last_login_date=today, updated_at=now() WHERE user_id=uid;
  ELSE
    cur := 1; rew := 5;
    UPDATE public.login_streaks SET current_streak=1, last_login_date=today, updated_at=now() WHERE user_id=uid;
  END IF;
  UPDATE public.wallets SET balance_points = balance_points + rew, lifetime_won = lifetime_won + rew WHERE user_id = uid;
  RETURN QUERY SELECT cur, rew;
END $$;

-- ============== PUSH SUBSCRIPTIONS ==============
CREATE TABLE public.push_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  endpoint TEXT NOT NULL UNIQUE,
  p256dh TEXT NOT NULL,
  auth_key TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, DELETE ON public.push_subscriptions TO authenticated;
GRANT ALL ON public.push_subscriptions TO service_role;
ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Own subs read" ON public.push_subscriptions FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Own subs insert" ON public.push_subscriptions FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Own subs delete" ON public.push_subscriptions FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- ============== PLAY SESSIONS ==============
CREATE TYPE public.play_session_kind AS ENUM ('call','lfg_match','crew_event');
CREATE TABLE public.play_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_a UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  user_b UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  kind public.play_session_kind NOT NULL,
  game TEXT,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ended_at TIMESTAMPTZ,
  CHECK (user_a <> user_b)
);
CREATE INDEX play_sessions_a_idx ON public.play_sessions (user_a, started_at DESC);
CREATE INDEX play_sessions_b_idx ON public.play_sessions (user_b, started_at DESC);
GRANT SELECT, INSERT, UPDATE ON public.play_sessions TO authenticated;
GRANT ALL ON public.play_sessions TO service_role;
ALTER TABLE public.play_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "See sessions involving me" ON public.play_sessions FOR SELECT TO authenticated USING (auth.uid() IN (user_a, user_b));
CREATE POLICY "Log my sessions" ON public.play_sessions FOR INSERT TO authenticated WITH CHECK (auth.uid() IN (user_a, user_b));
CREATE POLICY "Update sessions I am in" ON public.play_sessions FOR UPDATE TO authenticated USING (auth.uid() IN (user_a, user_b));

-- ============== ACTIVITY EVENTS ==============
CREATE TYPE public.activity_kind AS ENUM ('post','like','friend_add','crew_join','tournament_win','badge_earned','streak');
CREATE TABLE public.activity_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  kind public.activity_kind NOT NULL,
  subject_id TEXT,
  payload JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX activity_events_actor_idx ON public.activity_events (actor_id, created_at DESC);
CREATE INDEX activity_events_created_idx ON public.activity_events (created_at DESC);
GRANT SELECT, INSERT ON public.activity_events TO authenticated;
GRANT ALL ON public.activity_events TO service_role;
ALTER TABLE public.activity_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authed read activity" ON public.activity_events FOR SELECT TO authenticated USING (true);
CREATE POLICY "Insert my activity" ON public.activity_events FOR INSERT TO authenticated WITH CHECK (auth.uid() = actor_id);

-- ============== MENTIONS ==============
CREATE TABLE public.mentions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mentioner_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  mentioned_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  source_type TEXT NOT NULL,
  source_id TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX mentions_for_user_idx ON public.mentions (mentioned_id, created_at DESC);
GRANT SELECT, INSERT ON public.mentions TO authenticated;
GRANT ALL ON public.mentions TO service_role;
ALTER TABLE public.mentions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "See mentions to me" ON public.mentions FOR SELECT TO authenticated USING (auth.uid() = mentioned_id OR auth.uid() = mentioner_id);
CREATE POLICY "Create mention" ON public.mentions FOR INSERT TO authenticated WITH CHECK (auth.uid() = mentioner_id);

-- ============== CREW EVENTS ==============
CREATE TYPE public.rsvp_status AS ENUM ('yes','maybe','no');
CREATE TABLE public.crew_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clan_id UUID NOT NULL REFERENCES public.clans(id) ON DELETE CASCADE,
  organizer_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  game TEXT,
  starts_at TIMESTAMPTZ NOT NULL,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX crew_events_clan_starts_idx ON public.crew_events (clan_id, starts_at);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.crew_events TO authenticated;
GRANT ALL ON public.crew_events TO service_role;
ALTER TABLE public.crew_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Members read events" ON public.crew_events FOR SELECT TO authenticated USING (public.is_clan_member(clan_id, auth.uid()));
CREATE POLICY "Members create events" ON public.crew_events FOR INSERT TO authenticated WITH CHECK (public.is_clan_member(clan_id, auth.uid()) AND auth.uid() = organizer_id);
CREATE POLICY "Organizer update" ON public.crew_events FOR UPDATE TO authenticated USING (auth.uid() = organizer_id);
CREATE POLICY "Organizer delete" ON public.crew_events FOR DELETE TO authenticated USING (auth.uid() = organizer_id);

CREATE TABLE public.crew_event_rsvps (
  event_id UUID NOT NULL REFERENCES public.crew_events(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  status public.rsvp_status NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (event_id, user_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.crew_event_rsvps TO authenticated;
GRANT ALL ON public.crew_event_rsvps TO service_role;
ALTER TABLE public.crew_event_rsvps ENABLE ROW LEVEL SECURITY;
CREATE POLICY "See rsvps if member" ON public.crew_event_rsvps FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM public.crew_events e WHERE e.id = event_id AND public.is_clan_member(e.clan_id, auth.uid()))
);
CREATE POLICY "Insert my rsvp" ON public.crew_event_rsvps FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Update my rsvp" ON public.crew_event_rsvps FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Delete my rsvp" ON public.crew_event_rsvps FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- ============== BADGES ==============
CREATE TABLE public.badges (
  key TEXT PRIMARY KEY,
  label TEXT NOT NULL,
  description TEXT NOT NULL,
  icon TEXT NOT NULL,
  tier TEXT NOT NULL DEFAULT 'bronze'
);
GRANT SELECT ON public.badges TO authenticated, anon;
GRANT ALL ON public.badges TO service_role;
ALTER TABLE public.badges ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Badges public" ON public.badges FOR SELECT USING (true);

INSERT INTO public.badges (key, label, description, icon, tier) VALUES
  ('first_squad','First Squad','Made your first squad connection','users','bronze'),
  ('verified','Verified','Verified email account','badge-check','silver'),
  ('streak_7','7-Day Streak','Logged in 7 days in a row','flame','silver'),
  ('ten_wins','10 Wins','Won 10 challenges','trophy','gold'),
  ('year_one','One Year In','Member for a year','calendar','silver'),
  ('tournament_champ','Tournament Champ','Won a Rostr Cup','crown','gold')
ON CONFLICT (key) DO NOTHING;

CREATE TABLE public.user_badges (
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  badge_key TEXT NOT NULL REFERENCES public.badges(key) ON DELETE CASCADE,
  awarded_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, badge_key)
);
CREATE INDEX user_badges_user_idx ON public.user_badges (user_id);
GRANT SELECT, INSERT ON public.user_badges TO authenticated;
GRANT ALL ON public.user_badges TO service_role;
ALTER TABLE public.user_badges ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Badges visible" ON public.user_badges FOR SELECT TO authenticated USING (true);
CREATE POLICY "Self award allowed" ON public.user_badges FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

-- ============== LFG BOOSTS ==============
CREATE TABLE public.lfg_boosts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  starts_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL,
  tokens_spent INT NOT NULL DEFAULT 0
);
CREATE INDEX lfg_boosts_expires_idx ON public.lfg_boosts (expires_at DESC);
GRANT SELECT, INSERT ON public.lfg_boosts TO authenticated;
GRANT ALL ON public.lfg_boosts TO service_role;
ALTER TABLE public.lfg_boosts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Boosts public read" ON public.lfg_boosts FOR SELECT TO authenticated USING (true);
CREATE POLICY "Self boost insert" ON public.lfg_boosts FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

-- ============== EMAIL VERIFIED SYNC ==============
CREATE OR REPLACE FUNCTION public.sync_email_verified()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  IF NEW.email_confirmed_at IS NOT NULL AND (OLD.email_confirmed_at IS NULL OR OLD.email_confirmed_at <> NEW.email_confirmed_at) THEN
    UPDATE public.profiles SET email_verified_at = NEW.email_confirmed_at WHERE id = NEW.id;
    INSERT INTO public.user_badges (user_id, badge_key) VALUES (NEW.id, 'verified') ON CONFLICT DO NOTHING;
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS sync_email_verified_trg ON auth.users;
CREATE TRIGGER sync_email_verified_trg AFTER UPDATE ON auth.users FOR EACH ROW EXECUTE FUNCTION public.sync_email_verified();

-- ============== BOOST LFG RPC ==============
CREATE OR REPLACE FUNCTION public.boost_lfg(_hours INT, _cost INT)
RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public
AS $$
DECLARE uid UUID := auth.uid(); bid UUID;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF _hours <= 0 OR _hours > 168 THEN RAISE EXCEPTION 'Invalid duration'; END IF;
  PERFORM public.spend_tokens(_cost);
  INSERT INTO public.lfg_boosts (user_id, expires_at, tokens_spent)
    VALUES (uid, now() + make_interval(hours => _hours), _cost)
    RETURNING id INTO bid;
  RETURN bid;
END $$;
