GRANT SELECT, INSERT, UPDATE, DELETE ON public.match_ratings TO authenticated;
GRANT ALL ON public.match_ratings TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.voice_snippets TO authenticated;
GRANT ALL ON public.voice_snippets TO service_role;

ALTER TABLE public.match_ratings
  ADD COLUMN IF NOT EXISTS chemistry smallint NOT NULL DEFAULT 5 CHECK (chemistry BETWEEN 1 AND 5),
  ADD COLUMN IF NOT EXISTS comms smallint NOT NULL DEFAULT 5 CHECK (comms BETWEEN 1 AND 5),
  ADD COLUMN IF NOT EXISTS reliability smallint NOT NULL DEFAULT 5 CHECK (reliability BETWEEN 1 AND 5),
  ADD COLUMN IF NOT EXISTS tags text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS note text NULL,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

ALTER TABLE public.voice_snippets
  ADD COLUMN IF NOT EXISTS transcript text NULL,
  ADD COLUMN IF NOT EXISTS is_public boolean NOT NULL DEFAULT true;

ALTER TABLE public.match_ratings DROP CONSTRAINT IF EXISTS match_ratings_tag_check;

DROP TRIGGER IF EXISTS set_match_ratings_updated_at ON public.match_ratings;
CREATE TRIGGER set_match_ratings_updated_at
BEFORE UPDATE ON public.match_ratings
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS set_voice_snippets_updated_at ON public.voice_snippets;
CREATE TRIGGER set_voice_snippets_updated_at
BEFORE UPDATE ON public.voice_snippets
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX IF NOT EXISTS match_ratings_rated_idx ON public.match_ratings(rated_id, created_at DESC);
CREATE INDEX IF NOT EXISTS match_ratings_rater_idx ON public.match_ratings(rater_id, created_at DESC);

DROP POLICY IF EXISTS "Public profiles voice snippets readable" ON public.voice_snippets;
CREATE POLICY "Public profiles voice snippets readable"
ON public.voice_snippets
FOR SELECT
TO authenticated
USING (
  is_public = true
  AND EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = voice_snippets.user_id
      AND coalesce(p.is_public, true) = true
  )
);

DROP POLICY IF EXISTS "Users can upload their own voice snippets" ON storage.objects;
CREATE POLICY "Users can upload their own voice snippets"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'media-clips'
  AND (storage.foldername(name))[1] = auth.uid()::text
  AND (storage.foldername(name))[2] = 'voice-snippets'
);

DROP POLICY IF EXISTS "Users can read their own voice snippets" ON storage.objects;
CREATE POLICY "Users can read their own voice snippets"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'media-clips'
  AND (storage.foldername(name))[1] = auth.uid()::text
  AND (storage.foldername(name))[2] = 'voice-snippets'
);

DROP POLICY IF EXISTS "Users can update their own voice snippets" ON storage.objects;
CREATE POLICY "Users can update their own voice snippets"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'media-clips'
  AND (storage.foldername(name))[1] = auth.uid()::text
  AND (storage.foldername(name))[2] = 'voice-snippets'
)
WITH CHECK (
  bucket_id = 'media-clips'
  AND (storage.foldername(name))[1] = auth.uid()::text
  AND (storage.foldername(name))[2] = 'voice-snippets'
);

DROP POLICY IF EXISTS "Users can delete their own voice snippets" ON storage.objects;
CREATE POLICY "Users can delete their own voice snippets"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'media-clips'
  AND (storage.foldername(name))[1] = auth.uid()::text
  AND (storage.foldername(name))[2] = 'voice-snippets'
);

CREATE OR REPLACE FUNCTION public.submit_match_rating(
  _target_user uuid,
  _challenge_id uuid DEFAULT NULL,
  _chemistry smallint DEFAULT 5,
  _comms smallint DEFAULT 5,
  _reliability smallint DEFAULT 5,
  _tags text[] DEFAULT '{}',
  _note text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  uid uuid := auth.uid();
  clean_tags text[];
  first_tag text;
  rating_id uuid;
  thumb public.match_rating_thumb;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF _target_user IS NULL OR _target_user = uid THEN RAISE EXCEPTION 'Invalid teammate'; END IF;
  IF _challenge_id IS NULL THEN RAISE EXCEPTION 'Match context required'; END IF;
  IF _chemistry NOT BETWEEN 1 AND 5 OR _comms NOT BETWEEN 1 AND 5 OR _reliability NOT BETWEEN 1 AND 5 THEN
    RAISE EXCEPTION 'Ratings must be between 1 and 5';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.challenges c
    WHERE c.id = _challenge_id
      AND c.status = 'settled'
      AND uid IN (c.challenger_id, c.opponent_id)
      AND _target_user IN (c.challenger_id, c.opponent_id)
  ) THEN
    RAISE EXCEPTION 'Rate after a settled match only';
  END IF;
  IF NOT public.check_rate_limit('submit_match_rating', 20, 60) THEN
    RAISE EXCEPTION 'Slow down — too many ratings.' USING ERRCODE = 'check_violation';
  END IF;

  SELECT coalesce(array_agg(left(trim(t), 28)), '{}') INTO clean_tags
  FROM (
    SELECT DISTINCT t
    FROM unnest(coalesce(_tags, '{}')) AS t
    WHERE length(trim(t)) > 0
    LIMIT 6
  ) s;
  first_tag := clean_tags[1];
  thumb := CASE WHEN (_chemistry + _comms + _reliability) >= 9 THEN 'up'::public.match_rating_thumb ELSE 'down'::public.match_rating_thumb END;

  INSERT INTO public.match_ratings (rater_id, rated_id, challenge_id, thumbs, tag, chemistry, comms, reliability, tags, note)
  VALUES (uid, _target_user, _challenge_id, thumb, first_tag, _chemistry, _comms, _reliability, coalesce(clean_tags, '{}'), nullif(left(coalesce(_note, ''), 240), ''))
  ON CONFLICT (rater_id, rated_id, challenge_id) DO UPDATE
    SET thumbs = EXCLUDED.thumbs,
        tag = EXCLUDED.tag,
        chemistry = EXCLUDED.chemistry,
        comms = EXCLUDED.comms,
        reliability = EXCLUDED.reliability,
        tags = EXCLUDED.tags,
        note = EXCLUDED.note,
        updated_at = now()
  RETURNING id INTO rating_id;

  RETURN jsonb_build_object('ok', true, 'rating_id', rating_id);
END
$function$;

DROP FUNCTION IF EXISTS public.profile_rating_summary(uuid);
CREATE FUNCTION public.profile_rating_summary(_user_id uuid)
RETURNS TABLE(avg_score numeric, rating_count integer, top_tags text[])
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  WITH base AS (
    SELECT ((chemistry + comms + reliability)::numeric / 3) AS score,
           coalesce(nullif(tags, '{}'), CASE WHEN tag IS NULL THEN '{}'::text[] ELSE ARRAY[tag] END) AS rating_tags
    FROM public.match_ratings
    WHERE rated_id = _user_id
  ), tag_counts AS (
    SELECT rating_tag, count(*) AS n
    FROM base, unnest(rating_tags) rating_tag
    GROUP BY rating_tag
    ORDER BY n DESC, rating_tag ASC
    LIMIT 5
  )
  SELECT
    coalesce(round(avg(score), 1), 0)::numeric AS avg_score,
    count(*)::int AS rating_count,
    coalesce((SELECT array_agg(rating_tag) FROM tag_counts), '{}')::text[] AS top_tags
  FROM base;
$function$;

DROP FUNCTION IF EXISTS public.pair_chemistry(uuid);
CREATE FUNCTION public.pair_chemistry(_other_user uuid)
RETURNS TABLE(score integer, sessions integer, label text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  WITH pair AS (
    SELECT ((chemistry + comms + reliability)::numeric / 3) AS score
    FROM public.match_ratings
    WHERE (rater_id = auth.uid() AND rated_id = _other_user)
       OR (rater_id = _other_user AND rated_id = auth.uid())
  ), agg AS (
    SELECT coalesce(round(avg(score) * 20), 0)::int AS pct, count(*)::int AS n
    FROM pair
  )
  SELECT pct, n,
    CASE
      WHEN n = 0 THEN 'New duo'
      WHEN pct >= 90 THEN 'S-tier duo'
      WHEN pct >= 75 THEN 'Great fit'
      WHEN pct >= 55 THEN 'Promising'
      ELSE 'Needs warm-up'
    END
  FROM agg;
$function$;

REVOKE ALL ON FUNCTION public.submit_match_rating(uuid, uuid, smallint, smallint, smallint, text[], text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.submit_match_rating(uuid, uuid, smallint, smallint, smallint, text[], text) TO authenticated;
REVOKE ALL ON FUNCTION public.profile_rating_summary(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.profile_rating_summary(uuid) TO authenticated;
REVOKE ALL ON FUNCTION public.pair_chemistry(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.pair_chemistry(uuid) TO authenticated;