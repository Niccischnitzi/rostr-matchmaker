-- 1) Live updates for friend requests + reliable payloads for existing live tables
ALTER TABLE public.friends REPLICA IDENTITY FULL;
ALTER TABLE public.direct_messages REPLICA IDENTITY FULL;
ALTER TABLE public.group_messages REPLICA IDENTITY FULL;
ALTER TABLE public.notifications REPLICA IDENTITY FULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'friends'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.friends;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'clan_invites'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.clan_invites;
  END IF;
END $$;

-- 2) Notify the recipient of a new direct message
CREATE OR REPLACE FUNCTION public.notify_direct_message()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  recipient uuid;
  sender_name text;
BEGIN
  SELECT CASE WHEN c.user_a = NEW.sender_id THEN c.user_b ELSE c.user_a END
    INTO recipient
  FROM public.conversations c
  WHERE c.id = NEW.conversation_id;

  IF recipient IS NULL OR recipient = NEW.sender_id THEN
    RETURN NEW;
  END IF;

  SELECT coalesce(p.display_name, p.username) INTO sender_name
  FROM public.profiles p WHERE p.id = NEW.sender_id;

  INSERT INTO public.notifications (user_id, kind, title, body, ref_id, link)
  VALUES (
    recipient,
    'dm',
    coalesce(sender_name, 'New message'),
    left(coalesce(NEW.body, 'Sent an attachment'), 140),
    NEW.conversation_id::text,
    '/inbox'
  );
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_notify_direct_message ON public.direct_messages;
CREATE TRIGGER trg_notify_direct_message
AFTER INSERT ON public.direct_messages
FOR EACH ROW EXECUTE FUNCTION public.notify_direct_message();

-- 3) Notify group members of a new group message
CREATE OR REPLACE FUNCTION public.notify_group_message()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  gname text;
BEGIN
  SELECT g.name INTO gname FROM public.group_chats g WHERE g.id = NEW.group_id;

  INSERT INTO public.notifications (user_id, kind, title, body, ref_id, link)
  SELECT m.user_id,
         coalesce(gname, 'Group chat'),
         left(coalesce(NEW.body, 'Sent an attachment'), 140),
         NEW.group_id::text,
         '/inbox'
  FROM public.group_members m
  WHERE m.user_id <> NEW.sender_id;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_notify_group_message ON public.group_messages;
CREATE TRIGGER trg_notify_group_message
AFTER INSERT ON public.group_messages
FOR EACH ROW EXECUTE FUNCTION public.notify_group_message();

-- Keep these triggers internal only
REVOKE ALL ON FUNCTION public.notify_direct_message() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.notify_group_message() FROM PUBLIC, anon, authenticated;