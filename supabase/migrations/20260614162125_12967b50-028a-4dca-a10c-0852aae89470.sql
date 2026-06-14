
-- =========================================================================
-- ROUND 1: DMs + Clubs
-- =========================================================================

-- ---------- Enums ----------
DO $$ BEGIN
  CREATE TYPE public.club_role AS ENUM ('owner', 'officer', 'member', 'recruit');
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- ---------- Helper: updated_at trigger fn already exists as public.set_updated_at ----------

-- =========================================================================
-- CONVERSATIONS (1v1 DMs)
-- =========================================================================
CREATE TABLE public.conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_a uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  user_b uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  last_message_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT conversations_distinct_users CHECK (user_a <> user_b),
  CONSTRAINT conversations_ordered_pair CHECK (user_a < user_b),
  CONSTRAINT conversations_unique_pair UNIQUE (user_a, user_b)
);
CREATE INDEX idx_conversations_user_a ON public.conversations(user_a);
CREATE INDEX idx_conversations_user_b ON public.conversations(user_b);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.conversations TO authenticated;
GRANT ALL ON public.conversations TO service_role;
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Participants can view their conversations"
  ON public.conversations FOR SELECT TO authenticated
  USING (auth.uid() = user_a OR auth.uid() = user_b);

CREATE POLICY "Users can create conversations they are part of"
  ON public.conversations FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_a OR auth.uid() = user_b);

CREATE POLICY "Participants can update their conversations"
  ON public.conversations FOR UPDATE TO authenticated
  USING (auth.uid() = user_a OR auth.uid() = user_b)
  WITH CHECK (auth.uid() = user_a OR auth.uid() = user_b);

-- Helper: check participation without recursion
CREATE OR REPLACE FUNCTION public.is_conversation_participant(_conv uuid, _user uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.conversations
    WHERE id = _conv AND (user_a = _user OR user_b = _user)
  );
$$;

-- =========================================================================
-- DIRECT MESSAGES
-- =========================================================================
CREATE TABLE public.direct_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  sender_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  body text,
  attachment_url text,
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT direct_messages_has_content CHECK (
    (body IS NOT NULL AND length(trim(body)) > 0) OR attachment_url IS NOT NULL
  )
);
CREATE INDEX idx_direct_messages_conv ON public.direct_messages(conversation_id, created_at DESC);
CREATE INDEX idx_direct_messages_sender ON public.direct_messages(sender_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.direct_messages TO authenticated;
GRANT ALL ON public.direct_messages TO service_role;
ALTER TABLE public.direct_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Participants can read messages"
  ON public.direct_messages FOR SELECT TO authenticated
  USING (public.is_conversation_participant(conversation_id, auth.uid()));

CREATE POLICY "Participants can send messages as self"
  ON public.direct_messages FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = sender_id
    AND public.is_conversation_participant(conversation_id, auth.uid())
  );

CREATE POLICY "Sender can update own message; recipient can mark read"
  ON public.direct_messages FOR UPDATE TO authenticated
  USING (
    public.is_conversation_participant(conversation_id, auth.uid())
  )
  WITH CHECK (
    public.is_conversation_participant(conversation_id, auth.uid())
  );

CREATE POLICY "Sender can delete own message"
  ON public.direct_messages FOR DELETE TO authenticated
  USING (auth.uid() = sender_id);

CREATE TRIGGER trg_direct_messages_updated_at
  BEFORE UPDATE ON public.direct_messages
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Bump conversation.last_message_at on new message
CREATE OR REPLACE FUNCTION public.bump_conversation_last_message()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.conversations
    SET last_message_at = NEW.created_at
    WHERE id = NEW.conversation_id;
  RETURN NEW;
END $$;

CREATE TRIGGER trg_direct_messages_bump_conv
  AFTER INSERT ON public.direct_messages
  FOR EACH ROW EXECUTE FUNCTION public.bump_conversation_last_message();

-- =========================================================================
-- CLUBS
-- =========================================================================
CREATE TABLE public.clubs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  tag text,
  description text,
  banner_url text,
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  member_count int NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_clubs_owner ON public.clubs(owner_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.clubs TO authenticated;
GRANT ALL ON public.clubs TO service_role;
ALTER TABLE public.clubs ENABLE ROW LEVEL SECURITY;

-- Public discovery: any signed-in user can see club listings
CREATE POLICY "Clubs are viewable by authenticated users"
  ON public.clubs FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can create clubs"
  ON public.clubs FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "Owner can update their club"
  ON public.clubs FOR UPDATE TO authenticated
  USING (auth.uid() = owner_id) WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "Owner can delete their club"
  ON public.clubs FOR DELETE TO authenticated
  USING (auth.uid() = owner_id);

CREATE TRIGGER trg_clubs_updated_at BEFORE UPDATE ON public.clubs
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- =========================================================================
-- CLUB MEMBERS
-- =========================================================================
CREATE TABLE public.club_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id uuid NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.club_role NOT NULL DEFAULT 'member',
  joined_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (club_id, user_id)
);
CREATE INDEX idx_club_members_club ON public.club_members(club_id);
CREATE INDEX idx_club_members_user ON public.club_members(user_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.club_members TO authenticated;
GRANT ALL ON public.club_members TO service_role;
ALTER TABLE public.club_members ENABLE ROW LEVEL SECURITY;

-- Security definer helpers (avoid recursive RLS on club_members)
CREATE OR REPLACE FUNCTION public.is_club_member(_club uuid, _user uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.club_members WHERE club_id = _club AND user_id = _user);
$$;

CREATE OR REPLACE FUNCTION public.club_role_of(_club uuid, _user uuid)
RETURNS public.club_role LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT role FROM public.club_members WHERE club_id = _club AND user_id = _user;
$$;

CREATE POLICY "Members can view membership of clubs they belong to"
  ON public.club_members FOR SELECT TO authenticated
  USING (public.is_club_member(club_id, auth.uid()));

CREATE POLICY "Users can join clubs as themselves"
  ON public.club_members FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Owners and officers can update roles"
  ON public.club_members FOR UPDATE TO authenticated
  USING (public.club_role_of(club_id, auth.uid()) IN ('owner','officer'))
  WITH CHECK (public.club_role_of(club_id, auth.uid()) IN ('owner','officer'));

CREATE POLICY "User can leave; owners/officers can remove"
  ON public.club_members FOR DELETE TO authenticated
  USING (
    auth.uid() = user_id
    OR public.club_role_of(club_id, auth.uid()) IN ('owner','officer')
  );

-- Maintain member_count
CREATE OR REPLACE FUNCTION public.sync_club_member_count()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.clubs SET member_count = member_count + 1 WHERE id = NEW.club_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.clubs SET member_count = GREATEST(member_count - 1, 0) WHERE id = OLD.club_id;
  END IF;
  RETURN NULL;
END $$;

CREATE TRIGGER trg_club_member_count
  AFTER INSERT OR DELETE ON public.club_members
  FOR EACH ROW EXECUTE FUNCTION public.sync_club_member_count();

-- Auto-add owner as 'owner' member on club creation
CREATE OR REPLACE FUNCTION public.add_owner_as_member()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.club_members (club_id, user_id, role)
  VALUES (NEW.id, NEW.owner_id, 'owner')
  ON CONFLICT DO NOTHING;
  RETURN NEW;
END $$;

CREATE TRIGGER trg_clubs_add_owner
  AFTER INSERT ON public.clubs
  FOR EACH ROW EXECUTE FUNCTION public.add_owner_as_member();

-- Auto-create a default "general" channel
CREATE OR REPLACE FUNCTION public.add_default_club_channel()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.club_channels (club_id, name, description, position)
  VALUES (NEW.id, 'general', 'Default channel', 0);
  RETURN NEW;
END $$;

-- =========================================================================
-- CLUB CHANNELS
-- =========================================================================
CREATE TABLE public.club_channels (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id uuid NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  position int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_club_channels_club ON public.club_channels(club_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.club_channels TO authenticated;
GRANT ALL ON public.club_channels TO service_role;
ALTER TABLE public.club_channels ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view channels"
  ON public.club_channels FOR SELECT TO authenticated
  USING (public.is_club_member(club_id, auth.uid()));

CREATE POLICY "Owners/officers can create channels"
  ON public.club_channels FOR INSERT TO authenticated
  WITH CHECK (public.club_role_of(club_id, auth.uid()) IN ('owner','officer'));

CREATE POLICY "Owners/officers can update channels"
  ON public.club_channels FOR UPDATE TO authenticated
  USING (public.club_role_of(club_id, auth.uid()) IN ('owner','officer'))
  WITH CHECK (public.club_role_of(club_id, auth.uid()) IN ('owner','officer'));

CREATE POLICY "Owners/officers can delete channels"
  ON public.club_channels FOR DELETE TO authenticated
  USING (public.club_role_of(club_id, auth.uid()) IN ('owner','officer'));

-- Now that table exists, wire the default-channel trigger
CREATE TRIGGER trg_clubs_add_default_channel
  AFTER INSERT ON public.clubs
  FOR EACH ROW EXECUTE FUNCTION public.add_default_club_channel();

-- =========================================================================
-- CLUB MESSAGES
-- =========================================================================
CREATE TABLE public.club_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_id uuid NOT NULL REFERENCES public.club_channels(id) ON DELETE CASCADE,
  club_id uuid NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,
  sender_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  body text NOT NULL,
  attachment_url text,
  pinned boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_club_messages_channel ON public.club_messages(channel_id, created_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.club_messages TO authenticated;
GRANT ALL ON public.club_messages TO service_role;
ALTER TABLE public.club_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view club messages"
  ON public.club_messages FOR SELECT TO authenticated
  USING (public.is_club_member(club_id, auth.uid()));

CREATE POLICY "Members can post as self"
  ON public.club_messages FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = sender_id
    AND public.is_club_member(club_id, auth.uid())
  );

CREATE POLICY "Sender or officers can update messages"
  ON public.club_messages FOR UPDATE TO authenticated
  USING (
    auth.uid() = sender_id
    OR public.club_role_of(club_id, auth.uid()) IN ('owner','officer')
  )
  WITH CHECK (
    auth.uid() = sender_id
    OR public.club_role_of(club_id, auth.uid()) IN ('owner','officer')
  );

CREATE POLICY "Sender or officers can delete messages"
  ON public.club_messages FOR DELETE TO authenticated
  USING (
    auth.uid() = sender_id
    OR public.club_role_of(club_id, auth.uid()) IN ('owner','officer')
  );

CREATE TRIGGER trg_club_messages_updated_at
  BEFORE UPDATE ON public.club_messages
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- =========================================================================
-- REALTIME
-- =========================================================================
ALTER TABLE public.direct_messages REPLICA IDENTITY FULL;
ALTER TABLE public.club_messages REPLICA IDENTITY FULL;
ALTER TABLE public.conversations REPLICA IDENTITY FULL;

DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.direct_messages;
EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.club_messages;
EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.conversations;
EXCEPTION WHEN duplicate_object THEN null; END $$;
