-- RLS helper functions are evaluated as the calling role, so signed-in users
-- must be able to execute them or every policy using them denies access.
GRANT EXECUTE ON FUNCTION public.is_conversation_participant(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_group_member(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_club_member(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_clan_member(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.clan_role_of(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.club_role_of(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_rate_match(uuid, uuid, uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_active_pro_subscription(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.media_upload_cost(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.media_uploads_today(uuid) TO authenticated;

-- The DM notification is now handled by the trigger on direct_messages;
-- drop the duplicate insert inside the RPC.
CREATE OR REPLACE FUNCTION public.send_dm_to_user(_other_user uuid, _body text DEFAULT NULL::text, _attachment_url text DEFAULT NULL::text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  uid uuid := auth.uid();
  conv public.conversations%ROWTYPE;
  msg public.direct_messages%ROWTYPE;
  clean_body text := nullif(trim(coalesce(_body, '')), '');
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF clean_body IS NULL AND nullif(trim(coalesce(_attachment_url, '')), '') IS NULL THEN RAISE EXCEPTION 'Message is empty'; END IF;
  IF clean_body IS NOT NULL AND length(clean_body) > 2000 THEN RAISE EXCEPTION 'Message is too long'; END IF;
  IF NOT public.check_rate_limit('send_dm', 80, 60) THEN
    RAISE EXCEPTION 'Slow down — too many messages.' USING ERRCODE = 'check_violation';
  END IF;

  SELECT * INTO conv FROM public.get_or_create_conversation(_other_user);
  INSERT INTO public.direct_messages (conversation_id, sender_id, body, attachment_url)
  VALUES (conv.id, uid, clean_body, nullif(trim(coalesce(_attachment_url, '')), ''))
  RETURNING * INTO msg;

  RETURN jsonb_build_object('ok', true, 'conversation', row_to_json(conv), 'message', row_to_json(msg));
END;
$function$;