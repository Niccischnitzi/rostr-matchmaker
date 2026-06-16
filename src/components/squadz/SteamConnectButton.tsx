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

export function SteamConnectButton({ className }: { className?: string }) {
  const [linked, setLinked] = useState<LinkedSteam | null>(null);
  const [loading, setLoading] = useState(true);

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
  }, []);

  function startLink() {
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
    window.location.href = `${STEAM_OPENID}?${params.toString()}`;
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
