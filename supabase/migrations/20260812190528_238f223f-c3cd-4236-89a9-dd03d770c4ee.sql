-- 1) linked_accounts: verification + synced stats are server-only
create or replace function public.protect_linked_account_verification()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  jwt_role text := coalesce(nullif(current_setting('request.jwt.claim.role', true), ''),
                            (nullif(current_setting('request.jwt.claims', true), '')::json ->> 'role'));
begin
  -- Trusted server paths (service role / db owner) may set verification + stats.
  if jwt_role = 'service_role' or current_user in ('postgres', 'supabase_admin', 'service_role') then
    return new;
  end if;

  if tg_op = 'INSERT' then
    new.verified := false;
    new.aggregated_stats := '{}'::jsonb;
  else
    new.verified := old.verified;
    new.aggregated_stats := old.aggregated_stats;
    new.external_uid := old.external_uid;
  end if;
  return new;
end;
$$;

revoke all on function public.protect_linked_account_verification() from anon, authenticated;

drop trigger if exists protect_linked_account_verification on public.linked_accounts;
create trigger protect_linked_account_verification
before insert or update on public.linked_accounts
for each row execute function public.protect_linked_account_verification();

-- 2) lfg_boosts: only the buyer can read their boosts
drop policy if exists "Boosts public read" on public.lfg_boosts;
create policy "Boosts owner read" on public.lfg_boosts
for select to authenticated
using (auth.uid() = user_id);

-- 3) media-clips: drop blanket bucket-wide read
drop policy if exists "media-clips authenticated read" on storage.objects;
create policy "media-clips feed posts readable" on storage.objects
for select to authenticated
using (
  bucket_id = 'media-clips'
  and exists (select 1 from public.media_posts mp where mp.media_path = storage.objects.name)
);

-- 4) avatars: anonymous visitors only see avatars of public profiles
drop policy if exists "Avatars are publicly viewable" on storage.objects;
create policy "Avatars readable by signed-in users" on storage.objects
for select to authenticated
using (bucket_id = 'avatars');
create policy "Public profile avatars readable by anyone" on storage.objects
for select to anon
using (
  bucket_id = 'avatars'
  and exists (
    select 1 from public.profiles p
    where p.id::text = (storage.foldername(name))[1]
      and coalesce(p.is_public, false) = true
  )
);

-- 5) profiles: hide sensitive columns from profile reads
revoke select on public.profiles from anon, authenticated;
grant select (
  id, username, display_name, avatar_url, banner_url, age, gender, country, timezone,
  bio, playing_hours, availability_status, current_game_activity, playstyle_badges,
  customization_options, created_at, updated_at, is_public, lfg_title, lfg_body,
  lfg_games, dm_policy, show_availability, onboarded_at, custom_traits
) on public.profiles to authenticated;
grant all on public.profiles to service_role;

create or replace function public.my_private_profile()
returns table (
  id uuid,
  date_of_birth date,
  email_verified_at timestamptz,
  pro_until timestamptz,
  rep_score integer
)
language sql
stable
security definer
set search_path = public
as $$
  select p.id, p.date_of_birth, p.email_verified_at, p.pro_until, p.rep_score
  from public.profiles p
  where p.id = auth.uid()
$$;

revoke all on function public.my_private_profile() from anon;
grant execute on function public.my_private_profile() to authenticated;