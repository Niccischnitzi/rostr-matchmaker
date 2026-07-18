-- Batch B §1: durable LFG dismissal persistence
CREATE TABLE IF NOT EXISTS public.lfg_ad_interactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  ad_owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  action text NOT NULL CHECK (action IN ('dismissed','accepted')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, ad_owner_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.lfg_ad_interactions TO authenticated;
GRANT ALL ON public.lfg_ad_interactions TO service_role;

ALTER TABLE public.lfg_ad_interactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own interactions read" ON public.lfg_ad_interactions
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "own interactions write" ON public.lfg_ad_interactions
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own interactions update" ON public.lfg_ad_interactions
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own interactions delete" ON public.lfg_ad_interactions
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS lfg_ad_interactions_user_idx ON public.lfg_ad_interactions(user_id, action);

-- Batch B §4: custom traits (decorative TEXT[] for now)
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS custom_traits text[] NOT NULL DEFAULT ARRAY[]::text[];