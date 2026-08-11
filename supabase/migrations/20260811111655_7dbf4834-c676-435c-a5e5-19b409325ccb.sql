-- One external account per platform can only belong to one rostr profile
CREATE UNIQUE INDEX IF NOT EXISTS linked_accounts_platform_external_uid_key
  ON public.linked_accounts (platform, external_uid)
  WHERE external_uid IS NOT NULL;

-- Public, read-only view of a player's gaming passport (public profiles only)
CREATE OR REPLACE FUNCTION public.public_linked_accounts(_user_id uuid)
RETURNS TABLE (
  platform text,
  gamertag text,
  external_uid text,
  verified boolean,
  current_rank_display text,
  aggregated_stats jsonb
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT la.platform, la.gamertag, la.external_uid, la.verified,
         la.current_rank_display, la.aggregated_stats
  FROM public.linked_accounts la
  JOIN public.profiles p ON p.id = la.user_id
  WHERE la.user_id = _user_id
    AND p.is_public = true
  ORDER BY la.platform
$$;

REVOKE ALL ON FUNCTION public.public_linked_accounts(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.public_linked_accounts(uuid) TO anon, authenticated;