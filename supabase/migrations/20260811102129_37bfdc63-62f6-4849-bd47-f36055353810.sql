CREATE OR REPLACE FUNCTION public.request_friend(_target_user uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
  existing public.friends%ROWTYPE;
  row_out public.friends%ROWTYPE;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF _target_user IS NULL OR _target_user = uid THEN RAISE EXCEPTION 'Invalid friend request'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = _target_user AND coalesce(is_public, true) = true) THEN
    RAISE EXCEPTION 'Player is not available';
  END IF;
  IF NOT public.check_rate_limit('request_friend', 30, 60) THEN
    RAISE EXCEPTION 'Slow down — too many friend requests.' USING ERRCODE = 'check_violation';
  END IF;

  SELECT * INTO existing
  FROM public.friends
  WHERE (requester_id = uid AND addressee_id = _target_user)
     OR (requester_id = _target_user AND addressee_id = uid)
  ORDER BY created_at ASC
  LIMIT 1
  FOR UPDATE;

  IF FOUND THEN
    IF existing.status = 'blocked' THEN RAISE EXCEPTION 'This player is blocked'; END IF;
    IF existing.status = 'pending' AND existing.addressee_id = uid THEN
      UPDATE public.friends SET status = 'accepted', updated_at = now() WHERE id = existing.id RETURNING * INTO row_out;
      RETURN jsonb_build_object('ok', true, 'status', 'accepted', 'matched', true, 'friendship_id', row_out.id);
    END IF;
    RETURN jsonb_build_object('ok', true, 'status', existing.status, 'matched', existing.status = 'accepted', 'friendship_id', existing.id);
  END IF;

  -- The AFTER INSERT trigger notify_friend_request() creates the notification;
  -- inserting one here too produced duplicate alerts.
  INSERT INTO public.friends (requester_id, addressee_id, status)
  VALUES (uid, _target_user, 'pending')
  RETURNING * INTO row_out;

  RETURN jsonb_build_object('ok', true, 'status', 'pending', 'matched', false, 'friendship_id', row_out.id);
END;
$$;
REVOKE ALL ON FUNCTION public.request_friend(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.request_friend(uuid) TO authenticated;