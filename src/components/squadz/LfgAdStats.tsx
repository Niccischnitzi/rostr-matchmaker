import { useEffect, useState } from "react";
import { Eye, Megaphone, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

export function LfgAdStats({ userId }: { userId: string }) {
  const [loading, setLoading] = useState(true);
  const [ad, setAd] = useState<{ title: string | null; body: string | null; games: string[] | null; updated_at: string | null } | null>(null);
  const [totalViews, setTotalViews] = useState(0);
  const [uniqueViewers, setUniqueViewers] = useState(0);
  const [views24h, setViews24h] = useState(0);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data: prof } = await supabase
        .from("profiles" as any)
        .select("lfg_title, lfg_body, lfg_games, updated_at")
        .eq("id", userId)
        .maybeSingle();
      const p = prof as any;
      setAd(p ? { title: p.lfg_title, body: p.lfg_body, games: p.lfg_games, updated_at: p.updated_at } : null);

      const { data: views } = await supabase
        .from("lfg_ad_views" as any)
        .select("viewer_id, created_at")
        .eq("ad_owner_id", userId);
      const rows = (views as any[]) ?? [];
      setTotalViews(rows.length);
      setUniqueViewers(new Set(rows.map((r) => r.viewer_id)).size);
      const cutoff = Date.now() - 24 * 60 * 60 * 1000;
      setViews24h(rows.filter((r) => new Date(r.created_at).getTime() > cutoff).length);
      setLoading(false);
    })();
  }, [userId]);

  if (loading) {
    return (
      <div className="mt-6 rounded-2xl border border-border bg-card p-4 grid place-items-center">
        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!ad?.title) {
    return (
      <div className="mt-6 rounded-2xl border border-primary/30 bg-primary/5 p-4 flex items-center gap-3">
        <div className="h-10 w-10 rounded-xl bg-primary/15 text-primary grid place-items-center shrink-0">
          <Megaphone className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <p className="font-display text-base font-black">No active LFG ad</p>
          <p className="text-xs text-muted-foreground">Post one from the Find tab to start matching with players.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="mt-6 rounded-2xl border border-border bg-card overflow-hidden">
      <div className="p-4 bg-gradient-to-br from-primary/15 via-transparent to-transparent flex items-center gap-2">
        <Megaphone className="h-4 w-4 text-primary" />
        <p className="text-[10px] uppercase tracking-[0.2em] font-bold text-primary">Your LFG ad performance</p>
      </div>
      <div className="px-4 pb-4">
        <p className="font-display text-lg font-black truncate">{ad.title}</p>
        {ad.body && <p className="text-sm text-muted-foreground line-clamp-2 mt-1">{ad.body}</p>}
        {ad.games && ad.games.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {ad.games.slice(0, 6).map((g) => (
              <span key={g} className="text-[10px] px-2 py-0.5 rounded-full bg-surface border border-border font-semibold">{g}</span>
            ))}
          </div>
        )}

        <div className="mt-4 grid grid-cols-3 gap-2">
          <Stat label="Total views" value={totalViews} />
          <Stat label="Unique viewers" value={uniqueViewers} />
          <Stat label="Last 24h" value={views24h} />
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-border bg-surface p-3 text-center">
      <div className="flex items-center justify-center gap-1 text-primary">
        <Eye className="h-3.5 w-3.5" />
        <span className="font-display text-xl font-black leading-none">{value}</span>
      </div>
      <p className="text-[9px] uppercase tracking-widest text-muted-foreground font-bold mt-1">{label}</p>
    </div>
  );
}
