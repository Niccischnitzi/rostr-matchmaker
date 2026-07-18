import { useEffect, useState } from "react";
import { Megaphone, Eye, Rocket, Pencil, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";

type Props = { onEdit: () => void };

type OwnAd = {
  title: string;
  body: string | null;
  games: string[];
  isPublic: boolean;
};

export function YourLfgCard({ onEdit }: Props) {
  const { user } = useAuth();
  const [ad, setAd] = useState<OwnAd | null>(null);
  const [views, setViews] = useState<{ total: number; recent: number }>({ total: 0, recent: 0 });
  const [boostUntil, setBoostUntil] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!user?.id) { setLoaded(true); return; }
    let cancelled = false;
    (async () => {
      const [{ data: prof }, tRes, rRes, bRes] = await Promise.all([
        supabase.from("profiles" as any)
          .select("lfg_title, lfg_body, lfg_games, is_public")
          .eq("id", user.id).maybeSingle(),
        supabase.from("lfg_ad_views" as any)
          .select("id", { count: "exact", head: true }).eq("ad_owner_id", user.id),
        supabase.from("lfg_ad_views" as any)
          .select("id", { count: "exact", head: true }).eq("ad_owner_id", user.id)
          .gte("created_at", new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString()),
        supabase.from("lfg_boosts" as any)
          .select("expires_at").eq("user_id", user.id)
          .gt("expires_at", new Date().toISOString())
          .order("expires_at", { ascending: false }).limit(1),
      ]);
      if (cancelled) return;
      const d = prof as any;
      if (d?.lfg_title) {
        setAd({
          title: d.lfg_title,
          body: d.lfg_body ?? null,
          games: Array.isArray(d.lfg_games) ? d.lfg_games : [],
          isPublic: !!d.is_public,
        });
      }
      setViews({ total: tRes.count ?? 0, recent: rRes.count ?? 0 });
      setBoostUntil(((bRes.data as any)?.[0]?.expires_at as string) ?? null);
      setLoaded(true);
    })();
    return () => { cancelled = true; };
  }, [user?.id]);

  if (!loaded || !ad) return null;

  const boosted = boostUntil && new Date(boostUntil) > new Date();

  return (
    <div className="mb-4 rounded-2xl border border-primary/30 bg-gradient-to-br from-primary/10 via-surface to-surface p-4 shadow-sm">
      <div className="flex items-center gap-2 mb-2">
        <span className="text-[10px] uppercase tracking-widest font-bold text-primary flex items-center gap-1">
          <Megaphone className="h-3 w-3" /> Your live LFG
        </span>
        {boosted && (
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-primary text-primary-foreground font-bold flex items-center gap-1">
            <Sparkles className="h-3 w-3" /> BOOSTED
          </span>
        )}
        {!ad.isPublic && (
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-warning/20 text-warning font-bold">
            Hidden — profile is private
          </span>
        )}
        <span className="ml-auto text-[11px] text-muted-foreground flex items-center gap-1">
          <Eye className="h-3 w-3" /> {views.total} · <span>{views.recent} this week</span>
        </span>
      </div>
      <p className="font-display text-lg font-black leading-tight truncate">{ad.title}</p>
      {ad.body && <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{ad.body}</p>}
      {ad.games.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mt-2">
          {ad.games.slice(0, 4).map((g) => (
            <span key={g} className="text-[10px] px-2 py-0.5 rounded-full bg-surface-2 border border-border font-semibold">
              {g}
            </span>
          ))}
        </div>
      )}
      <div className="flex gap-2 mt-3">
        <Button size="sm" variant="outline" onClick={onEdit} className="gap-1.5 flex-1">
          <Pencil className="h-3.5 w-3.5" /> Edit
        </Button>
        <Button size="sm" onClick={onEdit} className="gap-1.5 flex-1">
          <Rocket className="h-3.5 w-3.5" /> {boosted ? "Extend boost" : "Super Boost"}
        </Button>
      </div>
    </div>
  );
}
