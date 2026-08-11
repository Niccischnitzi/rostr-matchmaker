import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, Loader2, Plus, Search, Send, Users } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { fetchProfiles, type ProfileLite } from "@/lib/squadz-supabase";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { EmptyState } from "./EmptyState";
import { GlowButton } from "./GlowButton";
import { UserAvatar } from "./UserAvatar";

type Group = {
  id: string;
  name: string;
  avatar_url: string | null;
  owner_id: string;
  last_message_at: string;
  created_at: string;
};
type GroupMessage = {
  id: string;
  group_id: string;
  sender_id: string;
  body: string | null;
  attachment_url: string | null;
  created_at: string;
};

export function GroupChats() {
  const { user } = useAuth();
  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState<Group | null>(null);
  const [creating, setCreating] = useState(false);

  const load = useCallback(async () => {
    if (!user) {
      setLoading(false);
      return;
    }
    const { data, error } = await supabase
      .from("group_chats")
      .select("*")
      .order("last_message_at", { ascending: false });
    if (error) toast.error(error.message);
    setGroups((data ?? []) as Group[]);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    load();
    if (!user) return;
    const ch = supabase
      .channel(`groups-${user.id}-${Math.random().toString(36).slice(2, 8)}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "group_chats" }, () => load())
      .on("postgres_changes", { event: "*", schema: "public", table: "group_members" }, () => load())
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [user, load]);

  if (!user) return null;
  if (open) return <GroupWindow group={open} onBack={() => setOpen(null)} />;

  if (loading) {
    return (
      <div className="rounded-2xl border border-border bg-card p-10 grid place-items-center text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" />
      </div>
    );
  }

  return (
    <>
      {groups.length === 0 ? (
        <EmptyState
          variant="cosmic"
          title="No group chats yet"
          body="Round up your rostr — create a squad chat to plan sessions in one place."
          action={
            <GlowButton onClick={() => setCreating(true)} icon={<Plus className="h-5 w-5" />}>
              Create a group
            </GlowButton>
          }
        />
      ) : (
        <>
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm text-muted-foreground">
              {groups.length} group{groups.length === 1 ? "" : "s"}
            </p>
            <Button size="sm" className="gap-1.5" onClick={() => setCreating(true)}>
              <Plus className="h-4 w-4" /> New group
            </Button>
          </div>
          <div className="rounded-2xl border border-border bg-card overflow-hidden">
            {groups.map((g, i) => (
              <button
                key={g.id}
                onClick={() => setOpen(g)}
                className={cn(
                  "w-full flex items-center gap-3 p-4 hover:bg-surface text-left",
                  i > 0 && "border-t border-border",
                )}
              >
                <span className="h-11 w-11 rounded-full bg-surface-2 grid place-items-center shrink-0">
                  <Users className="h-5 w-5 text-muted-foreground" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold truncate">{g.name}</p>
                  <p className="text-xs text-muted-foreground">Group chat</p>
                </div>
              </button>
            ))}
          </div>
        </>
      )}
      {creating && <CreateGroupModal onClose={() => setCreating(false)} onCreated={(g) => { setCreating(false); load(); setOpen(g); }} />}
    </>
  );
}

function CreateGroupModal({ onClose, onCreated }: { onClose: () => void; onCreated: (g: Group) => void }) {
  const { user } = useAuth();
  const [name, setName] = useState("");
  const [q, setQ] = useState("");
  const [friends, setFriends] = useState<ProfileLite[]>([]);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await supabase
        .from("friends")
        .select("requester_id, addressee_id, status")
        .eq("status", "accepted");
      const ids = (data ?? [])
        .map((r) => (r.requester_id === user.id ? r.addressee_id : r.requester_id))
        .filter((id) => id !== user.id);
      if (ids.length) setFriends((await fetchProfiles(ids)) as ProfileLite[]);
    })();
  }, [user]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return friends;
    return friends.filter(
      (p) => p.username.toLowerCase().includes(needle) || (p.display_name ?? "").toLowerCase().includes(needle),
    );
  }, [friends, q]);

  async function create() {
    if (!user || !name.trim()) return;
    setBusy(true);
    try {
      const { data: group, error } = await supabase
        .from("group_chats")
        .insert({ name: name.trim(), owner_id: user.id })
        .select("*")
        .single();
      if (error) throw error;
      const members = Array.from(picked);
      if (members.length) {
        const { error: mErr } = await supabase
          .from("group_members")
          .insert(members.map((id) => ({ group_id: group.id, user_id: id })));
        if (mErr) throw mErr;
      }
      toast.success("Group created");
      onCreated(group as Group);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not create group");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm grid place-items-center p-4" onClick={onClose}>
      <div
        className="w-full max-w-md rounded-2xl border border-border bg-card shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-4 border-b border-border space-y-3">
          <p className="font-bold">New group chat</p>
          <input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Group name"
            className="w-full bg-surface rounded-lg px-3 py-2 text-sm border border-border focus:outline-none focus:ring-2 focus:ring-primary"
          />
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search your rostr…"
              className="w-full bg-surface rounded-lg pl-9 pr-3 py-2 text-sm border border-border focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
        </div>
        <div className="max-h-64 overflow-y-auto">
          {filtered.length === 0 ? (
            <p className="p-6 text-sm text-muted-foreground text-center">Add friends first to invite them here.</p>
          ) : (
            filtered.map((p, i) => {
              const on = picked.has(p.id);
              return (
                <button
                  key={p.id}
                  onClick={() =>
                    setPicked((prev) => {
                      const next = new Set(prev);
                      if (next.has(p.id)) next.delete(p.id);
                      else next.add(p.id);
                      return next;
                    })
                  }
                  className={cn(
                    "w-full flex items-center gap-3 p-3 text-left hover:bg-surface",
                    i > 0 && "border-t border-border",
                    on && "bg-primary/10",
                  )}
                >
                  <UserAvatar userId={p.id} avatarUrl={p.avatar_url} fallback={(p.display_name ?? p.username)?.slice(0, 2)} size={36} />
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold truncate text-sm">{p.display_name ?? p.username}</p>
                    <p className="text-xs text-muted-foreground truncate">@{p.username}</p>
                  </div>
                  {on && <span className="text-xs font-bold text-primary">Added</span>}
                </button>
              );
            })
          )}
        </div>
        <div className="p-4 border-t border-border flex items-center justify-between gap-2">
          <span className="text-xs text-muted-foreground">{picked.size} selected</span>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={onClose}>
              Cancel
            </Button>
            <Button size="sm" disabled={busy || !name.trim()} onClick={create}>
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Create"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

function GroupWindow({ group, onBack }: { group: Group; onBack: () => void }) {
  const { user } = useAuth();
  const [messages, setMessages] = useState<GroupMessage[]>([]);
  const [profiles, setProfiles] = useState<Map<string, ProfileLite>>(new Map());
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const endRef = useRef<HTMLDivElement | null>(null);

  const load = useCallback(async () => {
    const { data, error } = await supabase
      .from("group_messages")
      .select("*")
      .eq("group_id", group.id)
      .order("created_at", { ascending: true });
    if (error) toast.error(error.message);
    const list = (data ?? []) as GroupMessage[];
    setMessages(list);
    const ids = Array.from(new Set(list.map((m) => m.sender_id)));
    if (ids.length) {
      const ps = (await fetchProfiles(ids)) as ProfileLite[];
      setProfiles(new Map(ps.map((p) => [p.id, p])));
    }
    setLoading(false);
  }, [group.id]);

  useEffect(() => {
    load();
    const ch = supabase
      .channel(`group-${group.id}-${Math.random().toString(36).slice(2, 8)}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "group_messages", filter: `group_id=eq.${group.id}` },
        () => load(),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [group.id, load]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  async function send() {
    const body = text.trim();
    if (!user || !body) return;
    setSending(true);
    const { error } = await supabase.from("group_messages").insert({ group_id: group.id, sender_id: user.id, body });
    setSending(false);
    if (error) return toast.error(error.message);
    setText("");
    load();
  }

  return (
    <div className="rounded-2xl border border-border bg-card overflow-hidden flex flex-col h-[70vh]">
      <div className="flex items-center gap-3 p-3 border-b border-border">
        <button onClick={onBack} className="h-9 w-9 grid place-items-center rounded-lg bg-surface hover:bg-surface-2">
          <ArrowLeft className="h-4 w-4" />
        </button>
        <span className="h-9 w-9 rounded-full bg-surface-2 grid place-items-center">
          <Users className="h-4 w-4 text-muted-foreground" />
        </span>
        <div className="min-w-0">
          <p className="font-bold truncate">{group.name}</p>
          <p className="text-[11px] text-muted-foreground">Group chat</p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {loading ? (
          <div className="h-full grid place-items-center">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : messages.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-10">No messages yet — say hi 👋</p>
        ) : (
          messages.map((m) => {
            const mine = m.sender_id === user?.id;
            const p = profiles.get(m.sender_id);
            return (
              <div key={m.id} className={cn("flex gap-2", mine && "flex-row-reverse")}>
                <UserAvatar userId={m.sender_id} avatarUrl={p?.avatar_url} fallback={(p?.display_name ?? p?.username ?? "P").slice(0, 2)} size={28} />
                <div className={cn("max-w-[75%]", mine && "text-right")}>
                  {!mine && (
                    <p className="text-[11px] text-muted-foreground mb-0.5">{p?.display_name ?? p?.username ?? "Player"}</p>
                  )}
                  <div
                    className={cn(
                      "inline-block rounded-2xl px-3 py-2 text-sm",
                      mine ? "bg-primary text-primary-foreground" : "bg-surface",
                    )}
                  >
                    {m.body}
                  </div>
                </div>
              </div>
            );
          })
        )}
        <div ref={endRef} />
      </div>

      <div className="p-3 border-t border-border flex items-center gap-2">
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              send();
            }
          }}
          placeholder="Message the squad…"
          className="flex-1 bg-surface rounded-full px-4 py-2 text-sm border border-border focus:outline-none focus:ring-2 focus:ring-primary"
        />
        <Button size="icon" className="rounded-full" disabled={sending || !text.trim()} onClick={send}>
          {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
        </Button>
      </div>
    </div>
  );
}
