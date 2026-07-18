-- Server-side 16+ age gate. Client also blocks, but enforce at the DB so
-- a tampered client (or direct API call) cannot bypass it.
CREATE OR REPLACE FUNCTION public.enforce_min_age_16()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.date_of_birth IS NOT NULL THEN
    IF NEW.date_of_birth > (current_date - INTERVAL '16 years')::date THEN
      RAISE EXCEPTION 'You must be 16 or older to use Rostr.'
        USING ERRCODE = 'check_violation';
    END IF;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_enforce_min_age_16 ON public.profiles;
CREATE TRIGGER trg_enforce_min_age_16
BEFORE INSERT OR UPDATE OF date_of_birth ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.enforce_min_age_16();