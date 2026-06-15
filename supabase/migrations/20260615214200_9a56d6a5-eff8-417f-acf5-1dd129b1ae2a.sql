CREATE TABLE public.media_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid NOT NULL REFERENCES public.media_posts(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  body text NOT NULL CHECK (char_length(trim(body)) BETWEEN 1 AND 280),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX media_comments_post_created_idx ON public.media_comments(post_id, created_at ASC);
CREATE INDEX media_comments_user_idx ON public.media_comments(user_id);

GRANT SELECT, INSERT, DELETE ON public.media_comments TO authenticated;
GRANT ALL ON public.media_comments TO service_role;

ALTER TABLE public.media_comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated view media comments"
  ON public.media_comments
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.media_posts p
      WHERE p.id = media_comments.post_id
    )
  );

CREATE POLICY "Users create own media comments"
  ON public.media_comments
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users delete own media comments"
  ON public.media_comments
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);