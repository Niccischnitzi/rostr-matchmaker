
-- 1. Grant admin role to dev account (idempotent)
DO $$
DECLARE dev_uid uuid;
BEGIN
  SELECT id INTO dev_uid FROM auth.users WHERE lower(email) = 'nicolas.amacker2010@gmail.com' LIMIT 1;
  IF dev_uid IS NOT NULL THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (dev_uid, 'admin')
    ON CONFLICT (user_id, role) DO NOTHING;
  END IF;
END $$;

-- Auto-grant admin on future sign-in for that email
CREATE OR REPLACE FUNCTION public.grant_dev_admin_on_signup()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF lower(NEW.email) = 'nicolas.amacker2010@gmail.com' THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'admin')
      ON CONFLICT (user_id, role) DO NOTHING;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS grant_dev_admin_on_signup_trg ON auth.users;
CREATE TRIGGER grant_dev_admin_on_signup_trg
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.grant_dev_admin_on_signup();

-- 2. Admin RPC: adjust any user's tokens (positive or negative)
CREATE OR REPLACE FUNCTION public.admin_adjust_tokens(_target_user uuid, _delta integer, _reason text DEFAULT 'dev_grant')
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  caller uuid := auth.uid();
  new_balance bigint;
BEGIN
  IF caller IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF NOT public.has_role(caller, 'admin') THEN
    RAISE EXCEPTION 'Only admins can adjust tokens';
  END IF;
  IF _target_user IS NULL THEN RAISE EXCEPTION 'Missing target'; END IF;

  INSERT INTO public.wallets (user_id, balance_points, lifetime_won, lifetime_lost)
    VALUES (_target_user, GREATEST(_delta, 0), GREATEST(_delta, 0), GREATEST(-_delta, 0))
  ON CONFLICT (user_id) DO UPDATE
    SET balance_points = GREATEST(0, public.wallets.balance_points + _delta),
        lifetime_won = public.wallets.lifetime_won + GREATEST(_delta, 0),
        lifetime_lost = public.wallets.lifetime_lost + GREATEST(-_delta, 0),
        updated_at = now()
  RETURNING balance_points INTO new_balance;

  INSERT INTO public.token_transactions (user_id, delta, reason, ref_id)
    VALUES (_target_user, _delta, coalesce(_reason, 'dev_grant'), caller::text);

  RETURN new_balance;
END $$;

REVOKE ALL ON FUNCTION public.admin_adjust_tokens(uuid, integer, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_adjust_tokens(uuid, integer, text) TO authenticated;

-- 3. Group chats
CREATE TABLE IF NOT EXISTS public.group_chats (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  avatar_url text,
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  last_message_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.group_chats TO authenticated;
GRANT ALL ON public.group_chats TO service_role;
ALTER TABLE public.group_chats ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.group_members (
  group_id uuid NOT NULL REFERENCES public.group_chats(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  joined_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (group_id, user_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.group_members TO authenticated;
GRANT ALL ON public.group_members TO service_role;
ALTER TABLE public.group_members ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.group_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL REFERENCES public.group_chats(id) ON DELETE CASCADE,
  sender_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  body text,
  attachment_url text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_group_messages_group_created ON public.group_messages(group_id, created_at DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.group_messages TO authenticated;
GRANT ALL ON public.group_messages TO service_role;
ALTER TABLE public.group_messages ENABLE ROW LEVEL SECURITY;

-- Helper: is_group_member (SECURITY DEFINER to avoid recursion)
CREATE OR REPLACE FUNCTION public.is_group_member(_group uuid, _user uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS(SELECT 1 FROM public.group_members WHERE group_id = _group AND user_id = _user);
$$;

-- Policies
DROP POLICY IF EXISTS "members view group" ON public.group_chats;
CREATE POLICY "members view group" ON public.group_chats FOR SELECT TO authenticated
  USING (public.is_group_member(id, auth.uid()) OR owner_id = auth.uid());
DROP POLICY IF EXISTS "owner update group" ON public.group_chats;
CREATE POLICY "owner update group" ON public.group_chats FOR UPDATE TO authenticated
  USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());
DROP POLICY IF EXISTS "auth create group" ON public.group_chats;
CREATE POLICY "auth create group" ON public.group_chats FOR INSERT TO authenticated
  WITH CHECK (owner_id = auth.uid());
DROP POLICY IF EXISTS "owner delete group" ON public.group_chats;
CREATE POLICY "owner delete group" ON public.group_chats FOR DELETE TO authenticated
  USING (owner_id = auth.uid());

DROP POLICY IF EXISTS "members view roster" ON public.group_members;
CREATE POLICY "members view roster" ON public.group_members FOR SELECT TO authenticated
  USING (public.is_group_member(group_id, auth.uid()));
DROP POLICY IF EXISTS "owner add members" ON public.group_members;
CREATE POLICY "owner add members" ON public.group_members FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.group_chats g WHERE g.id = group_id AND g.owner_id = auth.uid())
    OR user_id = auth.uid()  -- allow self-join via link (optional)
  );
DROP POLICY IF EXISTS "self leave / owner kick" ON public.group_members;
CREATE POLICY "self leave / owner kick" ON public.group_members FOR DELETE TO authenticated
  USING (user_id = auth.uid()
    OR EXISTS (SELECT 1 FROM public.group_chats g WHERE g.id = group_id AND g.owner_id = auth.uid()));

DROP POLICY IF EXISTS "members read messages" ON public.group_messages;
CREATE POLICY "members read messages" ON public.group_messages FOR SELECT TO authenticated
  USING (public.is_group_member(group_id, auth.uid()));
DROP POLICY IF EXISTS "members send messages" ON public.group_messages;
CREATE POLICY "members send messages" ON public.group_messages FOR INSERT TO authenticated
  WITH CHECK (sender_id = auth.uid() AND public.is_group_member(group_id, auth.uid()));

-- Bump last_message_at
CREATE OR REPLACE FUNCTION public.bump_group_last_message()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.group_chats SET last_message_at = NEW.created_at, updated_at = now() WHERE id = NEW.group_id;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS group_msg_bump ON public.group_messages;
CREATE TRIGGER group_msg_bump AFTER INSERT ON public.group_messages
  FOR EACH ROW EXECUTE FUNCTION public.bump_group_last_message();

-- Auto-add owner as first member
CREATE OR REPLACE FUNCTION public.add_group_owner_member()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.group_members (group_id, user_id) VALUES (NEW.id, NEW.owner_id)
    ON CONFLICT DO NOTHING;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS group_owner_join ON public.group_chats;
CREATE TRIGGER group_owner_join AFTER INSERT ON public.group_chats
  FOR EACH ROW EXECUTE FUNCTION public.add_group_owner_member();

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.group_chats;
ALTER PUBLICATION supabase_realtime ADD TABLE public.group_members;
ALTER PUBLICATION supabase_realtime ADD TABLE public.group_messages;
