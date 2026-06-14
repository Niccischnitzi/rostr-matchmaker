
-- media_posts
CREATE TABLE public.media_posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('video','text','tweet')),
  title text,
  body text,
  media_path text,
  source_url text,
  game text,
  duration_s integer,
  size_bytes bigint,
  tokens_spent integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX media_posts_created_idx ON public.media_posts(created_at DESC);
CREATE INDEX media_posts_user_idx ON public.media_posts(user_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.media_posts TO authenticated;
GRANT ALL ON public.media_posts TO service_role;

ALTER TABLE public.media_posts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated view media"
  ON public.media_posts FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users insert own media"
  ON public.media_posts FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own media"
  ON public.media_posts FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users delete own media"
  ON public.media_posts FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- media_likes
CREATE TABLE public.media_likes (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  post_id uuid NOT NULL REFERENCES public.media_posts(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, post_id)
);
CREATE INDEX media_likes_post_idx ON public.media_likes(post_id);

GRANT SELECT, INSERT, DELETE ON public.media_likes TO authenticated;
GRANT ALL ON public.media_likes TO service_role;

ALTER TABLE public.media_likes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated view likes"
  ON public.media_likes FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users like as self"
  ON public.media_likes FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users unlike own"
  ON public.media_likes FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- spend_tokens RPC (atomic decrement on wallets)
CREATE OR REPLACE FUNCTION public.spend_tokens(_amount integer)
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
  new_balance bigint;
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  IF _amount < 0 THEN
    RAISE EXCEPTION 'Amount must be non-negative';
  END IF;
  UPDATE public.wallets
    SET balance_points = balance_points - _amount,
        lifetime_lost = lifetime_lost + _amount
    WHERE user_id = uid AND balance_points >= _amount
    RETURNING balance_points INTO new_balance;
  IF new_balance IS NULL THEN
    RAISE EXCEPTION 'Insufficient tokens';
  END IF;
  RETURN new_balance;
END $$;

REVOKE EXECUTE ON FUNCTION public.spend_tokens(integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.spend_tokens(integer) TO authenticated;

-- storage policies for media-clips bucket
CREATE POLICY "media-clips authenticated read"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'media-clips');

CREATE POLICY "media-clips owner upload"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'media-clips' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "media-clips owner update"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'media-clips' AND auth.uid() = owner);

CREATE POLICY "media-clips owner delete"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'media-clips' AND auth.uid() = owner);
