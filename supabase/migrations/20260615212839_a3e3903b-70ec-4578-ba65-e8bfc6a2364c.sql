
CREATE TABLE public.club_wars (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  challenger_club_id UUID NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,
  defender_club_id UUID NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,
  game_title TEXT NOT NULL,
  ruleset TEXT NOT NULL,
  format TEXT NOT NULL DEFAULT 'bo3',
  wager_pool BIGINT NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','accepted','declined','active','completed','cancelled')),
  starts_at TIMESTAMPTZ,
  ends_at TIMESTAMPTZ,
  winner_club_id UUID REFERENCES public.clubs(id),
  created_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (challenger_club_id <> defender_club_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.club_wars TO authenticated;
GRANT SELECT ON public.club_wars TO anon;
GRANT ALL ON public.club_wars TO service_role;

ALTER TABLE public.club_wars ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view club wars"
  ON public.club_wars FOR SELECT
  USING (true);

CREATE POLICY "Club officers can create wars"
  ON public.club_wars FOR INSERT
  TO authenticated
  WITH CHECK (
    created_by = auth.uid()
    AND public.club_role_of(challenger_club_id, auth.uid()) IN ('owner','officer')
  );

CREATE POLICY "Club officers can update their wars"
  ON public.club_wars FOR UPDATE
  TO authenticated
  USING (
    public.club_role_of(challenger_club_id, auth.uid()) IN ('owner','officer')
    OR public.club_role_of(defender_club_id, auth.uid()) IN ('owner','officer')
  );

CREATE POLICY "Challenger officers can delete pending wars"
  ON public.club_wars FOR DELETE
  TO authenticated
  USING (
    status = 'pending'
    AND public.club_role_of(challenger_club_id, auth.uid()) IN ('owner','officer')
  );

CREATE TRIGGER club_wars_set_updated_at
  BEFORE UPDATE ON public.club_wars
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX idx_club_wars_challenger ON public.club_wars(challenger_club_id);
CREATE INDEX idx_club_wars_defender ON public.club_wars(defender_club_id);
CREATE INDEX idx_club_wars_status ON public.club_wars(status);
