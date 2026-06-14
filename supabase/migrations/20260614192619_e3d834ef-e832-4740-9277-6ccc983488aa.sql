
-- 1. Fix club_members self-join privilege escalation
DROP POLICY IF EXISTS "Users can join clubs as themselves" ON public.club_members;
CREATE POLICY "Users can join clubs as themselves"
  ON public.club_members FOR INSERT
  WITH CHECK (auth.uid() = user_id AND role = 'member');

-- 2. Explicit clan member self-join (role enforced to 'member')
DROP POLICY IF EXISTS "clan members self join" ON public.clan_members;
CREATE POLICY "clan members self join"
  ON public.clan_members FOR INSERT
  WITH CHECK (auth.uid() = user_id AND role = 'member');

-- 3. Restrict linked_accounts SELECT to owner
DROP POLICY IF EXISTS "Linked accounts viewable by authenticated users" ON public.linked_accounts;
CREATE POLICY "Users can view their own linked accounts"
  ON public.linked_accounts FOR SELECT
  USING (auth.uid() = user_id);

-- 4. Recreate tournament_payout view with security_invoker
DROP VIEW IF EXISTS public.tournament_payout;
CREATE VIEW public.tournament_payout
  WITH (security_invoker = true) AS
  SELECT t.id AS tournament_id,
         t.entry_fee,
         t.rake_pct,
         count(e.id) AS entries,
         (t.entry_fee * count(e.id))::numeric AS gross,
         ((t.entry_fee * count(e.id))::numeric * (1::numeric - (t.rake_pct / 100.0))) AS net_payout
  FROM public.tournaments t
  LEFT JOIN public.tournament_entries e ON e.tournament_id = t.id
  GROUP BY t.id;
GRANT SELECT ON public.tournament_payout TO authenticated;

-- 5. Revoke EXECUTE from anon on all SECURITY DEFINER helpers / triggers.
--    Revoke from authenticated on trigger-only functions (they don't need direct calls).
REVOKE EXECUTE ON FUNCTION public.add_clan_owner_member() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.add_default_club_channel() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.add_owner_as_member() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.bump_conversation_last_message() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_challenge_status() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.sync_clan_member_count() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.sync_club_member_count() FROM PUBLIC, anon, authenticated;

-- Helper functions used by RLS policies: keep authenticated, drop anon/public.
REVOKE EXECUTE ON FUNCTION public.clan_role_of(uuid, uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.club_role_of(uuid, uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_clan_member(uuid, uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_club_member(uuid, uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_conversation_participant(uuid, uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, app_role) FROM PUBLIC, anon;

-- 6. Storage policies for dm-attachments bucket.
--    Convention: object path begins with "{conversation_id}/..." so the first folder
--    is the conversation UUID. Only conversation participants may access.
DROP POLICY IF EXISTS "DM participants can read attachments" ON storage.objects;
CREATE POLICY "DM participants can read attachments"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'dm-attachments'
    AND public.is_conversation_participant(
      ((storage.foldername(name))[1])::uuid,
      auth.uid()
    )
  );

DROP POLICY IF EXISTS "DM participants can upload attachments" ON storage.objects;
CREATE POLICY "DM participants can upload attachments"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'dm-attachments'
    AND auth.uid() = owner
    AND public.is_conversation_participant(
      ((storage.foldername(name))[1])::uuid,
      auth.uid()
    )
  );

DROP POLICY IF EXISTS "DM uploader can update own attachments" ON storage.objects;
CREATE POLICY "DM uploader can update own attachments"
  ON storage.objects FOR UPDATE
  USING (bucket_id = 'dm-attachments' AND auth.uid() = owner)
  WITH CHECK (bucket_id = 'dm-attachments' AND auth.uid() = owner);

DROP POLICY IF EXISTS "DM uploader can delete own attachments" ON storage.objects;
CREATE POLICY "DM uploader can delete own attachments"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'dm-attachments' AND auth.uid() = owner);
