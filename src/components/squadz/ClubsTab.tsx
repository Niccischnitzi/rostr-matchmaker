import { useEffect, useRef, useState } from "react";
import { ArrowLeft, Hash, Users, Crown, Loader2, Plus, Send, Shield, Swords } from "lucide-react";
import { ClubWars } from "./ClubWars";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import type {
  Club,
  ClubChannel,
  ClubMember,
  ClubMessage,
  Profile,
} from "@/lib/squadz-supabase";
import { fetchProfiles } from "@/lib/squadz-supabase";

type MemberRow = ClubMember & { profile: Profile | null };

export function ClubsTab() {
  const { user } = useAuth();
  const [selected, setSelected] = useState<string | null>(null);
  const [clubs, setClubs] = useState<Club[]>([]);
  const [memberships, setMemberships] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);

  async function reload() {
    if (!user) return;
    const [{ data: allClubs }, { data: myMem }] = await Promise.all([
      supabase.from("clubs").select("*").order("created_at", { ascending: false }),
      supabase.from("club_members").select("club_id").eq("user_id", user.id),
    ]);
    setClubs(allClubs ?? []);
    setMemberships(new Set((myMem ?? []).map((r) => r.club_id)));
    setLoading(false);
  }

  useEffect(() => {
    reload();
    const channel = supabase
      .channel("clubs-list")
      .on("postgres_changes", { event: "*", schema: "public", table: "clubs" }, reload)
      .on("postgres_changes", { event: "*", schema: "public", table: "club_members" }, reload)
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  if (selected) {
    return <ClubDetail clubId={selected} onBack={() => setSelected(null)} onChanged={reload} />;
  }

  const joined = clubs.filter((c) => memberships.has(c.id));
  const discover = clubs.filter((c) => !memberships.has(c.id));

  return (
    <div className="max-w-5xl mx-auto px-4 pt-6 lg:pt-10 pb-10">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="font-display text-3xl lg:text-4xl font-black tracking-tight">Clubs</h1>
          <p className="text-sm text-muted-foreground mt-1">Communities and live text channels.</p>
        </div>
        <Button onClick={() => setShowCreate(true)} className="gap-1.5">
          <Plus className="h-4 w-4" /> Create Club
        </Button>
      </div>

      {loading ? (
        <div className="py-16 grid place-items-center text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
        </div>
      ) : (
        <div className="mt-6">
          {joined.length > 0 && (
            <>
              <SectionLabel>Your clubs</SectionLabel>
              <div className="grid sm:grid-cols-2 gap-3 mb-8">
                {joined.map((c) => (
                  <ClubCard key={c.id} club={c} joined onOpen={() => setSelected(c.id)} />
                ))}
              </div>
            </>
          )}
          <SectionLabel>Discover</SectionLabel>
          {discover.length === 0 ? (
            <p className="text-sm text-muted-foreground py-6">No more clubs to discover — be the first to create one!</p>
          ) : (
            <div className="grid sm:grid-cols-2 gap-3">
              {discover.map((c) => (
                <ClubCard
                  key={c.id}
                  club={c}
                  joined={false}
                  onOpen={() => setSelected(c.id)}
                  onJoin={async () => {
                    if (!user) return;
                    const { error } = await supabase
                      .from("club_members")
                      .insert({ club_id: c.id, user_id: user.id, role: "member" });
                    if (error) toast.error(error.message);
                    else toast.success(`Joined ${c.name}`);
                  }}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {showCreate && (
        <CreateClubModal
          onClose={() => setShowCreate(false)}
          onCreated={(id) => {
            setShowCreate(false);
            setSelected(id);
          }}
        />
      )}
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <p className="text-xs uppercase tracking-widest text-muted-foreground font-semibold mb-3">{children}</p>;
}

function ClubCard({
  club,
  joined,
  onOpen,
  onJoin,
}: {
  club: Club;
  joined: boolean;
  onOpen: () => void;
  onJoin?: () => void;
}) {
  return (
    <div
      onClick={onOpen}
      className="group rounded-2xl border border-border bg-card overflow-hidden cursor-pointer hover:border-primary/40 transition-colors"
    >
      <div className="h-20 relative bg-gradient-to-br from-primary/40 to-primary/10">
        <div className="absolute -bottom-6 left-4 h-12 w-12 rounded-xl bg-card border-4 border-card grid place-items-center font-black text-sm text-primary">
          {(club.tag ?? club.name.slice(0, 3)).toUpperCase().slice(0, 4)}
        </div>
      </div>
      <div className="p-4 pt-8">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="font-bold truncate">{club.name}</p>
            <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
              <Users className="h-3 w-3" />
              {club.member_count} member{club.member_count === 1 ? "" : "s"}
            </p>
          </div>
          {!joined && onJoin && (
            <Button
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                onJoin();
              }}
            >
              Join
            </Button>
          )}
          {joined && <span className="text-[10px] uppercase tracking-wider text-primary font-bold">Joined</span>}
        </div>
        {club.description && <p className="text-xs text-muted-foreground mt-2 line-clamp-2">{club.description}</p>}
      </div>
    </div>
  );
}

function CreateClubModal({ onClose, onCreated }: { onClose: () => void; onCreated: (id: string) => void }) {
  const { user } = useAuth();
  const [name, setName] = useState("");
  const [tag, setTag] = useState("");
  const [description, setDescription] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!user || !name.trim()) return;
    setBusy(true);
    const { data, error } = await supabase
      .from("clubs")
      .insert({
        name: name.trim(),
        tag: tag.trim() || null,
        description: description.trim() || null,
        owner_id: user.id,
      })
      .select("id")
      .single();
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Club created");
    onCreated(data.id);
  }

  return (
    <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm grid place-items-center p-4" onClick={onClose}>
      <form
        className="w-full max-w-md rounded-2xl border border-border bg-card shadow-2xl p-5 space-y-4"
        onClick={(e) => e.stopPropagation()}
        onSubmit={submit}
      >
        <p className="font-bold text-lg">Create a club</p>
        <Field label="Name" value={name} onChange={setName} placeholder="Late Night Loadouts" required />
        <Field label="Tag (optional)" value={tag} onChange={setTag} placeholder="LNL" maxLength={6} />
        <div>
          <label className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">Description</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            placeholder="Who is this club for?"
            className="mt-1 w-full rounded-xl bg-surface border border-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>
        <div className="flex gap-2 justify-end">
          <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
          <Button type="submit" disabled={busy || !name.trim()}>
            {busy && <Loader2 className="h-4 w-4 animate-spin mr-1.5" />}Create
          </Button>
        </div>
      </form>
    </div>
  );
}

/* -------------------- Club Detail -------------------- */

function ClubDetail({ clubId, onBack, onChanged }: { clubId: string; onBack: () => void; onChanged: () => void }) {
  const { user } = useAuth();
  const [club, setClub] = useState<Club | null>(null);
  const [channels, setChannels] = useState<ClubChannel[]>([]);
  const [members, setMembers] = useState<MemberRow[]>([]);
  const [activeChannel, setActiveChannel] = useState<string | null>(null);
  const [view, setView] = useState<"channel" | "members" | "wars">("channel");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      const [{ data: c }, { data: chs }, { data: mems }] = await Promise.all([
        supabase.from("clubs").select("*").eq("id", clubId).single(),
        supabase.from("club_channels").select("*").eq("club_id", clubId).order("position"),
        supabase.from("club_members").select("*").eq("club_id", clubId),
      ]);
      if (cancelled) return;
      setClub(c ?? null);
      setChannels(chs ?? []);
      if (chs && chs.length) setActiveChannel(chs[0].id);
      const profiles = await fetchProfiles((mems ?? []).map((m) => m.user_id));
      const byId = new Map(profiles.map((p) => [p.id, p]));
      setMembers((mems ?? []).map((m) => ({ ...m, profile: byId.get(m.user_id) ?? null })));
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [clubId, user]);

  const myMembership = members.find((m) => m.user_id === user?.id);
  const isOwnerOrOfficer = myMembership?.role === "owner" || myMembership?.role === "officer";

  async function leave() {
    if (!user) return;
    if (myMembership?.role === "owner") {
      toast.error("Owners can't leave. Delete the club instead.");
      return;
    }
    const { error } = await supabase
      .from("club_members")
      .delete()
      .eq("club_id", clubId)
      .eq("user_id", user.id);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Left the club");
    onChanged();
    onBack();
  }

  if (loading || !club) {
    return (
      <div className="max-w-5xl mx-auto px-4 pt-10 pb-10 grid place-items-center text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-4 pt-6 lg:pt-10 pb-10">
      <button onClick={onBack} className="text-sm text-muted-foreground flex items-center gap-1.5 mb-4 hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Back to Clubs
      </button>

      <div className="rounded-3xl border border-border bg-card overflow-hidden">
        <div className="h-28 bg-gradient-to-br from-primary/40 to-primary/10" />
        <div className="p-5">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="font-display text-2xl font-black">{club.name}</h2>
                {club.tag && (
                  <span className="text-xs font-mono px-2 py-0.5 rounded bg-surface border border-border">{club.tag}</span>
                )}
              </div>
              <p className="text-sm text-muted-foreground mt-1 flex items-center gap-1.5">
                <Users className="h-3.5 w-3.5" />
                {club.member_count} member{club.member_count === 1 ? "" : "s"}
              </p>
              {club.description && <p className="mt-3 text-sm text-muted-foreground max-w-xl">{club.description}</p>}
            </div>
            {myMembership && (
              <Button variant="outline" size="sm" onClick={leave} disabled={myMembership.role === "owner"}>
                {myMembership.role === "owner" ? "You're the owner" : "Leave"}
              </Button>
            )}
          </div>
        </div>

        <div className="border-t border-border grid lg:grid-cols-[220px_1fr] min-h-[480px]">
          {/* Channel sidebar */}
          <div className="border-b lg:border-b-0 lg:border-r border-border p-3 space-y-1">
            <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold px-2 py-1">Text channels</p>
            {channels.map((ch) => (
              <button
                key={ch.id}
                onClick={() => {
                  setActiveChannel(ch.id);
                  setView("channel");
                }}
                className={cn(
                  "w-full flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm font-medium text-left",
                  view === "channel" && activeChannel === ch.id ? "bg-primary/15 text-primary" : "text-muted-foreground hover:bg-surface",
                )}
              >
                <Hash className="h-4 w-4" />
                {ch.name}
              </button>
            ))}
            {isOwnerOrOfficer && (
              <NewChannelButton
                clubId={clubId}
                onCreated={(ch) => {
                  setChannels((p) => [...p, ch]);
                  setActiveChannel(ch.id);
                }}
              />
            )}
            <button
              onClick={() => setView("members")}
              className={cn(
                "mt-3 w-full flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm font-medium text-left",
                view === "members" ? "bg-primary/15 text-primary" : "text-muted-foreground hover:bg-surface",
              )}
            >
              <Users className="h-4 w-4" />
              Members
            </button>
          </div>

          {/* Channel / Members content */}
          <div className="min-w-0">
            {view === "channel" && activeChannel ? (
              <ChannelView
                clubId={clubId}
                channelId={activeChannel}
                channelName={channels.find((c) => c.id === activeChannel)?.name ?? ""}
              />
            ) : view === "members" ? (
              <MembersList members={members} />
            ) : (
              <p className="p-6 text-sm text-muted-foreground">No channels yet.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function NewChannelButton({ clubId, onCreated }: { clubId: string; onCreated: (ch: ClubChannel) => void }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setBusy(true);
    const { data, error } = await supabase
      .from("club_channels")
      .insert({ club_id: clubId, name: name.trim().replace(/\s+/g, "-").toLowerCase() })
      .select("*")
      .single();
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    onCreated(data);
    setOpen(false);
    setName("");
  }

  return (
    <div className="px-1">
      {!open ? (
        <button
          onClick={() => setOpen(true)}
          className="w-full mt-1 flex items-center gap-2 rounded-lg px-2 py-1.5 text-xs font-semibold text-muted-foreground hover:bg-surface"
        >
          <Plus className="h-3.5 w-3.5" /> New channel
        </button>
      ) : (
        <form onSubmit={submit} className="flex items-center gap-1 mt-1">
          <input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="channel-name"
            className="flex-1 min-w-0 bg-surface rounded-md px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-primary"
          />
          <button type="submit" disabled={busy} className="text-xs font-bold text-primary px-1.5">OK</button>
          <button type="button" onClick={() => setOpen(false)} className="text-xs text-muted-foreground px-1.5">✕</button>
        </form>
      )}
    </div>
  );
}

function ChannelView({ clubId, channelId, channelName }: { clubId: string; channelId: string; channelName: string }) {
  const { user } = useAuth();
  const [messages, setMessages] = useState<ClubMessage[]>([]);
  const [senderMap, setSenderMap] = useState<Map<string, Profile>>(new Map());
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("club_messages")
        .select("*")
        .eq("channel_id", channelId)
        .order("created_at", { ascending: true });
      if (cancelled) return;
      setMessages(data ?? []);
      const senderIds = Array.from(new Set((data ?? []).map((m) => m.sender_id)));
      const profiles = await fetchProfiles(senderIds);
      if (!cancelled) setSenderMap(new Map(profiles.map((p) => [p.id, p])));
    })();
    return () => {
      cancelled = true;
    };
  }, [channelId]);

  useEffect(() => {
    const channel = supabase
      .channel(`club-${channelId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "club_messages", filter: `channel_id=eq.${channelId}` },
        async (payload) => {
          const m = payload.new as ClubMessage;
          setMessages((prev) => (prev.some((x) => x.id === m.id) ? prev : [...prev, m]));
          if (!senderMap.has(m.sender_id)) {
            const profiles = await fetchProfiles([m.sender_id]);
            setSenderMap((prev) => {
              const next = new Map(prev);
              for (const p of profiles) next.set(p.id, p);
              return next;
            });
          }
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [channelId, senderMap]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    const body = text.trim();
    if (!body || !user || busy) return;
    setBusy(true);
    setText("");
    const { error } = await supabase
      .from("club_messages")
      .insert({ club_id: clubId, channel_id: channelId, sender_id: user.id, body });
    if (error) {
      toast.error(error.message);
      setText(body);
    }
    setBusy(false);
  }

  return (
    <div className="flex flex-col h-[60vh] lg:h-[480px]">
      <div className="px-4 py-3 border-b border-border flex items-center gap-2">
        <Hash className="h-4 w-4 text-muted-foreground" />
        <p className="font-semibold">{channelName}</p>
      </div>
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.length === 0 && (
          <p className="text-center text-sm text-muted-foreground py-6">No messages yet. Start the conversation.</p>
        )}
        {messages.map((m) => {
          const sender = senderMap.get(m.sender_id);
          return (
            <div key={m.id} className="flex items-start gap-3">
              <div className="h-9 w-9 rounded-lg bg-surface-2 grid place-items-center shrink-0 overflow-hidden">
                {sender?.avatar_url ? (
                  <img src={sender.avatar_url} alt="" className="h-full w-full object-cover" />
                ) : (
                  <span className="text-xs font-bold text-muted-foreground">
                    {(sender?.username ?? "?").slice(0, 1).toUpperCase()}
                  </span>
                )}
              </div>
              <div className="min-w-0">
                <div className="flex items-baseline gap-2">
                  <p className="font-semibold text-sm">{sender?.display_name ?? sender?.username ?? "user"}</p>
                  <p className="text-[10px] text-muted-foreground">
                    {new Date(m.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  </p>
                </div>
                <p className="text-sm whitespace-pre-wrap break-words">{m.body}</p>
              </div>
            </div>
          );
        })}
        <div ref={endRef} />
      </div>
      <form onSubmit={send} className="p-3 border-t border-border flex items-center gap-2">
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={`Message #${channelName}`}
          className="flex-1 bg-surface rounded-full px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
        />
        <Button type="submit" size="icon" className="rounded-full h-10 w-10 shrink-0" disabled={busy || !text.trim()}>
          <Send className="h-4 w-4" />
        </Button>
      </form>
    </div>
  );
}

function MembersList({ members }: { members: MemberRow[] }) {
  const ordered = [...members].sort((a, b) => roleRank(a.role) - roleRank(b.role));
  return (
    <div className="p-4 space-y-2">
      {ordered.map((m) => (
        <div key={m.id} className="flex items-center gap-3 rounded-lg p-2 hover:bg-surface">
          <div className="h-9 w-9 rounded-lg bg-surface-2 grid place-items-center overflow-hidden">
            {m.profile?.avatar_url ? (
              <img src={m.profile.avatar_url} alt="" className="h-full w-full object-cover" />
            ) : (
              <span className="text-xs font-bold text-muted-foreground">
                {(m.profile?.username ?? "?").slice(0, 1).toUpperCase()}
              </span>
            )}
          </div>
          <div className="min-w-0 flex-1">
            <p className="font-semibold text-sm truncate">{m.profile?.display_name ?? m.profile?.username ?? "—"}</p>
            <p className="text-xs text-muted-foreground truncate">@{m.profile?.username}</p>
          </div>
          <RoleBadge role={m.role} />
        </div>
      ))}
    </div>
  );
}

function RoleBadge({ role }: { role: string }) {
  const map: Record<string, { label: string; cls: string; icon: typeof Crown }> = {
    owner: { label: "Owner", cls: "bg-primary/15 text-primary border-primary/40", icon: Crown },
    officer: { label: "Officer", cls: "bg-success/15 text-success border-success/40", icon: Shield },
    member: { label: "Member", cls: "bg-surface text-muted-foreground border-border", icon: Users },
    recruit: { label: "Recruit", cls: "bg-surface text-muted-foreground border-border", icon: Users },
  };
  const cfg = map[role] ?? map.member;
  const Icon = cfg.icon;
  return (
    <span className={cn("inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider border rounded-full px-2 py-0.5", cfg.cls)}>
      <Icon className="h-3 w-3" />
      {cfg.label}
    </span>
  );
}

function roleRank(role: string) {
  return { owner: 0, officer: 1, member: 2, recruit: 3 }[role as "owner"] ?? 4;
}

function Field({
  label,
  value,
  onChange,
  ...rest
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
} & Omit<React.InputHTMLAttributes<HTMLInputElement>, "value" | "onChange">) {
  return (
    <label className="block">
      <span className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">{label}</span>
      <input
        {...rest}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 w-full h-11 rounded-xl border border-border bg-surface px-4 text-sm font-medium outline-none focus:border-primary transition"
      />
    </label>
  );
}
