import { useEffect, useRef, useState } from "react";
import { Loader2, Megaphone, MapPin, UserPlus, Check } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { UserSafetyActions } from "./UserSafetyActions";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { sfx } from "@/lib/sfx";

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
  const [added, setAdded] = useState<Set<string>>(new Set());

  useEffect(() => {
    (async () => {
      setLoading(true);
      let q = supabase
        .from("profiles" as any)
        .select("id, username, display_name, avatar_url, lfg_title, lfg_body, lfg_games, country, is_public")
        .eq("is_public", true)
        .not("lfg_title", "is", null)
        .order("updated_at", { ascending: false })
        .limit(20);
      if (user?.id) q = q.neq("id", user.id);
      const { data, error } = await q;
      if (error) console.warn("LFG ads load failed", error.message);
      setAds(((data as any) ?? []) as Ad[]);
      setLoading(false);
    })();
  }, [user?.id]);

  async function addToRostr(ad: Ad) {
    if (!user) return toast.error("Sign in to add players");
    const { error } = await supabase.from("friends").upsert(
      { requester_id: user.id, addressee_id: ad.id, status: "pending" },
      { onConflict: "requester_id,addressee_id" },
    );
    if (error) return toast.error(error.message);
    sfx.like();
    toast.success(`Added ${ad.display_name ?? ad.username} to your rostr!`);
    setAdded((prev) => new Set(prev).add(ad.id));
  }

  if (loading) return <div className="grid place-items-center py-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>;

  return (
    <div className="mt-8">
      <div className="flex items-center gap-2 mb-3">
        <Megaphone className="h-4 w-4 text-primary" />
        <p className="text-xs uppercase tracking-widest text-muted-foreground font-semibold">Looking for Rostr</p>
      </div>
      {ads.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
          No active LFG ads yet — post one to be the first.
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {ads.map((ad) => (
            <AdCard
              key={ad.id}
              ad={ad}
              viewerId={user?.id ?? null}
              added={added.has(ad.id)}
              onAdd={() => addToRostr(ad)}
              onBlocked={() => setAds((prev) => prev.filter((item) => item.id !== ad.id))}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function AdCard({
  ad,
  viewerId,
  added,
  onAdd,
  onBlocked,
}: {
  ad: Ad;
  viewerId: string | null;
  added: boolean;
  onAdd: () => void;
  onBlocked: () => void;
}) {
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

  const name = ad.display_name ?? ad.username;

  return (
    <div ref={ref} className="relative rounded-3xl border border-border bg-card overflow-hidden shadow-lg flex flex-col soft-rise">
      {/* Banner */}
      <div className="relative h-20 bg-gradient-to-br from-primary via-[color-mix(in_oklab,var(--primary)_60%,var(--primary-glow))] to-accent">
        <div className="absolute inset-0 opacity-30 overflow-hidden" style={{ backgroundImage: "radial-gradient(circle at 20% 30%, white 1px, transparent 1px), radial-gradient(circle at 70% 60%, white 1px, transparent 1px)", backgroundSize: "30px 30px" }} />
        <div className="absolute top-2 right-2">
          <UserSafetyActions targetId={ad.id} targetLabel={name} onBlocked={onBlocked} />
        </div>
      </div>

      {/* Avatar */}
      <div className="relative">
        <div className="absolute -top-9 left-4 z-10">
          <div className="h-16 w-16 rounded-2xl border-4 border-card bg-surface-2 overflow-hidden shadow-xl">
            {ad.avatar_url ? (
              <img src={ad.avatar_url} alt={name} className="h-full w-full object-cover" />
            ) : (
              <div className="h-full w-full grid place-items-center text-lg font-bold text-muted-foreground">
                {name.slice(0, 1).toUpperCase()}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Body */}
      <div className="px-4 pt-10 pb-4 flex-1 flex flex-col">
        <p className="font-display text-base font-black leading-tight line-clamp-1">{ad.lfg_title}</p>
        <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1">
          @{ad.username}
          {ad.country && (<><span className="opacity-50">·</span><MapPin className="h-3 w-3" />{ad.country}</>)}
        </p>

        {ad.lfg_body && <p className="text-sm mt-2 text-foreground/90 line-clamp-2">{ad.lfg_body}</p>}

        {ad.lfg_games && ad.lfg_games.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {ad.lfg_games.slice(0, 4).map((g) => (
              <span key={g} className="text-[10px] px-2 py-0.5 rounded-full bg-surface border border-border font-semibold">
                {g}
              </span>
            ))}
          </div>
        )}

        <div className="mt-4 pt-3 border-t border-border flex-1 flex items-end">
          <Button
            onClick={onAdd}
            disabled={added}
            className="w-full rounded-full gap-1.5 glow-orange"
            size="sm"
          >
            {added ? (<><Check className="h-4 w-4" /> Added</>) : (<><UserPlus className="h-4 w-4" /> Add to Rostr</>)}
          </Button>
        </div>
      </div>
    </div>
  );
}
