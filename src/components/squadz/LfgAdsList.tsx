import { useEffect, useRef, useState } from "react";
import { Loader2, Megaphone, Eye } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";

type Ad = {
  id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  lfg_title: string | null;
  lfg_body: string | null;
  lfg_games: string[] | null;
  country: string | null;
};

// Dedup: only record once per viewer per ad per session
const seen = new Set<string>();

export function LfgAdsList() {
  const { user } = useAuth();
  const [ads, setAds] = useState<Ad[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("profiles" as any)
        .select("id, username, display_name, avatar_url, lfg_title, lfg_body, lfg_games, country, is_public")
        .eq("is_public", true)
        .not("lfg_title", "is", null)
        .neq("id", user?.id ?? "")
        .order("updated_at", { ascending: false })
        .limit(20);
      setAds(((data as any) ?? []) as Ad[]);
      setLoading(false);
    })();
  }, [user?.id]);

  if (loading) return <div className="grid place-items-center py-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>;
  if (ads.length === 0) return null;

  return (
    <div className="mt-8">
      <div className="flex items-center gap-2 mb-3">
        <Megaphone className="h-4 w-4 text-primary" />
        <p className="text-xs uppercase tracking-widest text-muted-foreground font-semibold">LFG ads</p>
      </div>
      <div className="grid gap-3">
        {ads.map((ad) => (
          <AdCard key={ad.id} ad={ad} viewerId={user?.id ?? null} />
        ))}
      </div>
    </div>
  );
}

function AdCard({ ad, viewerId }: { ad: Ad; viewerId: string | null }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!viewerId || viewerId === ad.id) return;
    const key = `${ad.id}:${viewerId}`;
    if (seen.has(key)) return;
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !seen.has(key)) {
          seen.add(key);
          supabase.from("lfg_ad_views" as any).insert({ ad_owner_id: ad.id, viewer_id: viewerId }).then(() => {});
          io.disconnect();
        }
      },
      { threshold: 0.6 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [ad.id, viewerId]);

  return (
    <div ref={ref} className="rounded-2xl border border-border bg-card p-4 flex items-start gap-3 soft-rise">
      <div className="h-12 w-12 rounded-xl bg-surface-2 overflow-hidden shrink-0">
        {ad.avatar_url ? <img src={ad.avatar_url} alt="" className="h-full w-full object-cover" /> : (
          <div className="h-full w-full grid place-items-center text-sm font-bold text-muted-foreground">
            {(ad.display_name ?? ad.username).slice(0, 1).toUpperCase()}
          </div>
        )}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="font-bold truncate">{ad.lfg_title}</p>
        </div>
        <p className="text-xs text-muted-foreground mt-0.5">
          @{ad.username}{ad.country ? ` · ${ad.country}` : ""}
        </p>
        {ad.lfg_body && <p className="text-sm mt-2 text-foreground/90 line-clamp-3">{ad.lfg_body}</p>}
        {ad.lfg_games && ad.lfg_games.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {ad.lfg_games.slice(0, 6).map((g) => (
              <span key={g} className="text-[10px] px-2 py-0.5 rounded-full bg-surface border border-border">{g}</span>
            ))}
          </div>
        )}
      </div>
      <Eye className="h-4 w-4 text-muted-foreground shrink-0" />
    </div>
  );
}
