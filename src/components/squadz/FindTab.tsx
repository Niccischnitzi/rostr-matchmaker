import { useState } from "react";
import { X, Heart, SlidersHorizontal, MapPin, Sparkles, Users, Megaphone } from "lucide-react";
import { useSquadz } from "@/lib/squadz-store";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { sfx } from "@/lib/sfx";
import { LfgAdSheet } from "./LfgAdSheet";
import { LfgAdsList } from "./LfgAdsList";

const allTraits = ["Toxic-free", "Tryhard", "Chill", "Shot-caller", "Night Owl", "Funny", "Mic'd up"];


export function FindTab() {
  const { players, connected, swipe } = useSquadz();
  const [ageRange, setAgeRange] = useState([18, 35]);
  const [traitFilter, setTraitFilter] = useState<string[]>([]);
  const [countryFilter, setCountryFilter] = useState("");
  const [adOpen, setAdOpen] = useState(false);


  const filtered = players.filter((p) => {
    if (p.age < ageRange[0] || p.age > ageRange[1]) return false;
    if (countryFilter && !p.country.toLowerCase().includes(countryFilter.toLowerCase())) return false;
    if (traitFilter.length && !traitFilter.some((t) => p.traits.includes(t as never))) return false;
    return true;
  });

  const top = filtered[0];


  const handle = (dir: "skip" | "squad") => {
    if (!top) return;
    swipe(top.id, dir);
    if (dir === "squad") { sfx.like(); toast.success(`Squad request sent to ${top.username}!`, { description: "They'll get notified instantly." }); }
    else sfx.tap();
  };


  return (
    <div className="max-w-2xl mx-auto px-4 pt-6 lg:pt-10">
      <div className="flex items-end justify-between gap-3 mb-6">
        <div>
          <h1 className="font-display text-3xl lg:text-4xl font-black tracking-tight">Find your <span className="text-gradient-orange">squad</span></h1>
          <p className="text-sm text-muted-foreground mt-1">Swipe through players matched to your playstyle.</p>
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
          <div className="relative rounded-3xl border border-border bg-card overflow-hidden shadow-2xl flex flex-col soft-rise">
            <div className="relative h-32 sm:h-40 bg-gradient-to-br from-primary via-orange-600 to-accent">
              <div className="absolute inset-0 opacity-30 overflow-hidden" style={{ backgroundImage: "radial-gradient(circle at 20% 30%, white 1px, transparent 1px), radial-gradient(circle at 70% 60%, white 1px, transparent 1px)", backgroundSize: "40px 40px" }} />
              <div className="absolute top-4 right-4 px-3 py-1 rounded-full bg-black/40 backdrop-blur text-white text-xs font-medium flex items-center gap-1.5 z-10">
                <span className="h-1.5 w-1.5 rounded-full bg-success" /> Online
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
                <span className="text-sm text-muted-foreground">· {top.age}</span>
              </div>
              <p className="text-sm text-primary font-semibold mt-1">{top.playstyle}</p>
              <p className="text-xs text-muted-foreground mt-2 flex items-center gap-1.5">
                <MapPin className="h-3 w-3" /> {top.location} · {top.timezone}
              </p>

              <div className="mt-4">
                <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold mb-2">Main games</p>
                <div className="flex flex-wrap gap-2">
                  {top.games.map((g) => (
                    <div key={g.name} className="flex items-center gap-2 rounded-lg bg-surface px-3 py-1.5 border border-border">
                      <span className="h-2 w-2 rounded-full" style={{ background: g.color }} />
                      <span className="text-xs font-semibold">{g.name}</span>
                      <span className="text-xs text-muted-foreground">{g.rank}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="mt-4">
                <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold mb-2">Traits</p>
                <div className="flex flex-wrap gap-1.5">
                  {top.traits.map((t) => (
                    <span key={t} className="text-xs px-2.5 py-1 rounded-full bg-accent text-accent-foreground border border-primary/20">{t}</span>
                  ))}
                </div>
              </div>
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
          <p className="text-xs uppercase tracking-widest text-muted-foreground font-semibold mb-3">Your squad ({connected.length})</p>
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

      <LfgAdsList />
    </div>
  );
}
