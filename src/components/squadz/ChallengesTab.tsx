import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import type { Challenge, Profile, Wallet } from "@/lib/squadz-supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Coins, Swords, Trophy, X, Check } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const GAMES = ["Valorant", "CS2", "Apex", "Fortnite", "Rocket League", "FIFA", "CoD"];

export function ChallengesTab() {
  const { user } = useAuth();
  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [challenges, setChallenges] = useState<(Challenge & { challenger: Profile | null; opponent: Profile | null })[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    void load();
    const channel = supabase.channel(`challenges-${user.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "challenges" }, () => load())
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "wallets", filter: `user_id=eq.${user.id}` }, () => loadWallet())
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [user?.id]);

  async function loadWallet() {
    if (!user) return;
    const { data } = await supabase.from("wallets").select("*").eq("user_id", user.id).maybeSingle();
    if (data) setWallet(data);
  }

  async function load() {
    if (!user) return;
    setLoading(true);
    await loadWallet();
    const { data } = await supabase
      .from("challenges")
      .select("*, challenger:profiles!challenges_challenger_id_fkey(id, username, display_name, avatar_url, bio), opponent:profiles!challenges_opponent_id_fkey(id, username, display_name, avatar_url, bio)")
      .or(`challenger_id.eq.${user.id},opponent_id.eq.${user.id}`)
      .order("created_at", { ascending: false });
    if (data) setChallenges(data as never);
    setLoading(false);
  }

  async function respond(c: Challenge, accept: boolean) {
    const { error } = await supabase.rpc(
      accept ? "accept_challenge" : "decline_challenge",
      { _challenge_id: c.id },
    );
    if (error) return toast.error(error.message);
    toast.success(accept ? "Challenge accepted — funds held in escrow" : "Challenge declined");
  }

  async function settle(c: Challenge, winnerId: string) {
    const { data, error } = await supabase.rpc("report_challenge_winner", {
      _challenge_id: c.id,
      _winner_id: winnerId,
    });
    if (error) return toast.error(error.message);
    const settled = (data as { settled?: boolean } | null)?.settled;
    toast.success(settled ? "Match settled — winnings released" : "Result reported — waiting for the other player to confirm");
  }

  return (
    <div className="max-w-3xl mx-auto px-4 pt-6 lg:pt-10">
      <div className="flex items-end justify-between gap-3 mb-6">
        <div>
          <h1 className="font-display text-3xl lg:text-4xl font-black tracking-tight">
            1v1 <span className="text-gradient-orange">Challenges</span>
          </h1>
          <p className="text-sm text-muted-foreground mt-1">Wager points. Winner takes the pot.</p>
        </div>
        <NewChallengeDialog onCreated={load} />
      </div>

      <div className="rounded-2xl border border-border bg-gradient-to-br from-primary/10 to-accent/10 p-5 mb-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="h-12 w-12 rounded-xl bg-primary grid place-items-center glow-orange">
            <Coins className="h-6 w-6 text-primary-foreground" />
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">Wallet</p>
            <p className="font-display text-3xl font-black">{wallet?.balance_points ?? 0}<span className="text-sm text-muted-foreground ml-1">pts</span></p>
          </div>
        </div>
        <div className="text-right text-xs text-muted-foreground">
          <p>Won: <span className="text-success font-semibold">+{wallet?.lifetime_won ?? 0}</span></p>
          <p>Lost: <span className="text-destructive font-semibold">-{wallet?.lifetime_lost ?? 0}</span></p>
        </div>
      </div>

      {loading ? <p className="text-sm text-muted-foreground">Loading…</p> : challenges.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border p-10 text-center">
          <Swords className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
          <p className="font-semibold">No challenges yet</p>
          <p className="text-sm text-muted-foreground mt-1">Issue a 1v1 to put your points on the line.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {challenges.map((c) => {
            const isMe = c.challenger_id === user?.id;
            const other = isMe ? c.opponent : c.challenger;
            const incoming = !isMe && c.status === "pending";
            return (
              <div key={c.id} className="rounded-2xl border border-border bg-card p-4">
                <div className="flex items-center gap-3">
                  <img src={other?.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${other?.id}`} alt="" className="h-10 w-10 rounded-full bg-surface" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold truncate">{isMe ? "vs" : "from"} {other?.display_name || other?.username || "Player"}</p>
                    <p className="text-xs text-muted-foreground">{c.game}{c.format ? ` · ${c.format}` : ""}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-display font-black text-lg flex items-center gap-1"><Coins className="h-4 w-4 text-primary" />{c.wager_points}</p>
                    <span className={cn(
                      "text-[10px] uppercase tracking-wider font-bold px-2 py-0.5 rounded-full",
                      c.status === "pending" && "bg-warning/20 text-warning",
                      c.status === "accepted" && "bg-primary/20 text-primary",
                      c.status === "settled" && "bg-success/20 text-success",
                      c.status === "cancelled" && "bg-surface text-muted-foreground",
                    )}>{c.status}</span>
                  </div>
                </div>
                {incoming && (
                  <div className="flex gap-2 mt-3">
                    <Button size="sm" className="flex-1" onClick={() => respond(c, true)}><Check className="h-4 w-4 mr-1" />Accept</Button>
                    <Button size="sm" variant="outline" className="flex-1" onClick={() => respond(c, false)}><X className="h-4 w-4 mr-1" />Decline</Button>
                  </div>
                )}
                {c.status === "accepted" && (
                  <div className="flex gap-2 mt-3">
                    <Button size="sm" variant="outline" className="flex-1" onClick={() => settle(c, user!.id)}><Trophy className="h-4 w-4 mr-1" />I won</Button>
                    <Button size="sm" variant="outline" className="flex-1" onClick={() => settle(c, other!.id)}>They won</Button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function NewChallengeDialog({ onCreated }: { onCreated: () => void }) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [results, setResults] = useState<Profile[]>([]);
  const [opponent, setOpponent] = useState<Profile | null>(null);
  const [game, setGame] = useState("Valorant");
  const [wager, setWager] = useState(50);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open || !search.trim()) { setResults([]); return; }
    const t = setTimeout(async () => {
      const { data } = await supabase.from("profiles").select("id, username, display_name, avatar_url, bio")
        .ilike("username", `%${search.trim()}%`).neq("id", user?.id ?? "").limit(8);
      if (data) setResults(data);
    }, 200);
    return () => clearTimeout(t);
  }, [search, open, user?.id]);

  async function submit() {
    if (!user || !opponent) return;
    setBusy(true);
    const { error } = await supabase.from("challenges").insert({
      challenger_id: user.id, opponent_id: opponent.id, game, wager_points: wager,
    });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success(`Challenge sent to ${opponent.username}`);
    setOpen(false); setOpponent(null); setSearch(""); setWager(50);
    onCreated();
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="rounded-full"><Swords className="h-4 w-4 mr-1" />Challenge</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Issue a 1v1</DialogTitle></DialogHeader>
        {!opponent ? (
          <div className="space-y-2">
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search players by username…" autoFocus />
            <div className="max-h-60 overflow-y-auto divide-y divide-border">
              {results.map((p) => (
                <button key={p.id} onClick={() => setOpponent(p)} className="w-full flex items-center gap-3 p-2 hover:bg-surface rounded-lg text-left">
                  <img src={p.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${p.id}`} alt="" className="h-8 w-8 rounded-full" />
                  <div><p className="text-sm font-semibold">{p.display_name || p.username}</p><p className="text-xs text-muted-foreground">@{p.username}</p></div>
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="rounded-xl border border-border p-3 flex items-center gap-3">
              <img src={opponent.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${opponent.id}`} alt="" className="h-10 w-10 rounded-full" />
              <div className="flex-1"><p className="text-sm font-semibold">{opponent.display_name || opponent.username}</p><p className="text-xs text-muted-foreground">@{opponent.username}</p></div>
              <Button size="sm" variant="ghost" onClick={() => setOpponent(null)}>Change</Button>
            </div>
            <div>
              <p className="text-xs font-semibold mb-1">Game</p>
              <div className="flex flex-wrap gap-2">
                {GAMES.map((g) => (
                  <button key={g} onClick={() => setGame(g)} className={cn(
                    "text-xs px-3 py-1.5 rounded-full border transition-colors",
                    g === game ? "bg-primary text-primary-foreground border-primary" : "border-border hover:bg-surface"
                  )}>{g}</button>
                ))}
              </div>
            </div>
            <div>
              <p className="text-xs font-semibold mb-1">Wager (points)</p>
              <Input type="number" min={0} value={wager} onChange={(e) => setWager(Math.max(0, parseInt(e.target.value) || 0))} />
              <p className="text-xs text-muted-foreground mt-1">5% rake. Winner nets {Math.floor(wager * 2 * 0.95)} pts.</p>
            </div>
            <Button onClick={submit} disabled={busy} className="w-full">{busy ? "Sending…" : "Send challenge"}</Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
