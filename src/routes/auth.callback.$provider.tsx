import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { Loader2, CheckCircle2, XCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

type Provider = "steam" | "discord" | "tracker";

const PROVIDER_META: Record<Provider, { label: string; emoji: string; platform: string; rankHint: string | null }> = {
  steam: { label: "Steam", emoji: "🎮", platform: "Steam", rankHint: null },
  discord: { label: "Discord", emoji: "💬", platform: "Discord", rankHint: null },
  tracker: { label: "Tracker.gg", emoji: "📊", platform: "Steam", rankHint: "Diamond II · 1.45 K/D" },
};

export const Route = createFileRoute("/auth/callback/$provider")({
  component: OAuthCallback,
  errorComponent: () => (
    <div className="min-h-screen flex items-center justify-center p-6 text-sm">Callback error.</div>
  ),
  notFoundComponent: () => (
    <div className="min-h-screen flex items-center justify-center p-6 text-sm">Unknown provider.</div>
  ),
});

function OAuthCallback() {
  const { provider } = Route.useParams();
  const navigate = useNavigate();
  const ran = useRef(false);
  const [status, setStatus] = useState<"working" | "ok" | "error">("working");
  const [message, setMessage] = useState<string>("Exchanging tokens…");

  const meta = PROVIDER_META[provider as Provider];

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;

    (async () => {
      if (!meta) {
        setStatus("error");
        setMessage("Unsupported provider");
        return;
      }

      // Simulate token exchange roundtrip
      await new Promise((r) => setTimeout(r, 900));

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setStatus("error");
        setMessage("You need to sign in first.");
        setTimeout(() => navigate({ to: "/auth" }), 1200);
        return;
      }

      // Avoid duplicates per platform
      const { data: existing } = await supabase
        .from("linked_accounts")
        .select("id")
        .eq("user_id", user.id)
        .eq("platform", meta.platform)
        .maybeSingle();

      if (existing) {
        setStatus("ok");
        setMessage(`${meta.label} already linked.`);
        toast.info(`${meta.label} already linked`);
        setTimeout(() => navigate({ to: "/" }), 800);
        return;
      }

      const rand = Math.floor(Math.random() * 9000 + 1000);
      const gamertag =
        provider === "discord"
          ? `discord_${rand}#${Math.floor(Math.random() * 9000 + 1000)}`
          : provider === "tracker"
            ? `tracker_${rand}`
            : `steamuser_${rand}`;

      const { error } = await supabase.from("linked_accounts").insert({
        user_id: user.id,
        platform: meta.platform,
        gamertag,
        current_rank_display: meta.rankHint,
      });

      if (error) {
        setStatus("error");
        setMessage(error.message);
        toast.error("Could not link account", { description: error.message });
        return;
      }

      setStatus("ok");
      setMessage(`${meta.label} linked as ${gamertag}`);
      toast.success(`${meta.label} connected`, { description: gamertag });
      setTimeout(() => navigate({ to: "/" }), 900);
    })();
  }, [meta, navigate, provider]);

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-background">
      <div className="max-w-sm w-full rounded-2xl border border-border bg-card p-8 text-center space-y-3 shadow-sm">
        <div className="text-4xl">{meta?.emoji ?? "🔌"}</div>
        <h1 className="font-display text-xl font-bold">
          {meta ? `Connecting ${meta.label}` : "Unknown provider"}
        </h1>
        <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
          {status === "working" && <Loader2 className="h-4 w-4 animate-spin" />}
          {status === "ok" && <CheckCircle2 className="h-4 w-4 text-emerald-500" />}
          {status === "error" && <XCircle className="h-4 w-4 text-destructive" />}
          <span>{message}</span>
        </div>
        <p className="text-[10px] uppercase tracking-widest text-muted-foreground">
          Mock handshake — production OAuth pending
        </p>
      </div>
    </div>
  );
}
