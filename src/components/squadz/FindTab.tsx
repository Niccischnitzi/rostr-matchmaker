import { useEffect, useState } from "react";
import { X, Heart, SlidersHorizontal, MapPin, Sparkles, Users, Megaphone } from "lucide-react";
import { useSquadz } from "@/lib/squadz-store";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { sfx } from "@/lib/sfx";
import { LfgAdSheet } from "./LfgAdSheet";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import type { Player, Trait } from "@/lib/squadz-data";

const allTraits = ["Toxic-free", "Tryhard", "Chill", "Shot-caller", "Night Owl", "Funny", "Mic'd up"];

type DeckCard = Player & { isLfg?: boolean; lfgTitle?: string | null; lfgBody?: string | null; realId?: string };

export function FindTab() {
  const { user } = useAuth();
  const { players, connected, swipe } = useSquadz();
  const [ageRange, setAgeRange] = useState([18, 35]);
  const [traitFilter, setTraitFilter] = useState<string[]>([]);
  const [countryFilter, setCountryFilter] = useState("");
  const [adOpen, setAdOpen] = useState(false);

  const [lfgCards, setLfgCards] = useState<DeckCard[]>([]);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());

  useEffect(() => {
    (async () => {
      let q = supabase
        .from("profiles" as any)
        .select("id, username, display_name, avatar_url, lfg_title, lfg_body, lfg_games, country, is_public")
        .eq("is_public", true)
        .not("lfg_title", "is", null)
        .order("updated_at", { ascending: false })
        .limit(20);
      if (user?.id) q = q.neq("id", user.id);
      const { data } = await q;
      const rows = ((data as any) ?? []) as Array<{
        id: string; username: string; display_name: string | null; avatar_url: string | null;
        lfg_title: string | null; lfg_body: string | null; lfg_games: string[] | null; country: string | null;
      }>;
      const mapped: DeckCard[] = rows.map((r) => ({
        id: `lfg-${r.id}`,
        realId: r.id,
        username: r.display_name ?? r.username,
        avatar: r.avatar_url ?? `https://api.dicebear.com/9.x/bottts-neutral/svg?seed=${r.username}&backgroundColor=ff5722,ff8a4c,1f1f23,2d2d33`,
        playstyle: r.lfg_title ?? "Looking for Rostr",
        location: r.country ?? "—",
        timezone: "",
        age: 21,
        gender: "NB",
        country: r.country ?? "",
        games: (r.lfg_games ?? []).slice(0, 4).map((g) => ({ name: g, rank: "", color: "#ff5722" })),
        traits: [] as Trait[],
        isLfg: true,
        lfgTitle: r.lfg_title,
        lfgBody: r.lfg_body,
      }));
      setLfgCards(mapped);
    })();
  }, [user?.id]);

  // Merge: LFG ads first (fresh content), then the mock players
  const deck: DeckCard[] = [
    ...lfgCards.filter((c) => !dismissed.has(c.id)),
    ...players.filter((p) => !dismissed.has(p.id)),
  ];

  const filtered = deck.filter((p) => {
    // Skip age/trait filters for LFG cards (no real data)
    if (p.isLfg) {
      if (countryFilter && !p.country.toLowerCase().includes(countryFilter.toLowerCase())) return false;
      return true;
    }
    if (p.age < ageRange[0] || p.age > ageRange[1]) return false;
    if (countryFilter && !p.country.toLowerCase().includes(countryFilter.toLowerCase())) return false;
    if (traitFilter.length && !traitFilter.some((t) => p.traits.includes(t as never))) return false;
    return true;
  });

  const top = filtered[0];

  async function handleLfgSquad(card: DeckCard) {
    if (!user || !card.realId) return;
    const { error } = await supabase.from("friends").upsert(
      { requester_id: user.id, addressee_id: card.realId, status: "pending" },
      { onConflict: "requester_id,addressee_id" },
    );
    if (error) return toast.error(error.message);
    toast.success(`Added ${card.username} to your rostr!`, { description: "They'll get notified instantly." });
  }

  const handle = (dir: "skip" | "squad") => {
    if (!top) return;
    if (top.isLfg) {
      setDismissed((prev) => new Set(prev).add(top.id));
      if (dir === "squad") { sfx.like(); void handleLfgSquad(top); }
      else sfx.tap();
      return;
    }
    swipe(top.id, dir);
    if (dir === "squad") { sfx.like(); toast.success(`Added ${top.username} to your rostr!`, { description: "They'll get notified instantly." }); }
    else sfx.tap();
  };


  return (
    <div className="max-w-2xl mx-auto px-4 pt-6 lg:pt-10">
      <div className="flex items-end justify-between gap-3 mb-6">
        <div className="min-w-0">
          <h1 className="font-display text-3xl lg:text-4xl font-black tracking-tight">Find your <span className="text-gradient-orange">rostr</span></h1>
          <p className="text-sm text-muted-foreground mt-1">Swipe through players & live LFG ads.</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Button onClick={() => setAdOpen(true)} className="rounded-full h-11 gap-2 hidden sm:flex">
            <Megaphone className="h-4 w-4" /> Post LFG ad
          </Button>
          <Button onClick={() => setAdOpen(true)} size="icon" className="rounded-full h-11 w-11 sm:hidden">
            <Megaphone className="h-4 w-4" />
          </Button>
          <Sheet>
            <SheetTrigger asChild>
              <Button variant="outline" size="icon" className="rounded-full h-11 w-11">
                <SlidersHorizontal className="h-4 w-4" />
              </Button>
            </SheetTrigger>

          <SheetContent side="right" className="w-full sm:max-w-md">
            <SheetHeader><SheetTitle>Filters</SheetTitle></SheetHeader>
            <div className="mt-6 space-y-6 px-4">
              <div>
                <p className="text-sm font-semibold mb-3">Age: {ageRange[0]} – {ageRange[1]}</p>
                <Slider value={ageRange} onValueChange={setAgeRange} min={16} max={50} step={1} />
              </div>
              <div>
                <p className="text-sm font-semibold mb-2">Country</p>
                <input value={countryFilter} onChange={(e) => setCountryFilter(e.target.value)} placeholder="e.g. Germany"
                  className="w-full rounded-lg bg-surface border border-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
              </div>
              <div>
                <p className="text-sm font-semibold mb-2">Traits</p>
                <div className="flex flex-wrap gap-2">
                  {allTraits.map((t) => {
                    const on = traitFilter.includes(t);
                    return (
                      <button key={t}
                        onClick={() => setTraitFilter((prev) => on ? prev.filter((x) => x !== t) : [...prev, t])}
                        className={cn("text-xs px-3 py-1.5 rounded-full border transition-colors",
                          on ? "bg-primary text-primary-foreground border-primary" : "border-border hover:bg-surface")}>{t}</button>
                    );
                  })}
                </div>
              </div>
            </div>
          </SheetContent>
          </Sheet>
        </div>

      </div>
      <LfgAdSheet open={adOpen} onOpenChange={setAdOpen} />


      {/* Card stack */}
      <div className="relative">
        {top ? (
          <div key={top.id} className="relative rounded-3xl border border-border bg-card overflow-hidden shadow-2xl flex flex-col soft-rise">
            <div className="relative h-32 sm:h-40 bg-gradient-to-br from-primary via-orange-600 to-accent">
              <div className="absolute inset-0 opacity-30 overflow-hidden" style={{ backgroundImage: "radial-gradient(circle at 20% 30%, white 1px, transparent 1px), radial-gradient(circle at 70% 60%, white 1px, transparent 1px)", backgroundSize: "40px 40px" }} />
              <div className="absolute top-4 right-4 flex items-center gap-2 z-10">
                {top.isLfg && (
                  <div className="px-2.5 py-1 rounded-full bg-black/50 backdrop-blur text-white text-[10px] font-bold uppercase tracking-wider flex items-center gap-1">
                    <Megaphone className="h-3 w-3" /> LFG
                  </div>
                )}
                <div className="px-3 py-1 rounded-full bg-black/40 backdrop-blur text-white text-xs font-medium flex items-center gap-1.5">
                  <span className="h-1.5 w-1.5 rounded-full bg-success" /> Online
                </div>
              </div>
            </div>
            <div className="relative">
              <div className="absolute -top-12 left-6 z-10">
                <div className="h-20 w-20 rounded-2xl border-4 border-card bg-surface-2 overflow-hidden shadow-xl">
                  <img src={top.avatar} alt={top.username} className="h-full w-full object-cover" />
                </div>
              </div>
            </div>

            <div className="px-6 pt-12 pb-6">

              <div className="flex items-baseline gap-2 flex-wrap">
                <h2 className="font-display text-2xl font-black">{top.username}</h2>
                {!top.isLfg && <span className="text-sm text-muted-foreground">· {top.age}</span>}
              </div>
              <p className="text-sm text-primary font-semibold mt-1">{top.playstyle}</p>
              {(top.location || top.timezone) && (
                <p className="text-xs text-muted-foreground mt-2 flex items-center gap-1.5">
                  <MapPin className="h-3 w-3" /> {top.location}{top.timezone ? ` · ${top.timezone}` : ""}
                </p>
              )}

              {top.isLfg && top.lfgBody && (
                <p className="text-sm mt-3 text-foreground/90">{top.lfgBody}</p>
              )}

              {top.games.length > 0 && (
                <div className="mt-4">
                  <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold mb-2">{top.isLfg ? "Games" : "Main games"}</p>
                  <div className="flex flex-wrap gap-2">
                    {top.games.map((g) => (
                      <div key={g.name} className="flex items-center gap-2 rounded-lg bg-surface px-3 py-1.5 border border-border">
                        <span className="h-2 w-2 rounded-full" style={{ background: g.color }} />
                        <span className="text-xs font-semibold">{g.name}</span>
                        {g.rank && <span className="text-xs text-muted-foreground">{g.rank}</span>}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {top.traits.length > 0 && (
                <div className="mt-4">
                  <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold mb-2">Traits</p>
                  <div className="flex flex-wrap gap-1.5">
                    {top.traits.map((t) => (
                      <span key={t} className="text-xs px-2.5 py-1 rounded-full bg-accent text-accent-foreground border border-primary/20">{t}</span>
                    ))}
                  </div>
                </div>
              )}
            </div>
            <div className="border-t border-border bg-surface/40 p-4 flex items-center justify-center gap-5">
              <button onClick={() => handle("skip")} className="h-14 w-14 rounded-full border-2 border-border bg-card grid place-items-center hover:border-destructive hover:text-destructive transition-colors">
                <X className="h-6 w-6" />
              </button>
              <button onClick={() => handle("squad")} className="h-16 w-16 rounded-full bg-primary text-primary-foreground grid place-items-center glow-orange hover:scale-105 transition-transform">
                <Heart className="h-7 w-7 fill-current" />
              </button>
              <button onClick={() => toast("Super-boost coming soon ✨")} className="h-14 w-14 rounded-full border-2 border-border bg-card grid place-items-center hover:border-primary hover:text-primary transition-colors">
                <Sparkles className="h-6 w-6" />
              </button>
            </div>
          </div>
        ) : (
          <div className="rounded-3xl border border-dashed border-border grid place-items-center text-center px-6 py-16">
            <div>
              <Users className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
              <p className="font-semibold">No more matches</p>
              <p className="text-sm text-muted-foreground mt-1">Adjust filters or check back later.</p>
            </div>
          </div>
        )}
      </div>


      {connected.length > 0 && (
        <div className="mt-8">
          <p className="text-xs uppercase tracking-widest text-muted-foreground font-semibold mb-3">Your rostr ({connected.length})</p>
          <div className="flex gap-3 overflow-x-auto pb-2 -mx-4 px-4">
            {connected.map((c) => (
              <div key={c.id} className="shrink-0 w-20 text-center">
                <img src={c.avatar} alt={c.username} className="h-16 w-16 rounded-2xl object-cover border-2 border-primary mx-auto" />
                <p className="text-xs mt-1 truncate font-medium">{c.username}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
