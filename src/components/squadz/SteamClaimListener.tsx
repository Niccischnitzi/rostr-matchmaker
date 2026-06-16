// Sprint 4 — claims a verified Steam payload off ?steam_link=... in the URL
// (set by /api/public/steam/return) and persists it via the linkSteam server fn.
// Cleans the query param either way so refreshes don't retrigger.
import { useEffect } from "react";
import { useServerFn } from "@tanstack/react-start";
import { linkSteam } from "@/lib/steam.functions";
import { toast } from "sonner";

export function SteamClaimListener() {
  const link = useServerFn(linkSteam);
  useEffect(() => {
    if (typeof window === "undefined") return;
    const url = new URL(window.location.href);
    const raw = url.searchParams.get("steam_link");
    if (!raw) return;
    url.searchParams.delete("steam_link");
    window.history.replaceState({}, "", url.toString());
    try {
      const payload = JSON.parse(decodeURIComponent(raw));
      link({
        data: {
          external_id: String(payload.external_id ?? ""),
          display_name: payload.display_name ?? null,
          avatar_url: payload.avatar_url ?? null,
        },
      }).then((res: any) => {
        if (res?.error) toast.error(res.error);
        else if (res?.ok) toast.success("Steam linked");
      }).catch((e) => {
        toast.error(e instanceof Error ? e.message : "Could not link Steam");
      });
    } catch {
      toast.error("Steam link payload was invalid");
    }
  }, [link]);
  return null;
}
