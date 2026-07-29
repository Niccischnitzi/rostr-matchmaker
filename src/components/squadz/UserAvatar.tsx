import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useEquippedCosmetics } from "@/hooks/use-equipped-cosmetics";
import { CosmeticAvatar } from "@/components/cosmetics/CosmeticAvatar";
import { cn } from "@/lib/utils";

type Props = {
  userId?: string | null;
  avatarUrl?: string | null;
  fallback?: string; // initials
  size?: number;
  className?: string;
};

type PublicCosmetics = { halo_class: string | null; frame_class: string | null; tag_name: string | null };

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Resolves a stored avatar value (full URL or storage object path) to a loadable src. */
function resolveAvatar(value?: string | null): string | undefined {
  if (!value) return undefined;
  if (/^(https?:|data:|blob:)/.test(value)) return value;
  const path = value.replace(/^\/+/, "");
  return supabase.storage.from("avatars").getPublicUrl(path).data.publicUrl;
}

/**
 * Universal avatar. Auto-applies the CURRENT user's equipped halo/frame.
 * For other users, still renders the CosmeticAvatar wrapper (no overlays)
 * so layout stays identical across every surface (chat, friends, LFG, feed).
 */
export function UserAvatar({ userId, avatarUrl, fallback, size = 40, className }: Props) {
  const { user } = useAuth();
  const equipped = useEquippedCosmetics();
  const [otherAvatar, setOtherAvatar] = useState<string | null>(null);
  const [otherCosmetics, setOtherCosmetics] = useState<PublicCosmetics | null>(null);

  // Demo/mock rows use non-UUID ids — never hit the API with those.
  const realId = userId && UUID_RE.test(userId) ? userId : null;
  const isSelf = Boolean(user && realId && user.id === realId);

  // Fill missing avatar for known user ids (best-effort, single lookup).
  useEffect(() => {
    if (avatarUrl || !realId || isSelf) return;
    let cancelled = false;
    supabase
      .from("profiles")
      .select("avatar_url")
      .eq("id", realId)
      .maybeSingle()
      .then(({ data }) => {
        if (!cancelled) setOtherAvatar(data?.avatar_url ?? null);
      });
    return () => {
      cancelled = true;
    };
  }, [realId, avatarUrl, isSelf]);

  useEffect(() => {
    if (!realId || isSelf) { setOtherCosmetics(null); return; }
    let cancelled = false;
    supabase
      .rpc("public_user_cosmetics" as any, { _user_id: realId })
      .then(({ data }) => {
        const row = Array.isArray(data) ? data[0] : data;
        if (!cancelled) setOtherCosmetics((row as PublicCosmetics | null) ?? null);
      });
    return () => {
      cancelled = true;
    };
  }, [realId, isSelf]);

  const src = resolveAvatar(avatarUrl ?? otherAvatar);
  const halo = isSelf ? equipped.halo?.css_class : otherCosmetics?.halo_class ?? undefined;
  const frame = isSelf ? equipped.avatar_frame?.css_class : otherCosmetics?.frame_class ?? undefined;

  return (
    <CosmeticAvatar size={size} haloClass={halo} frameClass={frame} className={className}>
      <div
        className={cn(
          "h-full w-full rounded-full overflow-hidden bg-surface grid place-items-center text-xs font-black text-muted-foreground",
        )}
      >
        {src ? (
          <img src={src} alt="" className="h-full w-full object-cover" />
        ) : (
          <span aria-hidden>{(fallback ?? "?").slice(0, 2).toUpperCase()}</span>
        )}
      </div>
    </CosmeticAvatar>
  );
}
