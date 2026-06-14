import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import type { Tournament, TournamentEntry, LeaderboardEntry, Profile } from "@/lib/squadz-supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Trophy, Plus, Users, Coins, Medal } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export function TournamentsTab() {
  const { user } = useAuth();
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [entries, setEntries] = useState<Record<string, TournamentEntry[]>>({});
  const [active, setActive] = useState<Tournament | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void load();
  }, []);

  async function load() {
    setLoading(true);
    const { data } = await supabase.from("tournaments").select("*").order("created_at", { ascending: false }).limit(50);
    if (data) {
      setTournaments(data);
      const ids = data.map((t) => t.id);
      if (ids.length) {
        const { data: e } = await supabase.from("tournament_entries").select("*").in("tournament_id", ids);
        if (e) {
          const grouped: Record<string, TournamentEntry[]> = {};
          for (const row of e) (grouped[row.tournament_id] ||= []).push(row);
          setEntries(grouped);
        }
      }
    }
    setLoading(false);
  }

  async function join(t: Tournament) {
    if (!user) return;
    const { error } = await supabase.from("tournament_entries").insert({ tournament_id: t.id, user_id: user.id });
    if (error) return toast.error(error.message);
    toast.success(`Entered ${t.name}`);
    void load();
  }

  if (active) return <TournamentDetail tournament={active} onBack={() => setActive(null)} />;

  return (
    <div className="max-w-5xl mx-auto px-4 pt-6 lg:pt-10">
      <div className="flex items-end justify-between gap-3 mb-6">
        <div>
          <h1 className="font-display text-3xl lg:text-4xl font-black tracking-tight">
            <span className="text-gradient-orange">Tournaments</span>
          </h1>
          <p className="text-sm text-muted-foreground mt-1">Pay entry · climb the leaderboard · split the pot.</p>
        </div>
        <CreateTournamentDialog onCreated={load} />
      </div>

      {loading ? <p className="text-sm text-muted-foreground">Loading…</p> : tournaments.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border p-10 text-center">
          <Trophy className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
          <p className="font-semibold">No tournaments scheduled</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {tournaments.map((t) => {
            const tEntries = entries[t.id] || [];
            const joined = tEntries.some((e) => e.user_id === user?.id);
            const pot = Math.floor(t.entry_fee * tEntries.length * (1 - Number(t.rake_pct) / 100));
            return (
              <div key={t.id} className="rounded-2xl border border-border bg-card overflow-hidden hover:border-primary/40 transition-colors">
                <div className="h-24 bg-gradient-to-br from-primary via-orange-600 to-accent" />
                <div className="p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <h3 className="font-display font-bold truncate">{t.name}</h3>
                      <p className="text-xs text-muted-foreground">{t.game}{t.format ? ` · ${t.format}` : ""}</p>
                    </div>
                    <span className={cn(
                      "text-[10px] uppercase tracking-wider font-bold px-2 py-1 rounded-full",
                      t.status === "open" && "bg-success/20 text-success",
                      t.status === "live" && "bg-primary/20 text-primary animate-pulse",
                      t.status === "completed" && "bg-surface text-muted-foreground",
                    )}>{t.status}</span>
                  </div>
                  <div className="grid grid-cols-3 gap-2 mt-3 text-center">
                    <Stat icon={<Coins className="h-3 w-3" />} label="Entry" value={t.entry_fee} />
                    <Stat icon={<Users className="h-3 w-3" />} label="In" value={tEntries.length} />
                    <Stat icon={<Trophy className="h-3 w-3" />} label="Pot" value={pot} />
                  </div>
                  <div className="flex gap-2 mt-3">
                    <Button size="sm" variant="outline" className="flex-1" onClick={() => setActive(t)}>View</Button>
                    {!joined && t.status === "open" && <Button size="sm" className="flex-1" onClick={() => join(t)}>Enter</Button>}
                    {joined && <Button size="sm" disabled className="flex-1">Entered</Button>}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function Stat({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) {
  return (
    <div className="rounded-lg bg-surface px-2 py-2">
      <p className="text-[9px] uppercase tracking-wider text-muted-foreground font-semibold flex items-center justify-center gap-1">{icon}{label}</p>
      <p className="font-display font-black text-sm mt-0.5">{value}</p>
    </div>
  );
}

function CreateTournamentDialog({ onCreated }: { onCreated: () => void }) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [game, setGame] = useState("Valorant");
  const [format, setFormat] = useState("Solo · Highest score");
  const [entry, setEntry] = useState(100);
  const [description, setDescription] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit() {
    if (!user || !name.trim()) return;
    setBusy(true);
    const { error } = await supabase.from("tournaments").insert({
      name: name.trim(), game, format, entry_fee: entry, description: description.trim() || null, created_by: user.id,
    });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Tournament created");
    setOpen(false); setName(""); setEntry(100); setDescription("");
    onCreated();
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button className="rounded-full"><Plus className="h-4 w-4 mr-1" />Host</Button></DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Host a tournament</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div><p className="text-xs font-semibold mb-1">Name</p><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Friday Night Showdown" /></div>
          <div><p className="text-xs font-semibold mb-1">Game</p><Input value={game} onChange={(e) => setGame(e.target.value)} /></div>
          <div><p className="text-xs font-semibold mb-1">Format</p><Input value={format} onChange={(e) => setFormat(e.target.value)} /></div>
          <div><p className="text-xs font-semibold mb-1">Entry fee (points)</p><Input type="number" min={0} value={entry} onChange={(e) => setEntry(Math.max(0, parseInt(e.target.value) || 0))} /></div>
          <div><p className="text-xs font-semibold mb-1">Description</p><Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} /></div>
          <Button onClick={submit} disabled={busy} className="w-full">{busy ? "Creating…" : "Create"}</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function TournamentDetail({ tournament, onBack }: { tournament: Tournament; onBack: () => void }) {
  const [board, setBoard] = useState<(LeaderboardEntry & { profile: Profile | null })[]>([]);

  useEffect(() => {
    void load();
    const channel = supabase.channel(`lb-${tournament.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "leaderboard_entries", filter: `tournament_id=eq.${tournament.id}` }, () => load())
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [tournament.id]);

  async function load() {
    const { data } = await supabase
      .from("leaderboard_entries")
      .select("*, profile:profiles(*)")
      .eq("tournament_id", tournament.id)
      .order("value", { ascending: false })
      .limit(50);
    if (data) setBoard(data as never);
  }

  return (
    <div className="max-w-3xl mx-auto px-4 pt-6 lg:pt-10">
      <button onClick={onBack} className="text-sm text-muted-foreground hover:text-foreground mb-4">← Back</button>
      <div className="rounded-3xl border border-border bg-card overflow-hidden">
        <div className="h-32 bg-gradient-to-br from-primary via-orange-600 to-accent" />
        <div className="p-6">
          <h2 className="font-display text-2xl font-black">{tournament.name}</h2>
          <p className="text-sm text-muted-foreground mt-1">{tournament.game}{tournament.format ? ` · ${tournament.format}` : ""}</p>
          {tournament.description && <p className="text-sm mt-3">{tournament.description}</p>}
        </div>
      </div>
      <div className="mt-6">
        <p className="text-xs uppercase tracking-widest text-muted-foreground font-semibold mb-3 flex items-center gap-2">
          <Medal className="h-3 w-3" />Live leaderboard
        </p>
        {board.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
            Scores will appear here as stats are ingested from the connected game API.
          </div>
        ) : (
          <div className="rounded-2xl border border-border divide-y divide-border bg-card">
            {board.map((row, i) => (
              <div key={row.id} className="flex items-center gap-3 p-3">
                <span className="font-display font-black text-lg w-6 text-center text-muted-foreground">{i + 1}</span>
                <img src={row.profile?.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${row.user_id}`} alt="" className="h-9 w-9 rounded-full bg-surface" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold truncate">{row.profile?.display_name || row.profile?.username}</p>
                  <p className="text-xs text-muted-foreground">{row.metric}</p>
                </div>
                <p className="font-display font-black text-lg">{Number(row.value).toLocaleString()}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
