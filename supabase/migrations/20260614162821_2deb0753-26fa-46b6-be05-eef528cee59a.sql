
-- ============ ENUMS ============
CREATE TYPE public.clan_role AS ENUM ('leader','officer','member');
CREATE TYPE public.challenge_status AS ENUM ('pending','accepted','live','disputed','settled','cancelled');
CREATE TYPE public.escrow_status AS ENUM ('held','released','refunded');
CREATE TYPE public.tournament_status AS ENUM ('draft','open','live','completed','cancelled');

-- ============ WALLETS ============
CREATE TABLE public.wallets (
  user_id UUID PRIMARY KEY REFERENCES auth.users ON DELETE CASCADE,
  balance_points BIGINT NOT NULL DEFAULT 1000 CHECK (balance_points >= 0),
  lifetime_won BIGINT NOT NULL DEFAULT 0,
  lifetime_lost BIGINT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.wallets TO authenticated;
GRANT ALL ON public.wallets TO service_role;
ALTER TABLE public.wallets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "wallet owner reads" ON public.wallets FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE TRIGGER wallets_updated BEFORE UPDATE ON public.wallets FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- backfill existing users
INSERT INTO public.wallets (user_id)
SELECT id FROM auth.users ON CONFLICT DO NOTHING;

-- update handle_new_user to seed wallet
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  base_username TEXT;
  final_username TEXT;
  suffix INT := 0;
BEGIN
  base_username := lower(regexp_replace(
    coalesce(NEW.raw_user_meta_data->>'username', split_part(NEW.email, '@', 1), 'player'),
    '[^a-z0-9_]', '', 'gi'));
  IF base_username = '' OR base_username IS NULL THEN base_username := 'player'; END IF;
  final_username := base_username;
  WHILE EXISTS (SELECT 1 FROM public.profiles WHERE username = final_username) LOOP
    suffix := suffix + 1;
    final_username := base_username || suffix::text;
  END LOOP;
  INSERT INTO public.profiles (id, username, display_name, avatar_url)
  VALUES (NEW.id, final_username,
    coalesce(NEW.raw_user_meta_data->>'display_name', NEW.raw_user_meta_data->>'full_name', final_username),
    NEW.raw_user_meta_data->>'avatar_url');
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'user');
  INSERT INTO public.wallets (user_id) VALUES (NEW.id);
  RETURN NEW;
END $$;

-- ============ CLANS ============
CREATE TABLE public.clans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tag TEXT NOT NULL UNIQUE CHECK (length(tag) BETWEEN 2 AND 6),
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  banner_url TEXT,
  owner_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  elo INT NOT NULL DEFAULT 1000,
  member_count INT NOT NULL DEFAULT 0,
  max_members INT NOT NULL DEFAULT 50,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.clans TO authenticated;
GRANT ALL ON public.clans TO service_role;
ALTER TABLE public.clans ENABLE ROW LEVEL SECURITY;
CREATE POLICY "clans public read" ON public.clans FOR SELECT TO authenticated USING (true);
CREATE POLICY "clans create" ON public.clans FOR INSERT TO authenticated WITH CHECK (auth.uid() = owner_id);
CREATE POLICY "clans owner update" ON public.clans FOR UPDATE TO authenticated USING (auth.uid() = owner_id);
CREATE POLICY "clans owner delete" ON public.clans FOR DELETE TO authenticated USING (auth.uid() = owner_id);
CREATE TRIGGER clans_updated BEFORE UPDATE ON public.clans FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.clan_members (
  clan_id UUID NOT NULL REFERENCES public.clans ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  role public.clan_role NOT NULL DEFAULT 'member',
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (clan_id, user_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.clan_members TO authenticated;
GRANT ALL ON public.clan_members TO service_role;
ALTER TABLE public.clan_members ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.is_clan_member(_clan uuid, _user uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT EXISTS(SELECT 1 FROM public.clan_members WHERE clan_id=_clan AND user_id=_user);
$$;
CREATE OR REPLACE FUNCTION public.clan_role_of(_clan uuid, _user uuid)
RETURNS public.clan_role LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT role FROM public.clan_members WHERE clan_id=_clan AND user_id=_user;
$$;

CREATE POLICY "clan members read" ON public.clan_members FOR SELECT TO authenticated USING (true);
CREATE POLICY "clan members self leave" ON public.clan_members FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "clan leader manage" ON public.clan_members FOR ALL TO authenticated
  USING (public.clan_role_of(clan_id, auth.uid()) IN ('leader','officer'))
  WITH CHECK (public.clan_role_of(clan_id, auth.uid()) IN ('leader','officer'));

CREATE OR REPLACE FUNCTION public.add_clan_owner_member() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  INSERT INTO public.clan_members (clan_id, user_id, role) VALUES (NEW.id, NEW.owner_id, 'leader') ON CONFLICT DO NOTHING;
  RETURN NEW;
END $$;
CREATE TRIGGER clan_owner_member AFTER INSERT ON public.clans FOR EACH ROW EXECUTE FUNCTION public.add_clan_owner_member();

CREATE OR REPLACE FUNCTION public.sync_clan_member_count() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  IF TG_OP='INSERT' THEN UPDATE public.clans SET member_count=member_count+1 WHERE id=NEW.clan_id;
  ELSIF TG_OP='DELETE' THEN UPDATE public.clans SET member_count=GREATEST(member_count-1,0) WHERE id=OLD.clan_id; END IF;
  RETURN NULL;
END $$;
CREATE TRIGGER clan_member_count AFTER INSERT OR DELETE ON public.clan_members FOR EACH ROW EXECUTE FUNCTION public.sync_clan_member_count();

CREATE TABLE public.clan_invites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clan_id UUID NOT NULL REFERENCES public.clans ON DELETE CASCADE,
  invitee_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  inviter_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (clan_id, invitee_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.clan_invites TO authenticated;
GRANT ALL ON public.clan_invites TO service_role;
ALTER TABLE public.clan_invites ENABLE ROW LEVEL SECURITY;
CREATE POLICY "invites read involved" ON public.clan_invites FOR SELECT TO authenticated USING (auth.uid() IN (invitee_id, inviter_id) OR public.is_clan_member(clan_id, auth.uid()));
CREATE POLICY "invites create by officer" ON public.clan_invites FOR INSERT TO authenticated WITH CHECK (public.clan_role_of(clan_id, auth.uid()) IN ('leader','officer') AND auth.uid() = inviter_id);
CREATE POLICY "invites update by invitee" ON public.clan_invites FOR UPDATE TO authenticated USING (auth.uid() = invitee_id);

-- ============ CHALLENGES ============
CREATE TABLE public.challenges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  challenger_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  opponent_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  game TEXT NOT NULL,
  format TEXT,
  wager_points BIGINT NOT NULL DEFAULT 0 CHECK (wager_points >= 0),
  rake_pct NUMERIC(5,2) NOT NULL DEFAULT 5.0,
  status public.challenge_status NOT NULL DEFAULT 'pending',
  winner_id UUID REFERENCES auth.users,
  notes TEXT,
  scheduled_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (challenger_id <> opponent_id)
);
GRANT SELECT, INSERT, UPDATE ON public.challenges TO authenticated;
GRANT ALL ON public.challenges TO service_role;
ALTER TABLE public.challenges ENABLE ROW LEVEL SECURITY;
CREATE POLICY "challenges involved read" ON public.challenges FOR SELECT TO authenticated USING (auth.uid() IN (challenger_id, opponent_id));
CREATE POLICY "challenges create" ON public.challenges FOR INSERT TO authenticated WITH CHECK (auth.uid() = challenger_id);
CREATE POLICY "challenges update involved" ON public.challenges FOR UPDATE TO authenticated USING (auth.uid() IN (challenger_id, opponent_id));
CREATE TRIGGER challenges_updated BEFORE UPDATE ON public.challenges FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.escrow_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  challenge_id UUID REFERENCES public.challenges ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  amount BIGINT NOT NULL CHECK (amount >= 0),
  status public.escrow_status NOT NULL DEFAULT 'held',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  settled_at TIMESTAMPTZ
);
GRANT SELECT ON public.escrow_transactions TO authenticated;
GRANT ALL ON public.escrow_transactions TO service_role;
ALTER TABLE public.escrow_transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "escrow self read" ON public.escrow_transactions FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- escrow trigger: on accept hold funds; on settle release
CREATE OR REPLACE FUNCTION public.handle_challenge_status() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE
  pot BIGINT;
  rake BIGINT;
  payout BIGINT;
  loser UUID;
BEGIN
  IF NEW.status = 'accepted' AND OLD.status = 'pending' AND NEW.wager_points > 0 THEN
    -- debit both
    UPDATE public.wallets SET balance_points = balance_points - NEW.wager_points WHERE user_id = NEW.challenger_id;
    UPDATE public.wallets SET balance_points = balance_points - NEW.wager_points WHERE user_id = NEW.opponent_id;
    INSERT INTO public.escrow_transactions (challenge_id, user_id, amount) VALUES (NEW.id, NEW.challenger_id, NEW.wager_points);
    INSERT INTO public.escrow_transactions (challenge_id, user_id, amount) VALUES (NEW.id, NEW.opponent_id, NEW.wager_points);
  ELSIF NEW.status = 'settled' AND OLD.status <> 'settled' AND NEW.winner_id IS NOT NULL THEN
    pot := NEW.wager_points * 2;
    rake := floor(pot * NEW.rake_pct / 100.0);
    payout := pot - rake;
    loser := CASE WHEN NEW.winner_id = NEW.challenger_id THEN NEW.opponent_id ELSE NEW.challenger_id END;
    UPDATE public.wallets SET balance_points = balance_points + payout,
      lifetime_won = lifetime_won + (payout - NEW.wager_points)
      WHERE user_id = NEW.winner_id;
    UPDATE public.wallets SET lifetime_lost = lifetime_lost + NEW.wager_points WHERE user_id = loser;
    UPDATE public.escrow_transactions SET status='released', settled_at=now() WHERE challenge_id = NEW.id;
  ELSIF NEW.status = 'cancelled' AND OLD.status = 'accepted' THEN
    UPDATE public.wallets SET balance_points = balance_points + NEW.wager_points WHERE user_id = NEW.challenger_id;
    UPDATE public.wallets SET balance_points = balance_points + NEW.wager_points WHERE user_id = NEW.opponent_id;
    UPDATE public.escrow_transactions SET status='refunded', settled_at=now() WHERE challenge_id = NEW.id;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER challenge_status_trg AFTER UPDATE ON public.challenges FOR EACH ROW EXECUTE FUNCTION public.handle_challenge_status();

-- ============ TOURNAMENTS ============
CREATE TABLE public.tournaments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  game TEXT NOT NULL,
  format TEXT,
  description TEXT,
  banner_url TEXT,
  entry_fee BIGINT NOT NULL DEFAULT 0 CHECK (entry_fee >= 0),
  rake_pct NUMERIC(5,2) NOT NULL DEFAULT 10.0,
  max_entries INT,
  starts_at TIMESTAMPTZ,
  ends_at TIMESTAMPTZ,
  status public.tournament_status NOT NULL DEFAULT 'open',
  created_by UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tournaments TO authenticated;
GRANT ALL ON public.tournaments TO service_role;
ALTER TABLE public.tournaments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tourneys read" ON public.tournaments FOR SELECT TO authenticated USING (true);
CREATE POLICY "tourneys create" ON public.tournaments FOR INSERT TO authenticated WITH CHECK (auth.uid() = created_by);
CREATE POLICY "tourneys owner update" ON public.tournaments FOR UPDATE TO authenticated USING (auth.uid() = created_by);
CREATE TRIGGER tournaments_updated BEFORE UPDATE ON public.tournaments FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.tournament_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_id UUID NOT NULL REFERENCES public.tournaments ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tournament_id, user_id)
);
GRANT SELECT, INSERT, DELETE ON public.tournament_entries TO authenticated;
GRANT ALL ON public.tournament_entries TO service_role;
ALTER TABLE public.tournament_entries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "entries read" ON public.tournament_entries FOR SELECT TO authenticated USING (true);
CREATE POLICY "entries self join" ON public.tournament_entries FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "entries self leave" ON public.tournament_entries FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE TABLE public.leaderboard_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_id UUID NOT NULL REFERENCES public.tournaments ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  metric TEXT NOT NULL,
  value NUMERIC NOT NULL DEFAULT 0,
  audit_flags JSONB NOT NULL DEFAULT '[]'::jsonb,
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX leaderboard_tournament_value ON public.leaderboard_entries (tournament_id, value DESC);
GRANT SELECT ON public.leaderboard_entries TO authenticated;
GRANT ALL ON public.leaderboard_entries TO service_role;
ALTER TABLE public.leaderboard_entries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "lb read" ON public.leaderboard_entries FOR SELECT TO authenticated USING (true);

-- payout view
CREATE OR REPLACE VIEW public.tournament_payout AS
SELECT t.id AS tournament_id,
       t.entry_fee,
       t.rake_pct,
       count(e.id) AS entries,
       (t.entry_fee * count(e.id))::numeric AS gross,
       (t.entry_fee * count(e.id) * (1 - t.rake_pct/100.0))::numeric AS net_payout
FROM public.tournaments t
LEFT JOIN public.tournament_entries e ON e.tournament_id = t.id
GROUP BY t.id;
GRANT SELECT ON public.tournament_payout TO authenticated;

-- ============ WEBHOOK EVENTS ============
CREATE TABLE public.webhook_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider TEXT NOT NULL,
  event_type TEXT,
  payload JSONB NOT NULL,
  signature TEXT,
  processed BOOLEAN NOT NULL DEFAULT false,
  error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT ALL ON public.webhook_events TO service_role;
ALTER TABLE public.webhook_events ENABLE ROW LEVEL SECURITY;
-- no policies = no client access; service_role only

CREATE TABLE public.account_verification_checks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  provider TEXT NOT NULL,
  lifetime_hours NUMERIC,
  audit_flags JSONB NOT NULL DEFAULT '[]'::jsonb,
  checked_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.account_verification_checks TO authenticated;
GRANT ALL ON public.account_verification_checks TO service_role;
ALTER TABLE public.account_verification_checks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "verif self read" ON public.account_verification_checks FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- enable realtime
ALTER TABLE public.challenges REPLICA IDENTITY FULL;
ALTER TABLE public.leaderboard_entries REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.challenges;
ALTER PUBLICATION supabase_realtime ADD TABLE public.leaderboard_entries;
