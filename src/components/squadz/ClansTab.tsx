import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import type { Clan, ClanMember, ProfileLite } from "@/lib/squadz-supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator, DropdownMenuLabel } from "@/components/ui/dropdown-menu";
import { Plus, Shield, Crown, Swords, Users, MoreVertical, Trash2, UserMinus, ArrowUp, ArrowDown, ArrowRightLeft, Palette } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { CardGridSkeleton } from "@/components/squadz/LoadingSkeletons";
import { UserAvatar } from "@/components/squadz/UserAvatar";

type ClanRole = "leader" | "co_leader" | "officer" | "veteran" | "member" | "recruit";
const ROLE_ORDER: ClanRole[] = ["recruit", "member", "veteran", "officer", "co_leader", "leader"];
const rank = (r: ClanRole) => ROLE_ORDER.indexOf(r);


export function ClansTab() {
  const { user } = useAuth();
  const [clans, setClans] = useState<Clan[]>([]);
  const [myClans, setMyClans] = useState<Clan[]>([]);
  const [active, setActive] = useState<Clan | null>(null);
  const [members, setMembers] = useState<(ClanMember & { profile: ProfileLite | null })[]>([]);
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
    const { data } = await supabase.from("clan_members").select("*, profile:profiles(id, username, display_name, avatar_url, bio)").eq("clan_id", clan.id);
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

function ClanDetail({ clan, members, onBack, onChanged }: { clan: Clan; members: (ClanMember & { profile: ProfileLite | null })[]; onBack: () => void; onChanged: () => void }) {
  const { user } = useAuth();
  const me = members.find((m) => m.user_id === user?.id);
  const myRole = (me?.role as ClanRole | undefined) ?? undefined;
  const isLeader = myRole === "leader";
  const canAdmin = myRole === "leader" || myRole === "co_leader";
  const [confirmLeave, setConfirmLeave] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [transferOpen, setTransferOpen] = useState(false);
  const [cosmeticOpen, setCosmeticOpen] = useState(false);

  async function rpc(name: string, args: Record<string, unknown>, ok: string) {
    const { error } = await supabase.rpc(name as any, args);
    if (error) return toast.error(error.message);
    toast.success(ok);
    onChanged();
  }

  async function leave() {
    if (!user) return;
    const { error } = await supabase.rpc("leave_clan" as any, { _clan: clan.id });
    if (error) return toast.error(error.message);
    toast.success("Left clan");
    setConfirmLeave(false);
    onBack(); onChanged();
  }

  async function del() {
    const { error } = await supabase.rpc("delete_clan" as any, { _clan: clan.id });
    if (error) return toast.error(error.message);
    toast.success("Clan disbanded");
    setConfirmDelete(false);
    onBack(); onChanged();
  }

  async function setRole(userId: string, role: ClanRole) {
    await rpc("set_clan_member_role", { _clan: clan.id, _user: userId, _role: role }, "Rank updated");
  }
  async function kick(userId: string) {
    await rpc("kick_clan_member", { _clan: clan.id, _user: userId }, "Member removed");
  }
  async function transfer(userId: string) {
    const { error } = await supabase.rpc("transfer_clan_leadership" as any, { _clan: clan.id, _new_leader: userId });
    if (error) return toast.error(error.message);
    toast.success("Leadership transferred");
    setTransferOpen(false);
    onChanged();
  }

  const banner = (clan.cosmetic as { accent_hex?: string } | undefined)?.accent_hex;

  return (
    <div className="max-w-3xl mx-auto px-4 pt-6 lg:pt-10">
      <button onClick={onBack} className="text-sm text-muted-foreground hover:text-foreground mb-4">← Back to clans</button>
      <div className="rounded-3xl border border-border bg-card p-6" style={banner ? { boxShadow: `inset 0 0 0 2px ${banner}55` } : undefined}>
        <div className="flex items-start gap-4">
          <div className="h-16 w-16 rounded-2xl grid place-items-center glow-orange" style={{ background: banner || "hsl(var(--primary))" }}>
            <Shield className="h-8 w-8 text-primary-foreground" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-mono text-sm px-2 py-0.5 rounded bg-primary/20 text-primary font-bold">[{clan.tag}]</span>
              <h2 className="font-display text-2xl font-black truncate">{clan.name}</h2>
            </div>
            {clan.description && <p className="text-sm text-muted-foreground mt-1">{clan.description}</p>}
          </div>
          {canAdmin && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="icon" aria-label="Clan admin"><MoreVertical className="h-4 w-4" /></Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuLabel>Admin</DropdownMenuLabel>
                <DropdownMenuItem onClick={() => setCosmeticOpen(true)}><Palette className="h-4 w-4 mr-2" />Clan appearance</DropdownMenuItem>
                {isLeader && <DropdownMenuItem onClick={() => setTransferOpen(true)}><ArrowRightLeft className="h-4 w-4 mr-2" />Transfer leadership</DropdownMenuItem>}
                {isLeader && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem className="text-destructive" onClick={() => setConfirmDelete(true)}>
                      <Trash2 className="h-4 w-4 mr-2" />Delete clan
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
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
          {me && !isLeader && (
            <Button variant="outline" onClick={() => setConfirmLeave(true)}>Leave</Button>
          )}
          {isLeader && members.length === 1 && (
            <Button variant="outline" onClick={() => setConfirmLeave(true)}>Leave</Button>
          )}
        </div>
      </div>

      <div className="mt-6">
        <p className="text-xs uppercase tracking-widest text-muted-foreground font-semibold mb-3">Roster</p>
        <div className="rounded-2xl border border-border divide-y divide-border bg-card">
          {members
            .slice()
            .sort((a, b) => rank(b.role as ClanRole) - rank(a.role as ClanRole))
            .map((m) => {
              const targetRole = m.role as ClanRole;
              const canManage = canAdmin && m.user_id !== user?.id && targetRole !== "leader" && rank(targetRole) < rank(myRole as ClanRole);
              const nextUp = ROLE_ORDER[Math.min(ROLE_ORDER.length - 2, rank(targetRole) + 1)];
              const nextDown = ROLE_ORDER[Math.max(0, rank(targetRole) - 1)];
              return (
                <div key={m.user_id} className="flex items-center gap-3 p-3">
                  <UserAvatar userId={m.user_id} src={m.profile?.avatar_url} name={m.profile?.display_name || m.profile?.username} size={36} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold truncate">{m.profile?.display_name || m.profile?.username || "Player"}</p>
                    <p className="text-xs text-muted-foreground">@{m.profile?.username}</p>
                  </div>
                  <span className={cn(
                    "text-[10px] uppercase tracking-wider font-bold px-2 py-1 rounded-full flex items-center gap-1",
                    targetRole === "leader"    && "bg-primary/20 text-primary ring-1 ring-primary/40",
                    targetRole === "co_leader" && "bg-amber-500/20 text-amber-600 dark:text-amber-400 ring-1 ring-amber-500/40",
                    targetRole === "officer"   && "bg-accent text-accent-foreground",
                    targetRole === "veteran"   && "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 ring-1 ring-emerald-500/30",
                    targetRole === "member"    && "bg-surface text-muted-foreground",
                    targetRole === "recruit"   && "bg-surface/60 text-muted-foreground/70 border border-dashed border-border",
                  )}>
                    {targetRole === "leader" && <Crown className="h-3 w-3" />}
                    {String(targetRole).replace("_", "-")}
                  </span>
                  {canManage && (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" aria-label="Manage member"><MoreVertical className="h-4 w-4" /></Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        {rank(targetRole) < rank(myRole as ClanRole) - 1 && (
                          <DropdownMenuItem onClick={() => setRole(m.user_id, nextUp)}>
                            <ArrowUp className="h-4 w-4 mr-2" />Promote to {nextUp.replace("_", "-")}
                          </DropdownMenuItem>
                        )}
                        {rank(targetRole) > 0 && (
                          <DropdownMenuItem onClick={() => setRole(m.user_id, nextDown)}>
                            <ArrowDown className="h-4 w-4 mr-2" />Demote to {nextDown.replace("_", "-")}
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuSeparator />
                        <DropdownMenuItem className="text-destructive" onClick={() => kick(m.user_id)}>
                          <UserMinus className="h-4 w-4 mr-2" />Kick from clan
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                </div>
              );
            })}
        </div>
      </div>

      <Dialog open={confirmLeave} onOpenChange={setConfirmLeave}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Leave [{clan.tag}]?</DialogTitle>
            <DialogDescription>
              {isLeader ? "You're the only one left — leaving disbands the clan." : "You'll lose your rank and clan chat access."}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmLeave(false)}>Cancel</Button>
            <Button variant="destructive" onClick={leave}>Leave</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete [{clan.tag}] permanently?</DialogTitle>
            <DialogDescription>All members are removed. This cannot be undone.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmDelete(false)}>Cancel</Button>
            <Button variant="destructive" onClick={del}>Delete clan</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={transferOpen} onOpenChange={setTransferOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Transfer leadership</DialogTitle>
            <DialogDescription>Pick a member — you'll become co-leader.</DialogDescription>
          </DialogHeader>
          <div className="max-h-72 overflow-auto divide-y divide-border">
            {members.filter((m) => m.user_id !== user?.id).map((m) => (
              <button
                key={m.user_id}
                onClick={() => transfer(m.user_id)}
                className="w-full text-left p-3 hover:bg-surface flex items-center gap-3"
              >
                <UserAvatar userId={m.user_id} src={m.profile?.avatar_url} name={m.profile?.username} size={32} />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold truncate">{m.profile?.display_name || m.profile?.username}</p>
                  <p className="text-xs text-muted-foreground">{String(m.role).replace("_", "-")}</p>
                </div>
              </button>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      <ClanCosmeticDialog open={cosmeticOpen} onOpenChange={setCosmeticOpen} clan={clan} onChanged={onChanged} />
    </div>
  );
}

function ClanCosmeticDialog({ open, onOpenChange, clan, onChanged }: { open: boolean; onOpenChange: (v: boolean) => void; clan: Clan; onChanged: () => void }) {
  const initial = (clan.cosmetic as { accent_hex?: string; tag_style?: string } | undefined) ?? {};
  const [accent, setAccent] = useState(initial.accent_hex ?? "#F97316");
  const [tagStyle, setTagStyle] = useState(initial.tag_style ?? "bold");
  const [busy, setBusy] = useState(false);

  async function save() {
    setBusy(true);
    const { error } = await supabase.rpc("update_clan_cosmetic" as any, {
      _clan: clan.id,
      _cosmetic: { accent_hex: accent, tag_style: tagStyle },
    });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Clan look updated");
    onChanged();
    onOpenChange(false);
  }

  const presets = ["#F97316", "#3B82F6", "#A855F7", "#22C55E", "#EF4444", "#EAB308", "#EC4899", "#14B8A6"];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Clan appearance</DialogTitle>
          <DialogDescription>Accent shows on the clan card, banner, and roster chips.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <p className="text-xs font-semibold mb-2">Accent</p>
            <div className="flex flex-wrap gap-2">
              {presets.map((c) => (
                <button
                  key={c}
                  onClick={() => setAccent(c)}
                  aria-label={`Accent ${c}`}
                  className={cn("h-9 w-9 rounded-full ring-2 transition", accent === c ? "ring-foreground" : "ring-transparent")}
                  style={{ background: c }}
                />
              ))}
              <input type="color" value={accent} onChange={(e) => setAccent(e.target.value)} className="h-9 w-9 rounded-full overflow-hidden border border-border bg-transparent" />
            </div>
          </div>
          <div>
            <p className="text-xs font-semibold mb-2">Tag style</p>
            <div className="flex gap-2">
              {(["bold", "outline", "gradient"] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setTagStyle(t)}
                  className={cn("px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider border transition",
                    tagStyle === t ? "bg-primary text-primary-foreground border-primary" : "bg-surface border-border text-muted-foreground")}
                >{t}</button>
              ))}
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={save} disabled={busy}>{busy ? "Saving…" : "Save"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
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
