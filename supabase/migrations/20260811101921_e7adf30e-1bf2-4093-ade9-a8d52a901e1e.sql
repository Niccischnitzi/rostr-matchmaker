ALTER TABLE public.profiles ALTER COLUMN is_public SET DEFAULT true;
UPDATE public.profiles SET is_public = true WHERE is_public = false;