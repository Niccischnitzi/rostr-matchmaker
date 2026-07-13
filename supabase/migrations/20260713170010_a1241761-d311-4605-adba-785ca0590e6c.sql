-- Rate-limit gates on hot wallet/economy RPCs. All keep SECURITY DEFINER
-- because they must write to wallets after authorizing auth.uid() themselves.

CREATE OR REPLACE FUNCTION public.spend_tokens(_amount integer)
 RETURNS bigint
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  uid uuid := auth.uid();
  new_balance bigint;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF _amount < 0 THEN RAISE EXCEPTION 'Amount must be non-negative'; END IF;
  IF NOT public.check_rate_limit('spend_tokens', 30, 60) THEN
    RAISE EXCEPTION 'Slow down — too many spend attempts. Try again in a minute.' USING ERRCODE = 'check_violation';
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
END $function$;

CREATE OR REPLACE FUNCTION public.purchase_shop_item(_item_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  uid uuid := auth.uid();
  item public.shop_items%ROWTYPE;
  new_balance bigint;
  already boolean;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF NOT public.check_rate_limit('purchase_shop_item', 10, 60) THEN
    RAISE EXCEPTION 'Slow down — too many purchases. Try again in a minute.' USING ERRCODE = 'check_violation';
  END IF;
  SELECT * INTO item FROM public.shop_items WHERE id = _item_id AND is_active = true;
  IF NOT FOUND THEN RAISE EXCEPTION 'Item not available'; END IF;

  SELECT EXISTS(SELECT 1 FROM public.user_inventory WHERE user_id = uid AND item_id = _item_id) INTO already;
  IF already THEN
    RETURN jsonb_build_object('ok', true, 'already_owned', true);
  END IF;

  IF item.cost_tokens > 0 THEN
    UPDATE public.wallets
       SET balance_points = balance_points - item.cost_tokens,
           lifetime_lost = lifetime_lost + item.cost_tokens,
           updated_at = now()
     WHERE user_id = uid AND balance_points >= item.cost_tokens
     RETURNING balance_points INTO new_balance;
    IF new_balance IS NULL THEN RAISE EXCEPTION 'Insufficient tokens'; END IF;
  ELSE
    SELECT balance_points INTO new_balance FROM public.wallets WHERE user_id = uid;
  END IF;

  INSERT INTO public.user_inventory (user_id, item_id) VALUES (uid, _item_id);
  INSERT INTO public.token_transactions (user_id, delta, reason, ref_id)
    VALUES (uid, -item.cost_tokens, 'shop_purchase', item.key);

  RETURN jsonb_build_object('ok', true, 'balance', new_balance, 'item_key', item.key);
END $function$;

CREATE OR REPLACE FUNCTION public.unlock_cosmetic(_key text, _cost integer)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  uid uuid := auth.uid();
  already boolean;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF _cost < 0 THEN RAISE EXCEPTION 'Invalid cost'; END IF;
  IF _key IS NULL OR length(trim(_key)) = 0 THEN RAISE EXCEPTION 'Invalid key'; END IF;
  IF NOT public.check_rate_limit('unlock_cosmetic', 20, 60) THEN
    RAISE EXCEPTION 'Slow down — too many unlock attempts.' USING ERRCODE = 'check_violation';
  END IF;

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
END $function$;

CREATE OR REPLACE FUNCTION public.boost_lfg(_hours integer, _cost integer)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE uid UUID := auth.uid(); bid UUID;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF _hours <= 0 OR _hours > 168 THEN RAISE EXCEPTION 'Invalid duration'; END IF;
  IF NOT public.check_rate_limit('boost_lfg', 5, 60) THEN
    RAISE EXCEPTION 'Slow down — too many boost attempts.' USING ERRCODE = 'check_violation';
  END IF;
  PERFORM public.spend_tokens(_cost);
  INSERT INTO public.lfg_boosts (user_id, expires_at, tokens_spent)
    VALUES (uid, now() + make_interval(hours => _hours), _cost)
    RETURNING id INTO bid;
  RETURN bid;
END $function$;

-- Housekeeping: keep rate_limit_events tiny (auto-prune > 24h)
DELETE FROM public.rate_limit_events WHERE created_at < now() - interval '24 hours';