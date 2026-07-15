-- Expand clan_role enum to support 6-rank hierarchy
ALTER TYPE public.clan_role ADD VALUE IF NOT EXISTS 'co_leader' AFTER 'leader';
ALTER TYPE public.clan_role ADD VALUE IF NOT EXISTS 'veteran' AFTER 'officer';
ALTER TYPE public.clan_role ADD VALUE IF NOT EXISTS 'recruit' AFTER 'member';