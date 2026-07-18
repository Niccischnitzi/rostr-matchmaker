import { useEffect, useMemo, useState } from "react";
import { X, Heart, SlidersHorizontal, MapPin, Sparkles, Megaphone, Gamepad2, Mic, Globe, MessageCircle, UserPlus, Check, ChevronsUpDown } from "lucide-react";
import { useSquadz } from "@/lib/squadz-store";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { sfx } from "@/lib/sfx";
import { LfgAdSheet } from "./LfgAdSheet";
import { YourLfgCard } from "./YourLfgCard";
import { EmptyState } from "./EmptyState";
import { UserAvatar } from "./UserAvatar";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { joinLfgAd, requestFriend, sendDirectMessageToUser } from "@/lib/squadz-supabase";
import { openChat, switchTab } from "@/lib/app-bus";
import type { Player, Trait } from "@/lib/squadz-data";

const allTraits = [
  // Role
  "IGL", "Shot-caller", "Support main", "Entry fragger", "Coach available",
  // Availability
  "Weekend only", "Night owl", "Grinder", "Casual", "Mic'd up",
  // Vibe
  "Chill", "Toxic-free", "Voice-shy", "Funny", "Content creator", "Tryhard", "Competitive", "Beginner-friendly", "LGBTQ+ friendly", "Non-toxic queue",
];
const popularGames = ["Valorant", "League of Legends", "CS2", "Fortnite", "Overwatch 2", "Apex Legends", "Rocket League", "Minecraft", "Marvel Rivals", "Dota 2", "R6 Siege", "PUBG", "Warzone", "Palworld", "The Finals"];
const regions = ["EU", "NA", "SA", "APAC", "OCE", "AF"];
const COUNTRIES = ["Australia","Austria","Belgium","Brazil","Canada","Chile","China","Colombia","Czechia","Denmark","Finland","France","Germany","Greece","Hong Kong","Hungary","India","Indonesia","Ireland","Israel","Italy","Japan","Malaysia","Mexico","Netherlands","New Zealand","Norway","Philippines","Poland","Portugal","Romania","Saudi Arabia","Singapore","South Africa","South Korea","Spain","Sweden","Switzerland","Taiwan","Thailand","Turkey","Ukraine","United Arab Emirates","United Kingdom","United States","Vietnam"];

type DeckCard = Player & { isLfg?: boolean; lfgTitle?: string | null; lfgBody?: string | null; realId?: string; lfgAdId?: string };

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

  // Hydrate durable per-user dismissals so swiped LFG ads stay gone across refreshes.
  useEffect(() => {
    if (!user?.id) { setDismissed(new Set()); return; }
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("lfg_ad_interactions" as any)
        .select("ad_owner_id")
        .eq("user_id", user.id);
      if (cancelled) return;
      const ids = new Set<string>();
      ((data as any[]) ?? []).forEach((r) => { if (r.ad_owner_id) ids.add(`lfg-${r.ad_owner_id}`); });
      setDismissed(ids);
    })();
    return () => { cancelled = true; };
  }, [user?.id]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      let q = supabase
        .from("lfg_ads" as any)
        .select("id, host_id, game, mode, region, description, tags, created_at")
        .is("closed_at", null)
        .gt("expires_at", new Date().toISOString())
        .order("created_at", { ascending: false })
        .limit(30);
      if (user?.id) q = q.neq("host_id", user.id);
      const { data } = await q;
      if (cancelled) return;
      const rows = ((data as any) ?? []) as Array<{
        id: string; host_id: string; game: string; mode: string | null; region: string | null; description: string | null; tags: string[] | null;
      }>;
      const { data: hostRows } = await supabase
        .from("profiles" as any)
        .select("id, username, display_name, avatar_url, country, is_public")
        .in("id", Array.from(new Set(rows.map((r) => r.host_id))));
      const hostById = new Map(((hostRows as any[]) ?? []).filter((h) => h.is_public !== false).map((h) => [h.id, h]));
      // Exclude ads the current user already dismissed/accepted (server-side truth of record).
      let already = new Set<string>();
      if (user?.id) {
        const { data: ints } = await supabase
          .from("lfg_ad_interactions" as any)
          .select("ad_owner_id")
          .eq("user_id", user.id);
        already = new Set(((ints as any[]) ?? []).map((r) => r.ad_owner_id));
      }
      const mapped: DeckCard[] = rows
        .filter((r) => !already.has(r.host_id) && hostById.has(r.host_id))
        .map((r) => {
        const host = hostById.get(r.host_id);
        const username = host?.display_name ?? host?.username ?? "Player";
        return ({
        id: `lfg-${r.id}`,
        realId: r.host_id,
        lfgAdId: r.id,
        username,
        avatar: host?.avatar_url ?? `https://api.dicebear.com/9.x/bottts-neutral/svg?seed=${username}&backgroundColor=ff5722,ff8a4c,1f1f23,2d2d33`,
        playstyle: r.mode ?? "Looking for Rostr",
        location: host?.country ?? r.region ?? "—",
        timezone: "",
        age: 21,
        gender: "NB",
        country: host?.country ?? "",
        games: [r.game, ...((r.tags ?? []).filter((g) => g !== r.game))].slice(0, 4).map((g) => ({ name: g, rank: "", color: "var(--primary)" })),
        traits: [] as Trait[],
        isLfg: true,
        lfgTitle: r.mode,
        lfgBody: r.description,
      });});
      setLfgCards(mapped);
      setLoading(false);
    })();
  }, [user?.id]);

  async function recordInteraction(adOwnerId: string, action: "dismissed" | "accepted") {
    if (!user?.id) return;
    await supabase.from("lfg_ad_interactions" as any).upsert(
      { user_id: user.id, ad_owner_id: adOwnerId, action },
      { onConflict: "user_id,ad_owner_id" },
    );
  }



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
      if (card.lfgAdId) await joinLfgAd(card.lfgAdId);
      await requestFriend(card.realId);
      setExistingFriendIds((prev) => new Set(prev).add(card.realId!));
      const sent = await sendDirectMessageToUser(card.realId, `Hey! Loved your LFG "${card.lfgTitle ?? "post"}" — wanna squad up?`);
      void recordInteraction(card.realId!, "accepted");
      sfx.like();
      toast.success(`Squadded up with ${card.username}!`, {
        description: "Friend request sent + chat opened.",
        action: { label: "Open chat", onClick: () => { switchTab("chat"); openChat({ conversationId: sent.conversation.id }); } },
      });
      switchTab("chat");
      openChat({ conversationId: sent.conversation.id });
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
      else {
        sfx.tap();
        if (top.realId) void recordInteraction(top.realId, "dismissed");
      }
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
    <div className="max-w-2xl mx-auto px-4 pt-6 lg:pt-10 relative">
      {matchBurst && (
        <div className="pointer-events-none fixed inset-0 z-50 grid place-items-center animate-fade-in">
          <div className="absolute inset-0 bg-primary/20 backdrop-blur-sm" />
          <div className="relative animate-scale-in text-center">
            <div className="font-display text-7xl md:text-8xl font-black text-gradient-orange drop-shadow-[0_0_30px_var(--primary)]">
              IT'S A MATCH
            </div>
            <p className="mt-3 text-lg text-white/90 font-semibold">You're both on each other's rostr 🎮</p>
          </div>
        </div>
      )}
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
                <FilterSection label={`Age`}>
                  <div className="pt-6 pb-1 px-1 relative">
                    {/* Live thumb labels — visible at both extremes on mobile. */}
                    <div className="relative h-6 mb-1">
                      <span
                        className="absolute -translate-x-1/2 text-[11px] font-bold px-1.5 py-0.5 rounded-md bg-primary text-primary-foreground shadow"
                        style={{ left: `${((filters.ageRange[0] - 16) / (50 - 16)) * 100}%` }}
                      >{filters.ageRange[0]}</span>
                      <span
                        className="absolute -translate-x-1/2 text-[11px] font-bold px-1.5 py-0.5 rounded-md bg-primary text-primary-foreground shadow"
                        style={{ left: `${((filters.ageRange[1] - 16) / (50 - 16)) * 100}%` }}
                      >{filters.ageRange[1]}</span>
                    </div>
                    <Slider
                      value={filters.ageRange}
                      onValueChange={(v) => setFilters((f) => ({ ...f, ageRange: v as [number, number] }))}
                      min={16}
                      max={50}
                      step={1}
                      minStepsBetweenThumbs={1}
                    />
                    <div className="flex justify-between text-[10px] text-muted-foreground mt-2">
                      <span>16</span><span>50</span>
                    </div>
                  </div>
                </FilterSection>
                <FilterSection label={`Games${filters.games.length ? ` · ${filters.games.length}` : ""}`} icon={Gamepad2}>
                  <GamesMultiSelect
                    value={filters.games}
                    onChange={(games) => setFilters((f) => ({ ...f, games }))}
                  />
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
                  <CountryCombobox
                    value={filters.country}
                    onChange={(country) => setFilters((f) => ({ ...f, country }))}
                  />
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

      <YourLfgCard onEdit={() => setAdOpen(true)} />

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
                <UserAvatar
                  userId={top.realId ?? top.id}
                  avatarUrl={top.avatar}
                  fallback={top.username}
                  size={80}
                  className="rounded-2xl border-4 border-card bg-surface-2 shadow-xl"
                />
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
                    requestFriend(top.realId).then(() => toast.success("Friend request sent")).catch((e) => toast.error(e?.message ?? "Could not send request"));
                  }}>
                    <UserPlus className="h-3.5 w-3.5" /> Friend
                  </Button>
                  <Button variant="outline" size="sm" className="gap-1.5" onClick={async () => {
                    if (!user || !top.realId) return;
                    try {
                      const sent = await sendDirectMessageToUser(top.realId, `Hey — saw your LFG${top.lfgTitle ? ` "${top.lfgTitle}"` : ""}.`);
                      switchTab("chat");
                      openChat({ conversationId: sent.conversation.id });
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

function CountryCombobox({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [open, setOpen] = useState(false);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" role="combobox" className="w-full justify-between rounded-lg bg-surface border-border font-normal">
          <span className={cn("truncate", !value && "text-muted-foreground")}>
            {value || "Any country"}
          </span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="p-0 w-[--radix-popover-trigger-width]" align="start">
        <Command>
          <CommandInput placeholder="Search country…" />
          <CommandList>
            <CommandEmpty>No country found.</CommandEmpty>
            <CommandGroup>
              <CommandItem value="__any" onSelect={() => { onChange(""); setOpen(false); }}>
                <Check className={cn("mr-2 h-4 w-4", !value ? "opacity-100" : "opacity-0")} />
                Any country
              </CommandItem>
              {COUNTRIES.map((c) => (
                <CommandItem key={c} value={c} onSelect={() => { onChange(c); setOpen(false); }}>
                  <Check className={cn("mr-2 h-4 w-4", value === c ? "opacity-100" : "opacity-0")} />
                  {c}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

function GamesMultiSelect({ value, onChange }: { value: string[]; onChange: (v: string[]) => void }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const merged = useMemo(() => {
    const set = new Set([...popularGames, ...value]);
    return Array.from(set);
  }, [value]);
  const trimmed = query.trim();
  const showAdd = trimmed.length > 0 && !merged.some((g) => g.toLowerCase() === trimmed.toLowerCase());
  const toggle = (g: string) => {
    onChange(value.includes(g) ? value.filter((x) => x !== g) : [...value, g]);
  };
  return (
    <div className="space-y-2">
      {value.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {value.map((g) => (
            <button
              key={g}
              onClick={() => toggle(g)}
              className="inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-full bg-primary/15 text-primary border border-primary/30 hover:bg-primary/25"
            >
              {g} <X className="h-3 w-3" />
            </button>
          ))}
        </div>
      )}
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button variant="outline" role="combobox" className="w-full justify-between rounded-lg bg-surface border-border font-normal">
            <span className="text-muted-foreground">{value.length ? "Add / remove games…" : "Select games…"}</span>
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="p-0 w-[--radix-popover-trigger-width]" align="start">
          <Command>
            <CommandInput placeholder="Search or type a game…" value={query} onValueChange={setQuery} />
            <CommandList>
              <CommandEmpty>{showAdd ? "Press add below." : "No games found."}</CommandEmpty>
              <CommandGroup>
                {merged
                  .filter((g) => !trimmed || g.toLowerCase().includes(trimmed.toLowerCase()))
                  .map((g) => (
                    <CommandItem key={g} value={g} onSelect={() => toggle(g)}>
                      <Check className={cn("mr-2 h-4 w-4", value.includes(g) ? "opacity-100" : "opacity-0")} />
                      {g}
                    </CommandItem>
                  ))}
                {showAdd && (
                  <CommandItem
                    value={`__add_${trimmed}`}
                    onSelect={() => { onChange([...value, trimmed]); setQuery(""); }}
                  >
                    <Check className="mr-2 h-4 w-4 opacity-0" />
                    Add "{trimmed}"
                  </CommandItem>
                )}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  );
}
