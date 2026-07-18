import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { submitMatchRating, type Challenge, type Profile, type Wallet } from "@/lib/squadz-supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger } from "@/components/ui/dialog";
import { Slider } from "@/components/ui/slider";
import { Coins, Swords, Trophy, X, Check, Star, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const GAMES = ["Valorant", "CS2", "Apex", "Fortnite", "Rocket League", "FIFA", "CoD"];

export function ChallengesTab() {
  const { user } = useAuth();
  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [challenges, setChallenges] = useState<(Challenge & { challenger: Profile | null; opponent: Profile | null })[]>([]);
  const [loading, setLoading] = useState(true);
  const [ratingTarget, setRatingTarget] = useState<{ challenge: Challenge; player: Profile } | null>(null);

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
      .select("*, challenger:profiles!challenges_challenger_id_fkey(*), opponent:profiles!challenges_opponent_id_fkey(*)")
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
      toast.success(settled ? "Match settled — quick rate unlocked" : "Result reported — waiting for the other player to confirm");
      if (settled) {
        const full = challenges.find((item) => item.id === c.id);
        const other = full ? (full.challenger_id === user?.id ? full.opponent : full.challenger) : null;
        if (other) setRatingTarget({ challenge: c, player: other });
      }
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
        <div className="rounded-2xl border border-dashed border-border p-10 text-center animate-fade-in">
          <Swords className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
          <p className="font-semibold">No challenges yet</p>
          <p className="text-sm text-muted-foreground mt-1">Issue a 1v1 to put your points on the line.</p>
          <div className="mt-4"><NewChallengeDialog onCreated={load} /></div>
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
                {c.status === "settled" && other && (
                  <Button size="sm" className="mt-3 w-full gap-1.5" onClick={() => setRatingTarget({ challenge: c, player: other })}>
                    <Star className="h-4 w-4" /> Quick rate teammate
                  </Button>
                )}
              </div>
            );
          })}
        </div>
      )}
      <QuickRateDialog
        target={ratingTarget}
        onOpenChange={(open) => { if (!open) setRatingTarget(null); }}
      />
    </div>
  );
}

const RATE_TAGS = ["Good comms", "Chill", "Great teammate", "Smart plays", "On time", "Positive vibe", "Clutch", "Reliable"];

function QuickRateDialog({
  target,
  onOpenChange,
}: {
  target: { challenge: Challenge; player: Profile } | null;
  onOpenChange: (open: boolean) => void;
}) {
  const [chemistry, setChemistry] = useState([5]);
  const [comms, setComms] = useState([5]);
  const [reliability, setReliability] = useState([5]);
  const [tags, setTags] = useState<string[]>([]);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const open = Boolean(target);

  async function submit() {
    if (!target || busy) return;
    setBusy(true);
    try {
      await submitMatchRating({
        targetUserId: target.player.id,
        challengeId: target.challenge.id,
        chemistry: chemistry[0],
        comms: comms[0],
        reliability: reliability[0],
        tags,
        note,
      });
      toast.success("Rating saved", { description: "Chemistry score updated for future matchmaking." });
      onOpenChange(false);
      setTags([]); setNote(""); setChemistry([5]); setComms([5]); setReliability([5]);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save rating");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 font-display text-2xl font-black">
            <Sparkles className="h-5 w-5 text-primary" /> Quick rate
          </DialogTitle>
          <DialogDescription>
            Rate your match with {target?.player.display_name || target?.player.username || "this player"}.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-5">
          <RatingSlider label="Chemistry" value={chemistry} onChange={setChemistry} />
          <RatingSlider label="Comms" value={comms} onChange={setComms} />
          <RatingSlider label="Reliability" value={reliability} onChange={setReliability} />
          <div>
            <p className="text-xs font-semibold mb-2">Tags</p>
            <div className="flex flex-wrap gap-2">
              {RATE_TAGS.map((tag) => {
                const on = tags.includes(tag);
                return (
                  <button key={tag} type="button" onClick={() => setTags((cur) => on ? cur.filter((x) => x !== tag) : [...cur, tag].slice(0, 6))}
                    className={cn("text-xs px-3 py-1.5 rounded-full border transition-colors", on ? "bg-primary text-primary-foreground border-primary" : "border-border hover:bg-surface")}>{tag}</button>
                );
              })}
            </div>
          </div>
          <Input value={note} onChange={(e) => setNote(e.target.value)} maxLength={240} placeholder="Optional note" />
          <Button onClick={submit} disabled={busy} className="w-full">{busy ? "Saving…" : "Save rating"}</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function RatingSlider({ label, value, onChange }: { label: string; value: number[]; onChange: (v: number[]) => void }) {
  return (
    <div>
      <div className="mb-2 flex items-center justify-between text-sm font-semibold"><span>{label}</span><span className="text-primary">{value[0]}/5</span></div>
      <Slider value={value} onValueChange={onChange} min={1} max={5} step={1} />
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
      const { data } = await supabase.from("profiles").select("*")
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
        <DialogHeader>
          <DialogTitle>Issue a 1v1</DialogTitle>
          <DialogDescription>Pick an opponent, game, and Shard wager.</DialogDescription>
        </DialogHeader>
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
