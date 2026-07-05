import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import type { Clan, ClanMember, Profile } from "@/lib/squadz-supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, Shield, Crown, Swords, Users } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export function ClansTab() {
  const { user } = useAuth();
  const [clans, setClans] = useState<Clan[]>([]);
  const [myClans, setMyClans] = useState<Clan[]>([]);
  const [active, setActive] = useState<Clan | null>(null);
  const [members, setMembers] = useState<(ClanMember & { profile: Profile | null })[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void loadClans();
  }, [user?.id]);

  async function loadClans() {
    setLoading(true);
    const [all, mine] = await Promise.all([
      supabase.from("clans").select("*").order("elo", { ascending: false }).limit(50),
      user ? supabase.from("clan_members").select("clan_id, clans(*)").eq("user_id", user.id) : Promise.resolve({ data: [], error: null }),
    ]);
    if (all.data) setClans(all.data);
    if (mine.data) setMyClans((mine.data as { clans: Clan }[]).map((r) => r.clans).filter(Boolean));
    setLoading(false);
  }

  async function openClan(clan: Clan) {
    setActive(clan);
    const { data } = await supabase.from("clan_members").select("*, profile:profiles(*)").eq("clan_id", clan.id);
    if (data) setMembers(data as never);
  }

  async function joinClan(clan: Clan) {
    if (!user) return;
    const { error } = await supabase.from("clan_members").insert({ clan_id: clan.id, user_id: user.id, role: "member" });
    if (error) return toast.error(error.message);
    toast.success(`Joined [${clan.tag}]`);
    void loadClans();
  }

  if (active) return <ClanDetail clan={active} members={members} onBack={() => setActive(null)} onChanged={loadClans} />;

  return (
    <div className="max-w-5xl mx-auto px-4 pt-6 lg:pt-10">
      <div className="flex items-end justify-between gap-3 mb-6">
        <div>
          <h1 className="font-display text-3xl lg:text-4xl font-black tracking-tight">
            Your <span className="text-gradient-orange">Clans</span>
          </h1>
          <p className="text-sm text-muted-foreground mt-1">Competitive rosters · ELO · clan wars.</p>
        </div>
        <CreateClanDialog onCreated={loadClans} />
      </div>

      {myClans.length > 0 && (
        <section className="mb-8">
          <p className="text-xs uppercase tracking-widest text-muted-foreground font-semibold mb-3">Member of</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {myClans.map((c) => <ClanCard key={c.id} clan={c} onClick={() => openClan(c)} mine />)}
          </div>
        </section>
      )}

      <section>
        <p className="text-xs uppercase tracking-widest text-muted-foreground font-semibold mb-3">Top clans</p>
        {loading ? <CardGridSkeleton count={6} /> : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {clans.map((c) => (
              <ClanCard key={c.id} clan={c}
                onClick={() => openClan(c)}
                action={myClans.some((m) => m.id === c.id) ? undefined : <Button size="sm" variant="outline" onClick={(e) => { e.stopPropagation(); void joinClan(c); }}>Join</Button>}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function ClanCard({ clan, onClick, action, mine }: { clan: Clan; onClick: () => void; action?: React.ReactNode; mine?: boolean }) {
  return (
    <button onClick={onClick} className={cn(
      "hover-spin-ring text-left rounded-2xl border border-border bg-card p-4 hover:border-primary/40 transition-all animate-fade-in",
      mine && "border-primary/40 bg-primary/5"
    )}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="font-mono text-xs px-2 py-0.5 rounded bg-primary/20 text-primary font-bold">[{clan.tag}]</span>
            <h3 className="font-display font-bold truncate">{clan.name}</h3>
          </div>
          {clan.description && <p className="text-xs text-muted-foreground mt-2 line-clamp-2">{clan.description}</p>}
          <div className="mt-3 flex items-center gap-3 text-xs text-muted-foreground">
            <span className="flex items-center gap-1"><Shield className="h-3 w-3" />{clan.elo}</span>
            <span className="flex items-center gap-1"><Users className="h-3 w-3" />{clan.member_count}/{clan.max_members}</span>
          </div>
        </div>
        {action}
      </div>
    </button>
  );
}

function CreateClanDialog({ onCreated }: { onCreated: () => void }) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [tag, setTag] = useState("");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit() {
    if (!user || !tag.trim() || !name.trim()) return;
    setBusy(true);
    const { error } = await supabase.from("clans").insert({
      tag: tag.trim().toUpperCase(), name: name.trim(), description: description.trim() || null, owner_id: user.id,
    });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success(`Clan [${tag.toUpperCase()}] founded`);
    setOpen(false); setTag(""); setName(""); setDescription("");
    onCreated();
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="rounded-full"><Plus className="h-4 w-4 mr-1" />New clan</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Found a clan</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div>
            <p className="text-xs font-semibold mb-1">Tag (2-6 chars)</p>
            <Input value={tag} onChange={(e) => setTag(e.target.value.toUpperCase().slice(0, 6))} placeholder="GHOST" />
          </div>
          <div>
            <p className="text-xs font-semibold mb-1">Name</p>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ghost Protocol" />
          </div>
          <div>
            <p className="text-xs font-semibold mb-1">Description</p>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="What's your clan about?" rows={3} />
          </div>
          <Button onClick={submit} disabled={busy} className="w-full">{busy ? "Creating…" : "Found clan"}</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function ClanDetail({ clan, members, onBack, onChanged }: { clan: Clan; members: (ClanMember & { profile: Profile | null })[]; onBack: () => void; onChanged: () => void }) {
  const { user } = useAuth();
  const isLeader = members.find((m) => m.user_id === user?.id)?.role === "leader";

  async function leave() {
    if (!user) return;
    const { error } = await supabase.from("clan_members").delete().eq("clan_id", clan.id).eq("user_id", user.id);
    if (error) return toast.error(error.message);
    toast.success("Left clan");
    onBack(); onChanged();
  }

  return (
    <div className="max-w-3xl mx-auto px-4 pt-6 lg:pt-10">
      <button onClick={onBack} className="text-sm text-muted-foreground hover:text-foreground mb-4">← Back to clans</button>
      <div className="rounded-3xl border border-border bg-card p-6">
        <div className="flex items-start gap-4">
          <div className="h-16 w-16 rounded-2xl bg-primary grid place-items-center glow-orange">
            <Shield className="h-8 w-8 text-primary-foreground" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-mono text-sm px-2 py-0.5 rounded bg-primary/20 text-primary font-bold">[{clan.tag}]</span>
              <h2 className="font-display text-2xl font-black truncate">{clan.name}</h2>
            </div>
            {clan.description && <p className="text-sm text-muted-foreground mt-1">{clan.description}</p>}
          </div>
        </div>
        <div className="grid grid-cols-3 gap-3 mt-6">
          <Stat label="ELO" value={clan.elo} />
          <Stat label="Members" value={`${clan.member_count}/${clan.max_members}`} />
          <Stat label="Status" value="Active" />
        </div>
        <div className="mt-6 flex gap-2">
          <Button className="flex-1" onClick={() => toast("Clan-war challenge UI coming online — pick a rival clan.")}>
            <Swords className="h-4 w-4 mr-2" />Challenge clan
          </Button>
          {!isLeader && members.some((m) => m.user_id === user?.id) && (
            <Button variant="outline" onClick={leave}>Leave</Button>
          )}
        </div>
      </div>

      <div className="mt-6">
        <p className="text-xs uppercase tracking-widest text-muted-foreground font-semibold mb-3">Roster</p>
        <div className="rounded-2xl border border-border divide-y divide-border bg-card">
          {members.map((m) => (
            <div key={m.user_id} className="flex items-center gap-3 p-3">
              <img src={m.profile?.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${m.user_id}`}
                alt="" className="h-9 w-9 rounded-full bg-surface" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold truncate">{m.profile?.display_name || m.profile?.username || "Player"}</p>
                <p className="text-xs text-muted-foreground">@{m.profile?.username}</p>
              </div>
              <span className={cn(
                "text-[10px] uppercase tracking-wider font-bold px-2 py-1 rounded-full flex items-center gap-1",
                m.role === "leader" && "bg-primary/20 text-primary",
                m.role === "officer" && "bg-accent text-accent-foreground",
                m.role === "member" && "bg-surface text-muted-foreground"
              )}>
                {m.role === "leader" && <Crown className="h-3 w-3" />}
                {m.role}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-xl border border-border bg-surface p-3 text-center">
      <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">{label}</p>
      <p className="font-display font-black text-xl mt-1">{value}</p>
    </div>
  );
}
