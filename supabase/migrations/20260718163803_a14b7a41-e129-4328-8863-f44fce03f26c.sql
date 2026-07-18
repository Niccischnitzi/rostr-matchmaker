CREATE OR REPLACE FUNCTION public.public_user_cosmetics(_user_id uuid)
RETURNS TABLE(halo_class text, frame_class text, tag_name text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT
    (SELECT si.css_class FROM public.user_inventory ui
       JOIN public.shop_items si ON si.id = ui.item_id
      WHERE ui.user_id = p.id AND ui.equipped = true AND si.type = 'halo' LIMIT 1) AS halo_class,
    (SELECT si.css_class FROM public.user_inventory ui
       JOIN public.shop_items si ON si.id = ui.item_id
      WHERE ui.user_id = p.id AND ui.equipped = true AND si.type = 'avatar_frame' LIMIT 1) AS frame_class,
    (SELECT si.name FROM public.user_inventory ui
       JOIN public.shop_items si ON si.id = ui.item_id
      WHERE ui.user_id = p.id AND ui.equipped = true AND si.type = 'tag' LIMIT 1) AS tag_name
  FROM public.profiles p
  WHERE p.id = _user_id
    AND coalesce(p.is_public, true) = true
  LIMIT 1;
$function$;

REVOKE ALL ON FUNCTION public.public_user_cosmetics(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.public_user_cosmetics(uuid) TO authenticated;