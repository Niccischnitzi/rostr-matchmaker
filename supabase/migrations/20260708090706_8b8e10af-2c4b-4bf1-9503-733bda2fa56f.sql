
-- Shop items catalog
CREATE TABLE public.shop_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text NOT NULL UNIQUE,
  name text NOT NULL,
  description text,
  type text NOT NULL CHECK (type IN ('halo','avatar_frame','background','tag')),
  cost_tokens integer NOT NULL CHECK (cost_tokens >= 0),
  asset_url text,
  preview_url text,
  css_class text,
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.shop_items TO anon, authenticated;
GRANT ALL ON public.shop_items TO service_role;
ALTER TABLE public.shop_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view active items" ON public.shop_items
  FOR SELECT USING (is_active = true OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins manage shop items" ON public.shop_items
  FOR ALL USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- User inventory
CREATE TABLE public.user_inventory (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  item_id uuid NOT NULL REFERENCES public.shop_items(id) ON DELETE CASCADE,
  equipped boolean NOT NULL DEFAULT false,
  purchased_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, item_id)
);
CREATE INDEX idx_user_inventory_user ON public.user_inventory(user_id);
GRANT SELECT, UPDATE ON public.user_inventory TO authenticated;
GRANT ALL ON public.user_inventory TO service_role;
ALTER TABLE public.user_inventory ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own inventory" ON public.user_inventory
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users equip own inventory" ON public.user_inventory
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Token transaction log
CREATE TABLE public.token_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  delta integer NOT NULL,
  reason text NOT NULL,
  ref_id text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_token_tx_user ON public.token_transactions(user_id, created_at DESC);
GRANT SELECT ON public.token_transactions TO authenticated;
GRANT ALL ON public.token_transactions TO service_role;
ALTER TABLE public.token_transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own token log" ON public.token_transactions
  FOR SELECT USING (auth.uid() = user_id);

-- Atomic purchase RPC
CREATE OR REPLACE FUNCTION public.purchase_shop_item(_item_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
  item public.shop_items%ROWTYPE;
  new_balance bigint;
  already boolean;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
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
END;
$$;
GRANT EXECUTE ON FUNCTION public.purchase_shop_item(uuid) TO authenticated;

-- Equip helper: ensures only one item of a given type is equipped
CREATE OR REPLACE FUNCTION public.equip_cosmetic(_item_id uuid, _equip boolean)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
  _type text;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.user_inventory WHERE user_id = uid AND item_id = _item_id) THEN
    RAISE EXCEPTION 'Item not owned';
  END IF;
  SELECT type INTO _type FROM public.shop_items WHERE id = _item_id;
  IF _equip THEN
    UPDATE public.user_inventory ui
       SET equipped = false
      FROM public.shop_items si
     WHERE ui.item_id = si.id AND ui.user_id = uid AND si.type = _type AND ui.item_id <> _item_id;
  END IF;
  UPDATE public.user_inventory SET equipped = _equip WHERE user_id = uid AND item_id = _item_id;
  RETURN true;
END;
$$;
GRANT EXECUTE ON FUNCTION public.equip_cosmetic(uuid, boolean) TO authenticated;

-- Seed starter catalog
INSERT INTO public.shop_items (key, name, description, type, cost_tokens, css_class, sort_order) VALUES
  ('halo_gold', 'Gold Halo', 'A radiant gold ring above your avatar.', 'halo', 500, 'halo-gold', 10),
  ('halo_neon', 'Neon Halo', 'Pulsing cyan neon ring.', 'halo', 750, 'halo-neon', 20),
  ('halo_fire', 'Fire Halo', 'Flickering ember crown.', 'halo', 1200, 'halo-fire', 30),
  ('frame_platinum', 'Platinum Frame', 'Sleek platinum avatar frame.', 'avatar_frame', 800, 'frame-platinum', 40),
  ('frame_diamond', 'Diamond Frame', 'Shimmering diamond avatar frame.', 'avatar_frame', 1500, 'frame-diamond', 50),
  ('bg_fluid_sunset', 'Fluid Sunset', 'Animated sunset gradient background.', 'background', 600, 'fluid-bg-sunset', 60),
  ('bg_fluid_aurora', 'Fluid Aurora', 'Aurora borealis animated background.', 'background', 900, 'fluid-bg-aurora', 70),
  ('bg_fluid_ember', 'Fluid Ember', 'Molten ember flow background.', 'background', 1100, 'fluid-bg-ember', 80),
  ('tag_founder', 'Founder Tag', 'Show off your early support.', 'tag', 300, 'tag-founder', 90)
ON CONFLICT (key) DO NOTHING;
