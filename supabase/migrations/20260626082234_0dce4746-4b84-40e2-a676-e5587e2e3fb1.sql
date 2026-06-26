-- LFG ads (Looking-for-group postings)
CREATE TABLE public.lfg_ads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  host_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  game TEXT NOT NULL,
  mode TEXT,
  region TEXT,
  description TEXT,
  slots_total INT NOT NULL DEFAULT 4 CHECK (slots_total BETWEEN 1 AND 20),
  slots_filled INT NOT NULL DEFAULT 1 CHECK (slots_filled >= 0),
  mic_required BOOLEAN NOT NULL DEFAULT FALSE,
  min_rank TEXT,
  tags TEXT[] NOT NULL DEFAULT '{}',
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '4 hours'),
  closed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_lfg_ads_active ON public.lfg_ads (expires_at DESC) WHERE closed_at IS NULL;
CREATE INDEX idx_lfg_ads_host ON public.lfg_ads (host_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.lfg_ads TO authenticated;
GRANT ALL ON public.lfg_ads TO service_role;

ALTER TABLE public.lfg_ads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anyone signed-in can view active lfg ads"
  ON public.lfg_ads FOR SELECT TO authenticated
  USING (closed_at IS NULL AND expires_at > now() OR host_id = auth.uid());

CREATE POLICY "users can create own lfg ads"
  ON public.lfg_ads FOR INSERT TO authenticated
  WITH CHECK (host_id = auth.uid());

CREATE POLICY "host can update own lfg ads"
  ON public.lfg_ads FOR UPDATE TO authenticated
  USING (host_id = auth.uid()) WITH CHECK (host_id = auth.uid());

CREATE POLICY "host can delete own lfg ads"
  ON public.lfg_ads FOR DELETE TO authenticated
  USING (host_id = auth.uid());

CREATE TRIGGER lfg_ads_updated_at BEFORE UPDATE ON public.lfg_ads
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- LFG ad joiners
CREATE TABLE public.lfg_ad_joiners (
  ad_id UUID NOT NULL REFERENCES public.lfg_ads(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (ad_id, user_id)
);
CREATE INDEX idx_lfg_joiners_user ON public.lfg_ad_joiners (user_id);

GRANT SELECT, INSERT, DELETE ON public.lfg_ad_joiners TO authenticated;
GRANT ALL ON public.lfg_ad_joiners TO service_role;

ALTER TABLE public.lfg_ad_joiners ENABLE ROW LEVEL SECURITY;

CREATE POLICY "members can view joiners of ads they can see"
  ON public.lfg_ad_joiners FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.lfg_ads a WHERE a.id = ad_id
      AND (a.host_id = auth.uid() OR user_id = auth.uid()
           OR (a.closed_at IS NULL AND a.expires_at > now()))
  ));

CREATE POLICY "users can join lfg ads as themselves"
  ON public.lfg_ad_joiners FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "users can leave (delete own join)"
  ON public.lfg_ad_joiners FOR DELETE TO authenticated
  USING (user_id = auth.uid() OR EXISTS (
    SELECT 1 FROM public.lfg_ads a WHERE a.id = ad_id AND a.host_id = auth.uid()
  ));

-- Sync slots_filled on join/leave
CREATE OR REPLACE FUNCTION public.sync_lfg_slots()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.lfg_ads SET slots_filled = slots_filled + 1, updated_at = now()
      WHERE id = NEW.ad_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.lfg_ads SET slots_filled = GREATEST(slots_filled - 1, 0), updated_at = now()
      WHERE id = OLD.ad_id;
  END IF;
  RETURN NULL;
END $$;

CREATE TRIGGER lfg_joiners_sync_slots
  AFTER INSERT OR DELETE ON public.lfg_ad_joiners
  FOR EACH ROW EXECUTE FUNCTION public.sync_lfg_slots();

-- Notifications (in-app bell)
CREATE TABLE public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  kind TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT,
  link TEXT,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_notifications_user_unread ON public.notifications (user_id, created_at DESC) WHERE read_at IS NULL;
CREATE INDEX idx_notifications_user ON public.notifications (user_id, created_at DESC);

GRANT SELECT, UPDATE, DELETE ON public.notifications TO authenticated;
GRANT ALL ON public.notifications TO service_role;

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users view own notifications"
  ON public.notifications FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "users mark own notifications read"
  ON public.notifications FOR UPDATE TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE POLICY "users delete own notifications"
  ON public.notifications FOR DELETE TO authenticated
  USING (user_id = auth.uid());

-- Swipe history (so we don't re-show profiles)
CREATE TABLE public.profile_swipes (
  swiper_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  target_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  direction TEXT NOT NULL CHECK (direction IN ('skip','squad')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (swiper_id, target_id)
);
CREATE INDEX idx_swipes_swiper ON public.profile_swipes (swiper_id, created_at DESC);

GRANT SELECT, INSERT, DELETE ON public.profile_swipes TO authenticated;
GRANT ALL ON public.profile_swipes TO service_role;

ALTER TABLE public.profile_swipes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users view own swipes"
  ON public.profile_swipes FOR SELECT TO authenticated
  USING (swiper_id = auth.uid());

CREATE POLICY "users create own swipes"
  ON public.profile_swipes FOR INSERT TO authenticated
  WITH CHECK (swiper_id = auth.uid());

CREATE POLICY "users delete own swipes"
  ON public.profile_swipes FOR DELETE TO authenticated
  USING (swiper_id = auth.uid());

-- Realtime: subscribe so UIs can react live
ALTER PUBLICATION supabase_realtime ADD TABLE public.lfg_ads;
ALTER PUBLICATION supabase_realtime ADD TABLE public.lfg_ad_joiners;
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;