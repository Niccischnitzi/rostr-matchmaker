
CREATE OR REPLACE FUNCTION public.enforce_single_club_membership()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.club_members
    WHERE user_id = NEW.user_id
      AND club_id <> NEW.club_id
  ) THEN
    RAISE EXCEPTION 'You already belong to a club. Leave it before joining or creating another.'
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_single_club_membership ON public.club_members;
CREATE TRIGGER trg_enforce_single_club_membership
BEFORE INSERT ON public.club_members
FOR EACH ROW
EXECUTE FUNCTION public.enforce_single_club_membership();
