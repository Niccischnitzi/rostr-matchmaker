
-- =========================
-- SUBSCRIPTIONS
-- =========================
CREATE TABLE public.subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  stripe_subscription_id text NOT NULL UNIQUE,
  stripe_customer_id text NOT NULL,
  product_id text NOT NULL,
  price_id text NOT NULL,
  status text NOT NULL DEFAULT 'active',
  current_period_start timestamptz,
  current_period_end timestamptz,
  cancel_at_period_end boolean DEFAULT false,
  environment text NOT NULL DEFAULT 'sandbox',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

GRANT SELECT ON public.subscriptions TO authenticated;
GRANT ALL ON public.subscriptions TO service_role;

ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own subscription"
  ON public.subscriptions FOR SELECT
  USING (auth.uid() = user_id);

CREATE INDEX idx_subscriptions_user_id ON public.subscriptions(user_id);
CREATE INDEX idx_subscriptions_stripe_id ON public.subscriptions(stripe_subscription_id);
CREATE INDEX idx_subscriptions_env ON public.subscriptions(environment);

CREATE TRIGGER trg_subscriptions_updated_at
  BEFORE UPDATE ON public.subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- =========================
-- PAYMENT GRANTS (one-time purchases, idempotent on session id)
-- =========================
CREATE TABLE public.payment_grants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  stripe_session_id text NOT NULL UNIQUE,
  price_id text NOT NULL,
  amount_paid integer,
  currency text,
  kind text NOT NULL,                   -- 'tokens' | 'tournament_entry' | 'other'
  tokens_granted integer DEFAULT 0,
  metadata jsonb,
  environment text NOT NULL DEFAULT 'sandbox',
  created_at timestamptz DEFAULT now()
);

GRANT SELECT ON public.payment_grants TO authenticated;
GRANT ALL ON public.payment_grants TO service_role;

ALTER TABLE public.payment_grants ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own grants"
  ON public.payment_grants FOR SELECT
  USING (auth.uid() = user_id);

CREATE INDEX idx_payment_grants_user_id ON public.payment_grants(user_id);
CREATE INDEX idx_payment_grants_env ON public.payment_grants(environment);

-- =========================
-- HELPER: is the user on Rostr Pro right now?
-- =========================
CREATE OR REPLACE FUNCTION public.has_active_pro_subscription(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.subscriptions
    WHERE user_id = _user_id
      AND price_id IN ('pro_monthly','pro_yearly')
      AND (
        (status IN ('active','trialing','past_due')
          AND (current_period_end IS NULL OR current_period_end > now()))
        OR (status = 'canceled' AND current_period_end > now())
      )
  );
$$;
