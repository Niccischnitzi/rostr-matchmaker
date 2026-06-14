
-- profiles: public toggle + LFG ad
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS is_public boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS lfg_title text,
  ADD COLUMN IF NOT EXISTS lfg_body text,
  ADD COLUMN IF NOT EXISTS lfg_games text[] NOT NULL DEFAULT '{}';

-- media_posts: ensure title used as subject; nothing structural needed (title already exists)
-- media_saves
CREATE TABLE IF NOT EXISTS public.media_saves (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  post_id uuid NOT NULL REFERENCES public.media_posts(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, post_id)
);
GRANT SELECT, INSERT, DELETE ON public.media_saves TO authenticated;
GRANT ALL ON public.media_saves TO service_role;
ALTER TABLE public.media_saves ENABLE ROW LEVEL SECURITY;
CREATE POLICY "saves visible to owner" ON public.media_saves
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "save own" ON public.media_saves
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "unsave own" ON public.media_saves
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- media_reposts
CREATE TABLE IF NOT EXISTS public.media_reposts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  post_id uuid NOT NULL REFERENCES public.media_posts(id) ON DELETE CASCADE,
  comment text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, post_id)
);
GRANT SELECT, INSERT, DELETE ON public.media_reposts TO authenticated;
GRANT ALL ON public.media_reposts TO service_role;
ALTER TABLE public.media_reposts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "reposts visible to all signed in" ON public.media_reposts
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "repost as self" ON public.media_reposts
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "remove own repost" ON public.media_reposts
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- friends
CREATE TABLE IF NOT EXISTS public.friends (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  requester_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  addressee_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','accepted','blocked')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (requester_id, addressee_id),
  CHECK (requester_id <> addressee_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.friends TO authenticated;
GRANT ALL ON public.friends TO service_role;
ALTER TABLE public.friends ENABLE ROW LEVEL SECURITY;
CREATE POLICY "friends visible to involved" ON public.friends
  FOR SELECT TO authenticated USING (auth.uid() = requester_id OR auth.uid() = addressee_id);
CREATE POLICY "request friends" ON public.friends
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = requester_id);
CREATE POLICY "respond to request" ON public.friends
  FOR UPDATE TO authenticated USING (auth.uid() = addressee_id OR auth.uid() = requester_id);
CREATE POLICY "remove friendship" ON public.friends
  FOR DELETE TO authenticated USING (auth.uid() = requester_id OR auth.uid() = addressee_id);

CREATE TRIGGER trg_friends_updated
  BEFORE UPDATE ON public.friends
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Allow profiles select if public OR self (extend existing)
DO $$ BEGIN
  CREATE POLICY "public profiles visible" ON public.profiles
    FOR SELECT TO authenticated USING (is_public = true OR auth.uid() = id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
