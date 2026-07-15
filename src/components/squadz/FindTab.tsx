import { useEffect, useMemo, useState } from "react";
import { X, Heart, SlidersHorizontal, MapPin, Sparkles, Megaphone, Gamepad2, Mic, Globe, MessageCircle, UserPlus } from "lucide-react";
import { useSquadz } from "@/lib/squadz-store";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { sfx } from "@/lib/sfx";
import { LfgAdSheet } from "./LfgAdSheet";
import { EmptyState } from "./EmptyState";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { getOrCreateConversation } from "@/lib/squadz-supabase";
import { openChat, switchTab } from "@/lib/app-bus";
import type { Player, Trait } from "@/lib/squadz-data";

const allTraits = ["Toxic-free", "Tryhard", "Chill", "Shot-caller", "Night Owl", "Funny", "Mic'd up"];
const popularGames = ["Valorant", "League of Legends", "CS2", "Fortnite", "Overwatch 2", "Apex Legends", "Rocket League", "Minecraft"];
const regions = ["EU", "NA", "SA", "APAC", "OCE", "AF"];

type DeckCard = Player & { isLfg?: boolean; lfgTitle?: string | null; lfgBody?: string | null; realId?: string };

type Filters = {
  ageRange: [number, number];
  traits: string[];
  country: string;
  games: string[];
  region: string | null;
  micOnly: boolean;
  onlineOnly: boolean;
};

const DEFAULT_FILTERS: Filters = {
  ageRange: [16, 45],
  traits: [],
  country: "",
  games: [],
  region: null,
  micOnly: false,
  onlineOnly: false,
};

export function FindTab() {
  const { user } = useAuth();
  const { players, connected, swipe } = useSquadz();
  const [filters, setFilters] = useState<Filters>(() => {
    try {
      const raw = localStorage.getItem("rostr:find-filters");
      return raw ? { ...DEFAULT_FILTERS, ...JSON.parse(raw) } : DEFAULT_FILTERS;
    } catch { return DEFAULT_FILTERS; }
  });
  const [adOpen, setAdOpen] = useState(false);
  const [lfgCards, setLfgCards] = useState<DeckCard[]>([]);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const [existingFriendIds, setExistingFriendIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [matchBurst, setMatchBurst] = useState<string | null>(null);

  useEffect(() => {
    try { localStorage.setItem("rostr:find-filters", JSON.stringify(filters)); } catch { /* noop */ }
  }, [filters]);

  // Track people I've already added (any status) so they don't reappear in the deck.
  useEffect(() => {
    if (!user?.id) return;
    let cancelled = false;
    const load = async () => {
      const { data } = await supabase
        .from("friends")
        .select("requester_id, addressee_id, status")
        .or(`requester_id.eq.${user.id},addressee_id.eq.${user.id}`);
      if (cancelled) return;
      const ids = new Set<string>();
      ((data as any[]) ?? []).forEach((r) => {
        const other = r.requester_id === user.id ? r.addressee_id : r.requester_id;
        if (other) ids.add(other);
      });
      setExistingFriendIds(ids);
    };
    void load();
    const ch = supabase
      .channel(`find-friends-${user.id}-${Math.random().toString(36).slice(2, 8)}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "friends", filter: `addressee_id=eq.${user.id}` }, (payload: any) => {
        const row = payload.new ?? payload.old;
        if (row?.requester_id) setExistingFriendIds((prev) => new Set(prev).add(row.requester_id));
      })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "friends", filter: `requester_id=eq.${user.id}` }, (payload: any) => {
        const row = payload.new;
        if (row?.status === "accepted" && row?.addressee_id) {
          // Mutual match — the other side accepted my request. Celebrate.
          setMatchBurst(row.addressee_id);
          sfx.like();
          toast.success("It's a match! 🎉", { description: "You're both on each other's rostr now." });
          setTimeout(() => setMatchBurst(null), 1800);
        }
      })
      .subscribe();
    return () => { cancelled = true; supabase.removeChannel(ch); };
  }, [user?.id]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      let q = supabase
        .from("profiles" as any)
        .select("id, username, display_name, avatar_url, lfg_title, lfg_body, lfg_games, country, is_public")
        .eq("is_public", true)
        .not("lfg_title", "is", null)
        .order("updated_at", { ascending: false })
        .limit(30);
      if (user?.id) q = q.neq("id", user.id);
      const { data } = await q;
      if (cancelled) return;
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
        games: (r.lfg_games ?? []).slice(0, 4).map((g) => ({ name: g, rank: "", color: "var(--primary)" })),
        traits: [] as Trait[],
        isLfg: true,
        lfgTitle: r.lfg_title,
        lfgBody: r.lfg_body,
      }));
      setLfgCards(mapped);
      setLoading(false);
    })();
  }, [user?.id]);

  const deck: DeckCard[] = useMemo(() => [
    ...lfgCards.filter((c) => !dismissed.has(c.id)),
    ...players.filter((p) => !dismissed.has(p.id)),
  ], [lfgCards, players, dismissed]);

  const filtered = useMemo(() => deck.filter((p) => {
    if (p.isLfg && user?.id && p.realId === user.id) return false;
    if (p.isLfg && p.realId && existingFriendIds.has(p.realId)) return false;
    if (filters.country && !p.country.toLowerCase().includes(filters.country.toLowerCase())) return false;
    if (filters.games.length && !filters.games.some((g) => p.games.some((pg) => pg.name.toLowerCase() === g.toLowerCase()))) return false;
    if (p.isLfg) return true;
    if (p.age < filters.ageRange[0] || p.age > filters.ageRange[1]) return false;
    if (filters.traits.length && !filters.traits.some((t) => p.traits.includes(t as never))) return false;
    return true;
  }), [deck, filters, user?.id, existingFriendIds]);

  const top = filtered[0];

  async function handleLfgSquad(card: DeckCard) {
    if (!user || !card.realId || busy) return;
    setBusy(true);
    try {
      // 1. Send friend request (idempotent).
      const { error: fErr } = await supabase.from("friends").upsert(
        { requester_id: user.id, addressee_id: card.realId, status: "pending" },
        { onConflict: "requester_id,addressee_id" },
      );
      if (fErr) throw fErr;
      // 2. Open (or get) a DM conversation, drop a first message, then jump.
      const conv = await getOrCreateConversation(user.id, card.realId);
      await supabase.from("direct_messages").insert({
        conversation_id: conv.id,
        sender_id: user.id,
        body: `Hey! Loved your LFG "${card.lfgTitle ?? "post"}" — wanna squad up?`,
      });
      sfx.like();
      toast.success(`Squadded up with ${card.username}!`, {
        description: "Friend request sent + chat opened.",
        action: { label: "Open chat", onClick: () => { switchTab("chat"); openChat({ conversationId: conv.id }); } },
      });
      switchTab("chat");
      openChat({ conversationId: conv.id });
    } catch (e: any) {
      toast.error(e?.message ?? "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  const handle = (dir: "skip" | "squad") => {
    if (!top) return;
    setDismissed((prev) => new Set(prev).add(top.id));
    if (top.isLfg) {
      if (dir === "squad") void handleLfgSquad(top);
      else sfx.tap();
      return;
    }
    swipe(top.id, dir);
    if (dir === "squad") {
      sfx.like();
      toast.success(`Added ${top.username} to your rostr!`, { description: "They'll get notified instantly." });
    } else sfx.tap();
  };

  const activeCount = (filters.games.length + filters.traits.length + (filters.country ? 1 : 0) + (filters.region ? 1 : 0) + (filters.micOnly ? 1 : 0) + (filters.onlineOnly ? 1 : 0));

  return (
    <div className="max-w-2xl mx-auto px-4 pt-6 lg:pt-10">
      <div className="flex items-end justify-between gap-3 mb-4">
        <div className="min-w-0">
          <h1 className="font-display text-3xl lg:text-4xl font-black tracking-tight">
            Find your <span className="text-gradient-orange">rostr</span>
          </h1>
          <p className="text-sm text-muted-foreground mt-1">Swipe through players &amp; live LFG ads.</p>
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
              <Button variant="outline" size="icon" className="rounded-full h-11 w-11 relative">
                <SlidersHorizontal className="h-4 w-4" />
                {activeCount > 0 && (
                  <span className="absolute -top-1 -right-1 h-5 min-w-5 px-1 grid place-items-center rounded-full bg-primary text-primary-foreground text-[10px] font-bold">
                    {activeCount}
                  </span>
                )}
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-full sm:max-w-md overflow-y-auto">
              <SheetHeader><SheetTitle>Filter your search</SheetTitle></SheetHeader>
              <div className="mt-6 space-y-6 px-4 pb-10">
                <FilterSection label={`Age: ${filters.ageRange[0]}–${filters.ageRange[1]}`}>
                  <Slider value={filters.ageRange} onValueChange={(v) => setFilters((f) => ({ ...f, ageRange: v as [number, number] }))} min={16} max={50} step={1} />
                </FilterSection>
                <FilterSection label="Games" icon={Gamepad2}>
                  <ChipGroup options={popularGames} selected={filters.games} onToggle={(g) => setFilters((f) => ({ ...f, games: f.games.includes(g) ? f.games.filter((x) => x !== g) : [...f.games, g] }))} />
                </FilterSection>
                <FilterSection label="Region" icon={Globe}>
                  <div className="flex flex-wrap gap-2">
                    {regions.map((r) => {
                      const on = filters.region === r;
                      return (
                        <button key={r} onClick={() => setFilters((f) => ({ ...f, region: on ? null : r }))}
                          className={cn("text-xs px-3 py-1.5 rounded-full border transition-colors",
                            on ? "bg-primary text-primary-foreground border-primary" : "border-border hover:bg-surface")}>{r}</button>
                      );
                    })}
                  </div>
                </FilterSection>
                <FilterSection label="Country">
                  <input value={filters.country} onChange={(e) => setFilters((f) => ({ ...f, country: e.target.value }))} placeholder="e.g. Germany"
                    className="w-full rounded-lg bg-surface border border-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
                </FilterSection>
                <FilterSection label="Traits">
                  <ChipGroup options={allTraits} selected={filters.traits} onToggle={(t) => setFilters((f) => ({ ...f, traits: f.traits.includes(t) ? f.traits.filter((x) => x !== t) : [...f.traits, t] }))} />
                </FilterSection>
                <FilterSection label="Vibe">
                  <div className="space-y-2">
                    <Toggle icon={Mic} label="Mic'd up only" value={filters.micOnly} onChange={(v) => setFilters((f) => ({ ...f, micOnly: v }))} />
                    <Toggle icon={Sparkles} label="Online now" value={filters.onlineOnly} onChange={(v) => setFilters((f) => ({ ...f, onlineOnly: v }))} />
                  </div>
                </FilterSection>
                <Button variant="outline" onClick={() => setFilters(DEFAULT_FILTERS)} className="w-full">Reset all</Button>
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>

      {activeCount > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-4">
          {filters.games.map((g) => (
            <ActiveChip key={g} label={g} onRemove={() => setFilters((f) => ({ ...f, games: f.games.filter((x) => x !== g) }))} />
          ))}
          {filters.traits.map((t) => (
            <ActiveChip key={t} label={t} onRemove={() => setFilters((f) => ({ ...f, traits: f.traits.filter((x) => x !== t) }))} />
          ))}
          {filters.region && <ActiveChip label={filters.region} onRemove={() => setFilters((f) => ({ ...f, region: null }))} />}
          {filters.country && <ActiveChip label={filters.country} onRemove={() => setFilters((f) => ({ ...f, country: "" }))} />}
          {filters.micOnly && <ActiveChip label="Mic" onRemove={() => setFilters((f) => ({ ...f, micOnly: false }))} />}
        </div>
      )}

      <LfgAdSheet open={adOpen} onOpenChange={setAdOpen} />

      <div className="relative">
        {loading ? (
          <div className="rounded-3xl border border-border bg-card h-[520px] animate-pulse" />
        ) : top ? (
          <div key={top.id} className="hover-spin-inset relative rounded-3xl border border-border bg-card overflow-hidden shadow-2xl flex flex-col soft-rise animate-fade-in">
            <div className="relative h-32 sm:h-40 bg-gradient-to-br from-primary via-[color-mix(in_oklab,var(--primary)_60%,var(--primary-glow))] to-accent">
              <div className="absolute inset-0 opacity-30" style={{ backgroundImage: "radial-gradient(circle at 20% 30%, white 1px, transparent 1px), radial-gradient(circle at 70% 60%, white 1px, transparent 1px)", backgroundSize: "40px 40px" }} />
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
              {top.isLfg && top.lfgBody && <p className="text-sm mt-3 text-foreground/90">{top.lfgBody}</p>}
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
              {top.isLfg && top.realId && (
                <div className="mt-4 grid grid-cols-2 gap-2">
                  <Button variant="outline" size="sm" className="gap-1.5" onClick={() => {
                    if (!user || !top.realId) return;
                    supabase.from("friends").upsert(
                      { requester_id: user.id, addressee_id: top.realId, status: "pending" },
                      { onConflict: "requester_id,addressee_id" },
                    ).then(() => toast.success("Friend request sent"));
                  }}>
                    <UserPlus className="h-3.5 w-3.5" /> Friend
                  </Button>
                  <Button variant="outline" size="sm" className="gap-1.5" onClick={async () => {
                    if (!user || !top.realId) return;
                    try {
                      const conv = await getOrCreateConversation(user.id, top.realId);
                      switchTab("chat");
                      openChat({ conversationId: conv.id });
                    } catch (e: any) { toast.error(e?.message ?? "Couldn't open chat"); }
                  }}>
                    <MessageCircle className="h-3.5 w-3.5" /> Message
                  </Button>
                </div>
              )}
            </div>
            <div className="border-t border-border bg-surface/40 p-4 flex items-center justify-center gap-5">
              <button onClick={() => handle("skip")} disabled={busy} className="h-14 w-14 rounded-full border-2 border-border bg-card grid place-items-center hover:border-destructive hover:text-destructive transition-colors disabled:opacity-50">
                <X className="h-6 w-6" />
              </button>
              <button onClick={() => handle("squad")} disabled={busy} className="h-16 w-16 rounded-full bg-primary text-primary-foreground grid place-items-center glow-orange hover:scale-105 transition-transform disabled:opacity-60">
                <Heart className="h-7 w-7 fill-current" />
              </button>
              <button onClick={() => toast("Super-boost coming soon ✨")} className="h-14 w-14 rounded-full border-2 border-border bg-card grid place-items-center hover:border-primary hover:text-primary transition-colors">
                <Sparkles className="h-6 w-6" />
              </button>
            </div>
          </div>
        ) : (
          <EmptyState
            variant="controller"
            title="You've cleared the deck!"
            body={activeCount > 0 ? "Loosen your filters or check back — new players drop in constantly." : "Post an LFG ad to get discovered by others."}
            action={
              <div className="flex gap-2 justify-center">
                {activeCount > 0 && (
                  <Button variant="outline" onClick={() => setFilters(DEFAULT_FILTERS)}>Reset filters</Button>
                )}
                <Button onClick={() => setAdOpen(true)} className="gap-2">
                  <Megaphone className="h-4 w-4" /> Post LFG
                </Button>
              </div>
            }
          />
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

function FilterSection({ label, icon: Icon, children }: { label: string; icon?: typeof Gamepad2; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-sm font-semibold mb-2 flex items-center gap-1.5">
        {Icon && <Icon className="h-4 w-4 text-primary" />} {label}
      </p>
      {children}
    </div>
  );
}

function ChipGroup({ options, selected, onToggle }: { options: string[]; selected: string[]; onToggle: (v: string) => void }) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((o) => {
        const on = selected.includes(o);
        return (
          <button key={o} onClick={() => onToggle(o)}
            className={cn("text-xs px-3 py-1.5 rounded-full border transition-colors",
              on ? "bg-primary text-primary-foreground border-primary" : "border-border hover:bg-surface")}>{o}</button>
        );
      })}
    </div>
  );
}

function Toggle({ icon: Icon, label, value, onChange }: { icon: typeof Mic; label: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <button onClick={() => onChange(!value)} className={cn(
      "w-full flex items-center gap-2 px-3 py-2 rounded-lg border transition-colors text-sm",
      value ? "bg-primary/10 border-primary text-primary" : "border-border hover:bg-surface",
    )}>
      <Icon className="h-4 w-4" /> {label}
      <span className={cn("ml-auto h-5 w-9 rounded-full relative transition-colors", value ? "bg-primary" : "bg-muted")}>
        <span className={cn("absolute top-0.5 h-4 w-4 rounded-full bg-white transition-all", value ? "left-4" : "left-0.5")} />
      </span>
    </button>
  );
}

function ActiveChip({ label, onRemove }: { label: string; onRemove: () => void }) {
  return (
    <button onClick={onRemove} className="inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-full bg-primary/15 text-primary border border-primary/30 hover:bg-primary/25">
      {label} <X className="h-3 w-3" />
    </button>
  );
}
