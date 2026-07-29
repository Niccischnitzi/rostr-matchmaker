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
         'group_message',
         coalesce(gname, 'Group chat'),
         left(coalesce(NEW.body, 'Sent an attachment'), 140),
         NEW.group_id::text,
         '/inbox'
  FROM public.group_members m
  WHERE m.user_id <> NEW.sender_id;
  RETURN NEW;
END $$;

REVOKE ALL ON FUNCTION public.notify_group_message() FROM PUBLIC, anon, authenticated;