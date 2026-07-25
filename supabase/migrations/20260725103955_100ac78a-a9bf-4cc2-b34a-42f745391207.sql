CREATE OR REPLACE FUNCTION public.clan_role_rank(_role public.clan_role)
RETURNS integer
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $function$
  SELECT CASE _role
    WHEN 'leader' THEN 6
    WHEN 'co_leader' THEN 5
    WHEN 'officer' THEN 4
    WHEN 'veteran' THEN 3
    WHEN 'member' THEN 2
    WHEN 'recruit' THEN 1
    ELSE 0 END;
$function$;