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

/**
 * Universal avatar. Auto-applies the CURRENT user's equipped halo/frame.
 * For other users, still renders the CosmeticAvatar wrapper (no overlays)
 * so layout stays identical across every surface (chat, friends, LFG, feed).
 */
export function UserAvatar({ userId, avatarUrl, fallback, size = 40, className }: Props) {
  const { user } = useAuth();
  const equipped = useEquippedCosmetics();
  const [otherAvatar, setOtherAvatar] = useState<string | null>(null);

  const isSelf = user && userId && user.id === userId;

  // Fill missing avatar for known user ids (best-effort, single lookup).
  useEffect(() => {
    if (avatarUrl || !userId || isSelf) return;
    let cancelled = false;
    supabase
      .from("profiles")
      .select("avatar_url")
      .eq("id", userId)
      .maybeSingle()
      .then(({ data }) => {
        if (!cancelled) setOtherAvatar(data?.avatar_url ?? null);
      });
    return () => {
      cancelled = true;
    };
  }, [userId, avatarUrl, isSelf]);

  const src = avatarUrl ?? otherAvatar ?? undefined;
  const halo = isSelf ? equipped.halo?.css_class : undefined;
  const frame = isSelf ? equipped.frame?.css_class : undefined;

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
