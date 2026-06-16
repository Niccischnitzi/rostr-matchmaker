
CREATE OR REPLACE FUNCTION public.media_uploads_today(_user uuid)
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COUNT(*)::int
  FROM public.media_posts
  WHERE user_id = _user
    AND created_at >= date_trunc('day', now() AT TIME ZONE 'UTC');
$$;

GRANT EXECUTE ON FUNCTION public.media_uploads_today(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.media_uploads_today(uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.media_upload_cost(_user uuid)
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT LEAST(320, 5 * (2 ^ public.media_uploads_today(_user)))::int;
$$;

GRANT EXECUTE ON FUNCTION public.media_upload_cost(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.media_upload_cost(uuid) TO service_role;

ALTER TABLE public.clubs
  ADD COLUMN IF NOT EXISTS accent text,
  ADD COLUMN IF NOT EXISTS banner_url text,
  ADD COLUMN IF NOT EXISTS tagline text;

ALTER TABLE public.clubs DROP CONSTRAINT IF EXISTS clubs_accent_format;
ALTER TABLE public.clubs
  ADD CONSTRAINT clubs_accent_format
  CHECK (accent IS NULL OR accent ~* '^#[0-9a-f]{6}$');

ALTER TABLE public.clubs DROP CONSTRAINT IF EXISTS clubs_tagline_len;
ALTER TABLE public.clubs
  ADD CONSTRAINT clubs_tagline_len
  CHECK (tagline IS NULL OR char_length(tagline) <= 120);

ALTER TABLE public.user_reports
  ADD COLUMN IF NOT EXISTS proof_url text,
  ADD COLUMN IF NOT EXISTS context jsonb;
