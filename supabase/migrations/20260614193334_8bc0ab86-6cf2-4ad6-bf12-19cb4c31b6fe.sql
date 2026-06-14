
CREATE TABLE public.availability_slots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  weekday smallint NOT NULL,
  hour smallint NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, weekday, hour)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.availability_slots TO authenticated;
GRANT ALL ON public.availability_slots TO service_role;

ALTER TABLE public.availability_slots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view availability"
  ON public.availability_slots FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "Users insert own availability"
  ON public.availability_slots FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users delete own availability"
  ON public.availability_slots FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

CREATE INDEX availability_slots_user_idx ON public.availability_slots(user_id);

-- Validation: weekday 0-6, hour 0-23
CREATE OR REPLACE FUNCTION public.validate_availability_slot()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.weekday < 0 OR NEW.weekday > 6 THEN
    RAISE EXCEPTION 'weekday must be between 0 and 6';
  END IF;
  IF NEW.hour < 0 OR NEW.hour > 23 THEN
    RAISE EXCEPTION 'hour must be between 0 and 23';
  END IF;
  RETURN NEW;
END $$;
REVOKE EXECUTE ON FUNCTION public.validate_availability_slot() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER trg_validate_availability_slot
  BEFORE INSERT OR UPDATE ON public.availability_slots
  FOR EACH ROW EXECUTE FUNCTION public.validate_availability_slot();
