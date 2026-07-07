DROP POLICY IF EXISTS "public profiles visible" ON public.profiles;

CREATE POLICY "Authenticated can view profiles"
  ON public.profiles
  FOR SELECT
  TO authenticated
  USING (true);

CREATE TABLE IF NOT EXISTS public.cosmetic_unlocks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  cosmetic_key text NOT NULL,
  cost_paid integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, cosmetic_key)
);

GRANT SELECT, INSERT ON public.cosmetic_unlocks TO authenticated;
GRANT ALL ON public.cosmetic_unlocks TO service_role;

ALTER TABLE public.cosmetic_unlocks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own unlocks"
  ON public.cosmetic_unlocks FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own unlocks"
  ON public.cosmetic_unlocks FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.unlock_cosmetic(_key text, _cost integer)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
  already boolean;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF _cost < 0 THEN RAISE EXCEPTION 'Invalid cost'; END IF;
  IF _key IS NULL OR length(trim(_key)) = 0 THEN RAISE EXCEPTION 'Invalid key'; END IF;

  SELECT EXISTS(SELECT 1 FROM public.cosmetic_unlocks WHERE user_id = uid AND cosmetic_key = _key) INTO already;
  IF already THEN RETURN true; END IF;

  IF _cost > 0 THEN
    UPDATE public.wallets
      SET balance_points = balance_points - _cost,
          lifetime_lost = lifetime_lost + _cost
      WHERE user_id = uid AND balance_points >= _cost;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Insufficient tokens';
    END IF;
  END IF;

  INSERT INTO public.cosmetic_unlocks (user_id, cosmetic_key, cost_paid)
    VALUES (uid, _key, _cost)
    ON CONFLICT (user_id, cosmetic_key) DO NOTHING;
  RETURN true;
END;
$$;