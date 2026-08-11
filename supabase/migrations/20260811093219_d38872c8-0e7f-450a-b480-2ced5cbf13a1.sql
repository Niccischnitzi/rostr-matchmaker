CREATE OR REPLACE FUNCTION public.notify_friend_request()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE requester_name text;
BEGIN
  IF NEW.status <> 'pending' OR NEW.addressee_id = NEW.requester_id THEN
    RETURN NEW;
  END IF;
  SELECT coalesce(p.display_name, p.username) INTO requester_name
  FROM public.profiles p WHERE p.id = NEW.requester_id;
  INSERT INTO public.notifications (user_id, kind, title, body, ref_id, link)
  VALUES (NEW.addressee_id, 'friend_request',
          coalesce(requester_name, 'New request') || ' wants on your rostr',
          'Tap to accept or decline.', NEW.id::text, '/inbox')
  ON CONFLICT DO NOTHING;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_notify_friend_request ON public.friends;
CREATE TRIGGER trg_notify_friend_request
AFTER INSERT ON public.friends
FOR EACH ROW EXECUTE FUNCTION public.notify_friend_request();

CREATE OR REPLACE FUNCTION public.notify_lfg_join()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE host uuid; joiner_name text; ad_game text;
BEGIN
  SELECT a.host_id, a.game INTO host, ad_game FROM public.lfg_ads a WHERE a.id = NEW.ad_id;
  IF host IS NULL OR host = NEW.user_id THEN
    RETURN NEW;
  END IF;
  SELECT coalesce(p.display_name, p.username) INTO joiner_name
  FROM public.profiles p WHERE p.id = NEW.user_id;
  INSERT INTO public.notifications (user_id, kind, title, body, ref_id, link)
  VALUES (host, 'lfg_join',
          coalesce(joiner_name, 'A player') || ' joined your LFG',
          coalesce(ad_game, 'Squad up') , NEW.ad_id::text, '/inbox')
  ON CONFLICT DO NOTHING;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_notify_lfg_join ON public.lfg_ad_joiners;
CREATE TRIGGER trg_notify_lfg_join
AFTER INSERT ON public.lfg_ad_joiners
FOR EACH ROW EXECUTE FUNCTION public.notify_lfg_join();

REVOKE EXECUTE ON FUNCTION public.notify_friend_request() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.notify_lfg_join() FROM anon, authenticated;