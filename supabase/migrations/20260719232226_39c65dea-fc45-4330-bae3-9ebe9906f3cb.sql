
CREATE OR REPLACE FUNCTION public.create_media_post(
  _kind text,
  _media_path text DEFAULT NULL,
  _source_url text DEFAULT NULL,
  _title text DEFAULT NULL,
  _body text DEFAULT NULL,
  _game text DEFAULT NULL,
  _duration_s integer DEFAULT NULL,
  _size_bytes bigint DEFAULT NULL
) RETURNS public.media_posts
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
  row_out public.media_posts%ROWTYPE;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF _kind NOT IN ('video','text','tweet') THEN RAISE EXCEPTION 'Invalid media kind'; END IF;

  IF _kind = 'video' AND nullif(trim(coalesce(_media_path, '')), '') IS NULL THEN
    RAISE EXCEPTION 'Missing media file';
  END IF;
  IF _kind = 'tweet' AND nullif(trim(coalesce(_source_url, '')), '') IS NULL THEN
    RAISE EXCEPTION 'Missing tweet URL';
  END IF;
  IF _kind = 'text' AND nullif(trim(coalesce(_body, '')), '') IS NULL THEN
    RAISE EXCEPTION 'Missing text';
  END IF;

  IF NOT public.check_rate_limit('create_media_post', 30, 300) THEN
    RAISE EXCEPTION 'Slow down — too many posts.' USING ERRCODE = 'check_violation';
  END IF;

  INSERT INTO public.media_posts (
    user_id, kind, media_path, source_url, title, body, game, duration_s, size_bytes
  ) VALUES (
    uid, _kind,
    nullif(trim(coalesce(_media_path, '')), ''),
    nullif(trim(coalesce(_source_url, '')), ''),
    nullif(left(coalesce(_title, ''), 200), ''),
    nullif(left(coalesce(_body, ''), 2000), ''),
    nullif(trim(coalesce(_game, '')), ''),
    _duration_s,
    _size_bytes
  )
  RETURNING * INTO row_out;

  RETURN row_out;
END $$;

REVOKE ALL ON FUNCTION public.create_media_post(text, text, text, text, text, text, integer, bigint) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_media_post(text, text, text, text, text, text, integer, bigint) TO authenticated;
