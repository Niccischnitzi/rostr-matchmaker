REVOKE SELECT ON public.club_wars FROM anon;

DROP POLICY IF EXISTS "Anyone can view club wars" ON public.club_wars;

CREATE POLICY "Authenticated users can view club wars"
  ON public.club_wars
  FOR SELECT
  TO authenticated
  USING (true);

CREATE OR REPLACE FUNCTION public.process_payment_grant(
  p_user_id uuid,
  p_stripe_session_id text,
  p_price_id text,
  p_amount_paid integer,
  p_currency text,
  p_kind text,
  p_tokens_granted integer,
  p_metadata jsonb,
  p_environment text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  inserted_count integer := 0;
  safe_tokens integer := greatest(coalesce(p_tokens_granted, 0), 0);
BEGIN
  IF p_user_id IS NULL THEN
    RAISE EXCEPTION 'Missing user id';
  END IF;
  IF p_stripe_session_id IS NULL OR length(trim(p_stripe_session_id)) = 0 THEN
    RAISE EXCEPTION 'Missing checkout session id';
  END IF;
  IF p_price_id IS NULL OR length(trim(p_price_id)) = 0 THEN
    RAISE EXCEPTION 'Missing price id';
  END IF;
  IF p_kind IS NULL OR length(trim(p_kind)) = 0 THEN
    RAISE EXCEPTION 'Missing grant kind';
  END IF;
  IF p_environment NOT IN ('sandbox', 'live') THEN
    RAISE EXCEPTION 'Invalid payment environment';
  END IF;

  INSERT INTO public.payment_grants (
    user_id,
    stripe_session_id,
    price_id,
    amount_paid,
    currency,
    kind,
    tokens_granted,
    metadata,
    environment
  ) VALUES (
    p_user_id,
    p_stripe_session_id,
    p_price_id,
    p_amount_paid,
    lower(p_currency),
    p_kind,
    safe_tokens,
    coalesce(p_metadata, '{}'::jsonb),
    p_environment
  )
  ON CONFLICT (stripe_session_id) DO NOTHING;

  GET DIAGNOSTICS inserted_count = ROW_COUNT;
  IF inserted_count = 0 THEN
    RETURN false;
  END IF;

  IF safe_tokens > 0 THEN
    INSERT INTO public.wallets (user_id, balance_points, lifetime_won)
    VALUES (p_user_id, safe_tokens, safe_tokens)
    ON CONFLICT (user_id) DO UPDATE
      SET balance_points = public.wallets.balance_points + excluded.balance_points,
          lifetime_won = public.wallets.lifetime_won + excluded.lifetime_won,
          updated_at = now();
  END IF;

  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.process_payment_grant(uuid, text, text, integer, text, text, integer, jsonb, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.process_payment_grant(uuid, text, text, integer, text, text, integer, jsonb, text) TO service_role;