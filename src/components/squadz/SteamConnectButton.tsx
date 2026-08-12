// Sprint 4 — Steam OpenID 2.0 sign-in initiation.
// The redirect lands on /api/public/steam/return which performs
// check_authentication against steamcommunity.com/openid/login,
// then a client-side claim using linkSteam server fn writes to linked_accounts
// scoped to the signed-in user.
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Loader2, Gamepad2, Check } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

const STEAM_OPENID = "https://steamcommunity.com/openid/login";

type LinkedSteam = { external_uid: string | null; gamertag: string; aggregated_stats: any };

function buildSteamUrl() {
  const returnTo = `${window.location.origin}/api/public/steam/return`;
  const realm = window.location.origin;
  const params = new URLSearchParams({
    "openid.ns": "http://specs.openid.net/auth/2.0",
    "openid.mode": "checkid_setup",
    "openid.return_to": returnTo,
    "openid.realm": realm,
    "openid.identity": "http://specs.openid.net/auth/2.0/identifier_select",
    "openid.claimed_id": "http://specs.openid.net/auth/2.0/identifier_select",
  });
  return `${STEAM_OPENID}?${params.toString()}`;
}

export function SteamConnectButton({ className }: { className?: string }) {
  const [linked, setLinked] = useState<LinkedSteam | null>(null);
  const [loading, setLoading] = useState(true);
  const [popupBlockedUrl, setPopupBlockedUrl] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data: u } = await supabase.auth.getUser();
      const uid = u.user?.id;
      if (!uid) { setLoading(false); return; }
      const { data } = await supabase
        .from("linked_accounts")
        .select("external_uid,gamertag,aggregated_stats")
        .eq("user_id", uid)
        .eq("platform", "steam")
        .maybeSingle();
      if (!cancelled) {
        setLinked((data as any) ?? null);
        setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [tick]);

  // The Steam tab writes this key once the link is claimed.
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === "rostr:steam_linked") setTick((t) => t + 1);
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  function startLink() {
    const url = buildSteamUrl();
    // Steam refuses to be framed (X-Frame-Options), and the preview runs inside
    // an iframe — so always hand off to a real top-level tab/window.
    const win = window.open(url, "_blank", "noopener,noreferrer,width=1000,height=760");
    if (!win) {
      setPopupBlockedUrl(url);
      return;
    }
    setPopupBlockedUrl(null);
  }

  if (loading) {
    return <Button variant="outline" disabled className={className}><Loader2 className="h-4 w-4 animate-spin" /></Button>;
  }

  if (linked) {
    const avatar = linked.aggregated_stats?.avatar_url as string | undefined;
    return (
      <div className={`inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-success/40 bg-success/5 text-xs font-semibold ${className ?? ""}`}>
        {avatar && <img src={avatar} className="h-6 w-6 rounded-full" alt="" />}
        <Check className="h-3.5 w-3.5 text-success" /> Steam · {linked.gamertag}
      </div>
    );
  }

  return (
    <Button onClick={startLink} variant="outline" className={`gap-2 ${className ?? ""}`}>
      <Gamepad2 className="h-4 w-4" /> Connect Steam
    </Button>
  );
}
