import { useEffect, useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Loader2, Megaphone, Eye, Users, Clock, Rocket } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";
import { sfx } from "@/lib/sfx";
import { AvailabilityGrid } from "./AvailabilityGrid";

export function LfgAdSheet({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const { user } = useAuth();
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [games, setGames] = useState("");
  const [isPublic, setIsPublic] = useState(true);
  const [busy, setBusy] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<{ total: number; recent: number; last: string | null }>({ total: 0, recent: 0, last: null });
  const [boostExpiresAt, setBoostExpiresAt] = useState<string | null>(null);
  const [boosting, setBoosting] = useState(false);
  const hasAd = title.trim().length > 0 || body.trim().length > 0 || games.trim().length > 0;

  useEffect(() => {
    if (!open || !user) return;
    setLoading(true);
    supabase.from("profiles" as any).select("is_public, lfg_title, lfg_body, lfg_games").eq("id", user.id).maybeSingle()
      .then(({ data }) => {
        const d = data as any;
        setIsPublic(d?.is_public ?? true);
        setTitle(d?.lfg_title ?? "");
        setBody(d?.lfg_body ?? "");
        setGames(Array.isArray(d?.lfg_games) ? d.lfg_games.join(", ") : "");
        setLoading(false);
      });
    // load view stats
    const since = new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString();
    Promise.all([
      supabase.from("lfg_ad_views" as any).select("id", { count: "exact", head: true }).eq("ad_owner_id", user.id),
      supabase.from("lfg_ad_views" as any).select("id", { count: "exact", head: true }).eq("ad_owner_id", user.id).gte("created_at", since),
      supabase.from("lfg_ad_views" as any).select("created_at").eq("ad_owner_id", user.id).order("created_at", { ascending: false }).limit(1),
    ]).then(([t, r, l]) => {
      setStats({
        total: t.count ?? 0,
        recent: r.count ?? 0,
        last: ((l.data as any)?.[0]?.created_at as string | undefined) ?? null,
      });
    });
    // load active boost
    supabase.from("lfg_boosts" as any)
      .select("expires_at")
      .eq("user_id", user.id)
      .gt("expires_at", new Date().toISOString())
      .order("expires_at", { ascending: false })
      .limit(1)
      .then(({ data }) => setBoostExpiresAt(((data as any)?.[0]?.expires_at as string) ?? null));
  }, [open, user]);

  async function boost(hours: number, cost: number) {
    if (!user) return;
    setBoosting(true);
    const { error } = await supabase.rpc("boost_lfg" as any, { _hours: hours, _cost: cost });
    setBoosting(false);
    if (error) { sfx.error?.(); return toast.error(error.message); }
    sfx.win();
    const expires = new Date(Date.now() + hours * 3600 * 1000).toISOString();
    setBoostExpiresAt(expires);
    toast.success(`Boosted for ${hours}h`, { description: `${cost} Shards spent. You're at the top of the Find page.` });
  }

  async function save() {
    if (!user) return;
    if (!title.trim()) {
      sfx.error?.();
      return toast.error("Add a headline so players can find you");
    }
    setBusy(true);
    const payload = {
      is_public: isPublic,
      lfg_title: title.trim(),
      lfg_body: body.trim() || null,
      lfg_games: games.split(",").map((g) => g.trim()).filter(Boolean),
    };
    const { error } = await supabase.from("profiles" as any).update(payload).eq("id", user.id);
    if (!error) {
      const firstGame = payload.lfg_games[0] ?? "Any game";
      const active = await supabase
        .from("lfg_ads" as any)
        .select("id")
        .eq("host_id", user.id)
        .is("closed_at", null)
        .gt("expires_at", new Date().toISOString())
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      const adPayload = {
        host_id: user.id,
        game: firstGame,
        mode: title.trim(),
        region: null,
        description: body.trim() || title.trim(),
        slots_total: 4,
        mic_required: false,
        min_rank: null,
        tags: payload.lfg_games,
        expires_at: new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString(),
        closed_at: isPublic ? null : new Date().toISOString(),
      };
      const activeAdId = (active.data as any)?.id as string | undefined;
      const adWrite = activeAdId
        ? await supabase.from("lfg_ads" as any).update(adPayload).eq("id", activeAdId)
        : await supabase.from("lfg_ads" as any).insert(adPayload);
      if (adWrite.error) {
        setBusy(false);
        sfx.error?.();
        return toast.error(adWrite.error.message);
      }
    }
    setBusy(false);
    if (error) { sfx.error?.(); return toast.error(error.message); }
    sfx.win();
    toast.success("Your ad is live!");
    onOpenChange(false);
  }

  async function remove() {
    if (!user) return;
    if (!confirm("Delete your LFG ad? It will be removed from the Find page.")) return;
    setDeleting(true);
    const { error } = await supabase
      .from("profiles" as any)
      .update({ lfg_title: null, lfg_body: null, lfg_games: [] })
      .eq("id", user.id);
    if (!error) {
      await supabase
        .from("lfg_ads" as any)
        .update({ closed_at: new Date().toISOString() })
        .eq("host_id", user.id)
        .is("closed_at", null);
    }
    setDeleting(false);
    if (error) { sfx.error?.(); return toast.error(error.message); }
    setTitle(""); setBody(""); setGames("");
    sfx.tap();
    toast.success("LFG ad deleted");
    onOpenChange(false);
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-md overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2"><Megaphone className="h-4 w-4" /> Your LFG ad</SheetTitle>
          <SheetDescription>Tell players what you're looking for. Visible when your profile is public.</SheetDescription>
        </SheetHeader>
        {loading ? (
          <div className="grid place-items-center h-40"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>
        ) : !user ? null : (
          <div className="mt-6 space-y-4 px-4 pb-6">
            <div className="grid grid-cols-3 gap-2">
              <div className="rounded-xl bg-surface border border-border p-3">
                <div className="flex items-center gap-1 text-[10px] uppercase tracking-wider text-muted-foreground font-semibold"><Users className="h-3 w-3" /> Viewers</div>
                <p className="font-display text-2xl font-black mt-0.5">{stats.total}</p>
              </div>
              <div className="rounded-xl bg-surface border border-border p-3">
                <div className="flex items-center gap-1 text-[10px] uppercase tracking-wider text-muted-foreground font-semibold"><Eye className="h-3 w-3" /> 7-day</div>
                <p className="font-display text-2xl font-black mt-0.5">{stats.recent}</p>
              </div>
              <div className="rounded-xl bg-surface border border-border p-3">
                <div className="flex items-center gap-1 text-[10px] uppercase tracking-wider text-muted-foreground font-semibold"><Clock className="h-3 w-3" /> Last</div>
                <p className="font-display text-sm font-black mt-1">{stats.last ? new Date(stats.last).toLocaleDateString(undefined, { month: "short", day: "numeric" }) : "—"}</p>
              </div>
            </div>
            <div className="rounded-xl bg-gradient-to-br from-primary/15 via-surface to-surface border border-primary/30 p-3 space-y-2">
              <div className="flex items-center gap-2">
                <Rocket className="h-4 w-4 text-primary" />
                <p className="text-sm font-bold">Boost LFG</p>
                {boostExpiresAt && new Date(boostExpiresAt) > new Date() && (
                  <span className="ml-auto text-[10px] px-2 py-0.5 rounded-full bg-primary/20 text-primary font-bold">
                    Active · {new Date(boostExpiresAt).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric" })}
                  </span>
                )}
              </div>
              <p className="text-[11px] text-muted-foreground">Pin your ad to the top of the Find page.</p>
              <div className="grid grid-cols-3 gap-2">
                <Button size="sm" variant="outline" disabled={boosting} onClick={() => boost(1, 25)}>1h · 25</Button>
                <Button size="sm" variant="outline" disabled={boosting} onClick={() => boost(6, 100)}>6h · 100</Button>
                <Button size="sm" disabled={boosting} onClick={() => boost(24, 300)}>24h · 300</Button>
              </div>
            </div>
            <div className="flex items-center justify-between p-3 rounded-xl bg-surface border border-border">
              <div>
                <p className="text-sm font-bold">Public profile</p>
                <p className="text-[11px] text-muted-foreground">Show your ad on the Find page.</p>
              </div>
              <Switch checked={isPublic} onCheckedChange={setIsPublic} />
            </div>
            <div>
              <label className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Headline</label>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Looking for chill duo partner" maxLength={80} />
            </div>
            <div>
              <label className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Details</label>
              <Textarea value={body} onChange={(e) => setBody(e.target.value)} placeholder="Evenings EU, no mic OK, focus ranked." maxLength={280} className="min-h-[100px]" />
              <p className="text-[10px] text-muted-foreground text-right mt-1">{body.length}/280</p>
            </div>
            <div>
              <label className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Games (comma separated)</label>
              <Input value={games} onChange={(e) => setGames(e.target.value)} placeholder="Valorant, Apex, CS2" maxLength={120} />
            </div>
            <div>
              <label className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-2 block">Playing times</label>
              <AvailabilityGrid userId={user.id} editable />
              <p className="text-[10px] text-muted-foreground mt-2">Tap blocks to mark when you're usually online. Others see this on your ad.</p>
            </div>
            <div className="flex gap-2 pt-2">
              <Button variant="outline" className="flex-1" onClick={() => onOpenChange(false)} disabled={busy || deleting}>Cancel</Button>
              <Button className="flex-1" onClick={save} disabled={busy || deleting}>
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : hasAd ? "Save ad" : "Post ad"}
              </Button>
            </div>
            {hasAd && (
              <Button
                variant="ghost"
                className="w-full text-destructive hover:text-destructive hover:bg-destructive/10"
                onClick={remove}
                disabled={busy || deleting}
              >
                {deleting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Delete ad
              </Button>
            )}
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
