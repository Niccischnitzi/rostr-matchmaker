import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, Send, Gamepad2, MessageSquarePlus, Loader2, Search, Phone, Video, Paperclip } from "lucide-react";
import { ringPeer } from "./IncomingCallListener";
import { sfx } from "@/lib/sfx";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import {
  getOrCreateConversation,
  joinLfgAd,
  requestFriend,
  sendDirectMessageToUser,
  fetchProfiles,
  type Conversation,
  type DirectMessage,
  type Profile,
} from "@/lib/squadz-supabase";
import { FriendsTab } from "./FriendsTab";
import { CallSheet } from "./CallSheet";
import { Attachment, parseAttachment, encodeAttachment } from "./Attachment";
import { UserSafetyActions } from "./UserSafetyActions";
import { EmptyState } from "./EmptyState";
import { GlowButton } from "./GlowButton";
import { UserAvatar } from "./UserAvatar";
import { LfgAdSheet } from "./LfgAdSheet";



type ConvWithPeer = Conversation & {
  peer: Profile | null;
  lastMessage?: DirectMessage;
};

export function ChatTab() {
  const [view, setView] = useState<"chats" | "friends" | "lfg">("chats");
  const [openChat, setOpenChat] = useState<string | null>(null);

  // Cross-tab: FindTab dispatches `rostr:open-chat` with a conversationId.
  useEffect(() => {
    const h = (e: Event) => {
      const d = (e as CustomEvent).detail as { conversationId?: string };
      if (d?.conversationId) { setView("chats"); setOpenChat(d.conversationId); }
    };
    window.addEventListener("rostr:open-chat", h);
    return () => window.removeEventListener("rostr:open-chat", h);
  }, []);

  return (
    <div className="max-w-5xl mx-auto px-4 pt-6 lg:pt-10 pb-10">
      {!openChat && (
        <>
          <h1 className="font-display text-3xl lg:text-4xl font-black tracking-tight">Chat</h1>
          <p className="text-sm text-muted-foreground mt-1 mb-5">Messages, friends, and the LFG board.</p>
          <div className="inline-flex rounded-full bg-surface p-1 border border-border mb-5">
            {([["chats", "Messages"], ["friends", "Friends"], ["lfg", "LFG Board"]] as const).map(([k, l]) => (
              <button
                key={k}
                onClick={() => setView(k)}
                className={cn(
                  "px-4 py-1.5 rounded-full text-sm font-semibold transition-colors",
                  view === k ? "bg-primary text-primary-foreground" : "text-muted-foreground",
                )}
              >
                {l}
              </button>
            ))}
          </div>
        </>
      )}

      {openChat ? (
        <DMWindow conversationId={openChat} onBack={() => setOpenChat(null)} />
      ) : view === "chats" ? (
        <DMList onOpen={setOpenChat} />
      ) : view === "friends" ? (
        <FriendsTab />
      ) : (
        <LFGBoard />
      )}
    </div>
  );
}

/* -------------------- DM List -------------------- */

function DMList({ onOpen }: { onOpen: (id: string) => void }) {
  const { user } = useAuth();
  const [convos, setConvos] = useState<ConvWithPeer[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNew, setShowNew] = useState(false);

  useEffect(() => {
    if (!user) { setLoading(false); return; }
    let cancelled = false;

    async function load() {
      try {
        const { data: rows, error } = await supabase
          .from("conversations")
          .select("*")
          .or(`user_a.eq.${user!.id},user_b.eq.${user!.id}`)
          .order("last_message_at", { ascending: false });
        if (error) throw error;
        const peerIds = (rows ?? []).map((c) => (c.user_a === user!.id ? c.user_b : c.user_a));
        const profiles = await fetchProfiles(peerIds);
        const profileById = new Map(profiles.map((p) => [p.id, p]));

        const convIds = (rows ?? []).map((c) => c.id);
        const lastByConv = new Map<string, DirectMessage>();
        if (convIds.length) {
          const { data: msgs } = await supabase
            .from("direct_messages")
            .select("*")
            .in("conversation_id", convIds)
            .order("created_at", { ascending: false });
          for (const m of msgs ?? []) {
            if (!lastByConv.has(m.conversation_id)) lastByConv.set(m.conversation_id, m);
          }
        }

        if (cancelled) return;
        setConvos(
          (rows ?? []).map((c) => ({
            ...c,
            peer: profileById.get(c.user_a === user!.id ? c.user_b : c.user_a) ?? null,
            lastMessage: lastByConv.get(c.id),
          })),
        );
      } catch (e: any) {
        if (!cancelled) toast.error(e?.message ?? "Could not load conversations");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();

    const channel = supabase
      .channel(`dm-list-${Math.random().toString(36).slice(2)}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "conversations" }, () => load())
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "direct_messages" }, () => load())
      .subscribe();
    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [user]);


  if (!user) return null;

  return (
    <>
      {loading ? (
        <div className="rounded-2xl border border-border bg-card p-10 grid place-items-center text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
        </div>
      ) : convos.length === 0 ? (
        <EmptyState
          variant="cosmic"
          title="No conversations yet"
          body="Start a DM with anyone on your rostr — say hi, swap gamertags, plan a session."
          action={
            <GlowButton onClick={() => setShowNew(true)} icon={<MessageSquarePlus className="h-5 w-5" />}>
              Start a new DM
            </GlowButton>
          }
        />

      ) : (
        <>
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm text-muted-foreground">{convos.length} conversation{convos.length === 1 ? "" : "s"}</p>
            <Button size="sm" onClick={() => setShowNew(true)} className="gap-1.5">
              <MessageSquarePlus className="h-4 w-4" /> New DM
            </Button>
          </div>
          <div className="rounded-2xl border border-border bg-card overflow-hidden">
            {convos.map((c, i) => (
              <button
                key={c.id}
                onClick={() => onOpen(c.id)}
                className={cn(
                  "w-full flex items-center gap-3 p-4 hover:bg-surface text-left",
                  i > 0 && "border-t border-border",
                )}
              >
                <Avatar profile={c.peer} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-semibold truncate">{c.peer?.display_name ?? c.peer?.username ?? "Unknown"}</p>
                    <span className="text-xs text-muted-foreground shrink-0">{relTime(c.last_message_at)}</span>
                  </div>
                  <p className="text-sm text-muted-foreground truncate">
                    {c.lastMessage?.body ?? <span className="italic">No messages yet</span>}
                  </p>
                </div>
              </button>
            ))}
          </div>
        </>
      )}

      {showNew && <NewDMModal onClose={() => setShowNew(false)} onOpen={onOpen} />}
    </>
  );
}

function NewDMModal({ onClose, onOpen }: { onClose: () => void; onOpen: (id: string) => void }) {
  const { user } = useAuth();
  const [q, setQ] = useState("");
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!user) return;
    supabase
      .from("profiles")
      .select("id, username, display_name, avatar_url, bio")
      .neq("id", user.id)
      .order("username")
      .limit(50)
      .then(({ data }) => setProfiles(data ?? []));
  }, [user]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return profiles;
    return profiles.filter(
      (p) =>
        p.username.toLowerCase().includes(needle) ||
        (p.display_name ?? "").toLowerCase().includes(needle),
    );
  }, [profiles, q]);

  async function start(other: Profile) {
    if (!user) return;
    setBusy(true);
    try {
      const conv = await getOrCreateConversation(user.id, other.id);
      onOpen(conv.id);
      onClose();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to open DM");
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
        <div className="p-4 border-b border-border">
          <p className="font-bold">Start a conversation</p>
          <div className="mt-3 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              autoFocus
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search players…"
              className="w-full bg-surface rounded-lg pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
        </div>
        <div className="max-h-80 overflow-y-auto">
          {filtered.length === 0 ? (
            <p className="p-6 text-sm text-muted-foreground text-center">No players found.</p>
          ) : (
            filtered.map((p, i) => (
              <button
                key={p.id}
                disabled={busy}
                onClick={() => start(p)}
                className={cn(
                  "w-full flex items-center gap-3 p-3 hover:bg-surface text-left disabled:opacity-50",
                  i > 0 && "border-t border-border",
                )}
              >
                <Avatar profile={p} />
                <div className="min-w-0">
                  <p className="font-semibold truncate">{p.display_name ?? p.username}</p>
                  <p className="text-xs text-muted-foreground truncate">@{p.username}</p>
                </div>
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

/* -------------------- DM Window -------------------- */

function DMWindow({ conversationId, onBack }: { conversationId: string; onBack: () => void }) {
  const { user } = useAuth();
  const [messages, setMessages] = useState<DirectMessage[]>([]);
  const [peer, setPeer] = useState<Profile | null>(null);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [typingPeer, setTypingPeer] = useState(false);
  const [callOpen, setCallOpen] = useState(false);
  const [callMode, setCallMode] = useState<"audio" | "video">("audio");
  const endRef = useRef<HTMLDivElement>(null);
  const typingChannelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const lastTypingSentRef = useRef(0);

  // Load conversation + peer + messages
  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      const { data: conv } = await supabase
        .from("conversations")
        .select("*")
        .eq("id", conversationId)
        .single();
      if (!conv || cancelled) return;
      const otherId = conv.user_a === user.id ? conv.user_b : conv.user_a;
      const [{ data: profile }, { data: msgs }] = await Promise.all([
        supabase.from("profiles").select("id, username, display_name, avatar_url, bio").eq("id", otherId).single(),
        supabase
          .from("direct_messages")
          .select("*")
          .eq("conversation_id", conversationId)
          .order("created_at", { ascending: true }),
      ]);
      if (cancelled) return;
      setPeer(profile ?? null);
      setMessages(msgs ?? []);

      // Mark unread messages from peer as read
      const unread = (msgs ?? []).filter((m) => m.sender_id === otherId && !m.read_at).map((m) => m.id);
      if (unread.length) {
        await supabase
          .from("direct_messages")
          .update({ read_at: new Date().toISOString() })
          .in("id", unread);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [conversationId, user]);

  // Realtime new messages + read receipts
  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel(`dm-${conversationId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "direct_messages", filter: `conversation_id=eq.${conversationId}` },
        async (payload) => {
          const m = payload.new as DirectMessage;
          setMessages((prev) => (prev.some((x) => x.id === m.id) ? prev : [...prev, m]));
          if (m.sender_id !== user.id) {
            await supabase
              .from("direct_messages")
              .update({ read_at: new Date().toISOString() })
              .eq("id", m.id);
          }
        },
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "direct_messages", filter: `conversation_id=eq.${conversationId}` },
        (payload) => {
          const m = payload.new as DirectMessage;
          setMessages((prev) => prev.map((x) => (x.id === m.id ? m : x)));
        },
      )
      .on("broadcast", { event: "typing" }, (payload) => {
        if (payload.payload?.userId && payload.payload.userId !== user.id) {
          setTypingPeer(true);
          window.clearTimeout((typingChannelRef as any).timeout);
          (typingChannelRef as any).timeout = window.setTimeout(() => setTypingPeer(false), 1800);
        }
      })
      .subscribe();
    typingChannelRef.current = channel;
    return () => {
      supabase.removeChannel(channel);
      typingChannelRef.current = null;
    };
  }, [conversationId, user]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length, typingPeer]);

  function handleTyping(v: string) {
    setText(v);
    if (!typingChannelRef.current || !user) return;
    const now = Date.now();
    if (now - lastTypingSentRef.current > 800) {
      lastTypingSentRef.current = now;
      typingChannelRef.current.send({ type: "broadcast", event: "typing", payload: { userId: user.id } });
    }
  }

  async function send(e: React.FormEvent) {
    e.preventDefault();
    const body = text.trim();
    if (!body || !user || !peer || sending) return;
    setSending(true);
    setText("");
    try {
      await sendDirectMessageToUser(peer.id, body);
    } catch (e: any) {
      toast.error(e?.message ?? "Could not send message");
      setText(body);
    }
    setSending(false);
  }

  if (!user) return null;

  return (
    <div className="rounded-2xl border border-border bg-card flex flex-col h-[calc(100vh-12rem)] lg:h-[calc(100vh-6rem)] overflow-hidden">
      <div className="flex items-center gap-3 p-4 border-b border-border">
        <button onClick={onBack} className="h-9 w-9 rounded-lg hover:bg-surface grid place-items-center">
          <ArrowLeft className="h-4 w-4" />
        </button>
        <Avatar profile={peer} size={10} />
        <div className="min-w-0 flex-1">
          <p className="font-bold truncate">{peer?.display_name ?? peer?.username ?? "…"}</p>
          <p className="text-xs text-muted-foreground">@{peer?.username ?? ""}</p>
        </div>
        <UserSafetyActions targetId={peer?.id} targetLabel={peer?.display_name ?? peer?.username} onBlocked={onBack} />
        <button
          onClick={() => {
            sfx.nav();
            setCallMode("audio");
            setCallOpen(true);
            if (peer) ringPeer({ peerId: peer.id, from: user.id, conversationId, mode: "audio" });
          }}
          className="h-9 w-9 rounded-full bg-success/15 text-success grid place-items-center hover:bg-success/25 hover:scale-110 active:scale-95 transition-all"
          aria-label="Voice call"
          title="Voice call"
        >
          <Phone className="h-4 w-4" />
        </button>
        <button
          onClick={() => {
            sfx.nav();
            setCallMode("video");
            setCallOpen(true);
            if (peer) ringPeer({ peerId: peer.id, from: user.id, conversationId, mode: "video" });
          }}
          className="h-9 w-9 rounded-full bg-primary/15 text-primary grid place-items-center hover:bg-primary/25 hover:scale-110 active:scale-95 transition-all"
          aria-label="Video call"
          title="Video call"
        >
          <Video className="h-4 w-4" />
        </button>
      </div>
      <CallSheet open={callOpen} onClose={() => setCallOpen(false)} peer={peer} conversationId={conversationId} selfId={user.id} role="caller" mode={callMode} />


      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.length === 0 && (
          <p className="text-center text-sm text-muted-foreground py-10">Say hi to {peer?.display_name ?? peer?.username}.</p>
        )}
        {messages.map((m, idx) => {
          const me = m.sender_id === user.id;
          const attach = parseAttachment(m.body ?? "");
          const prev = idx > 0 ? messages[idx - 1] : null;
          const showDate = !prev || !isSameDay(new Date(prev.created_at), new Date(m.created_at));
          return (
            <div key={m.id} className="contents">
              {showDate && (
                <div className="flex justify-center my-2">
                  <span className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground/60 bg-surface/40 px-2.5 py-0.5 rounded-full">
                    {formatDateHeader(new Date(m.created_at))}
                  </span>
                </div>
              )}
              <div className={cn("flex flex-col max-w-[min(280px,80%)] min-w-0 soft-rise", me ? "ml-auto items-end" : "items-start")}>
                {attach ? (
                  <div className={cn("rounded-2xl overflow-hidden", me ? "rounded-br-sm" : "rounded-bl-sm")}>
                    <Attachment meta={attach} me={me} />
                  </div>
                ) : (
                  <div className={cn("rounded-2xl px-4 py-2 text-sm whitespace-pre-wrap break-words overflow-hidden max-w-full", me ? "bg-primary text-primary-foreground rounded-br-sm" : "bg-surface rounded-bl-sm")} style={{ wordBreak: "break-word" }}>
                    {m.body}
                  </div>
                )}
                <p className="text-[10px] text-muted-foreground mt-1 px-2 flex items-center gap-1">
                  {new Date(m.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  {me && m.read_at && <span className="text-primary">· seen</span>}
                </p>
              </div>
            </div>
          );
        })}
        {typingPeer && (
          <div className="flex items-end gap-1 px-2">
            <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground animate-bounce" />
            <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground animate-bounce [animation-delay:120ms]" />
            <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground animate-bounce [animation-delay:240ms]" />
          </div>
        )}
        <div ref={endRef} />
      </div>

      <form onSubmit={(e) => { sfx.send(); send(e); }} className="p-3 border-t border-border flex items-center gap-2">
        <AttachButton conversationId={conversationId} peerId={peer?.id} />
        <input
          value={text}
          onChange={(e) => handleTyping(e.target.value)}
          placeholder="Message…"
          className="flex-1 bg-surface rounded-full px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
        />
        <Button type="submit" size="icon" className="rounded-full h-10 w-10 shrink-0" disabled={sending || !text.trim()}>
          <Send className="h-4 w-4" />
        </Button>
      </form>
    </div>
  );
}

function AttachButton({ conversationId, peerId }: { conversationId: string; peerId?: string | null }) {
  const ref = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  async function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f || !peerId) return;
    if (f.size > 20 * 1024 * 1024) return toast.error("Max 20 MB");
    setBusy(true);
    const ext = (f.name.split(".").pop() || "bin").toLowerCase();
    const path = `${conversationId}/${Date.now()}.${ext}`;
    const { error: upErr } = await supabase.storage.from("dm-attachments").upload(path, f, { contentType: f.type });
    if (upErr) { setBusy(false); return toast.error(upErr.message); }
    const body = encodeAttachment({ path, name: f.name, mime: f.type || "application/octet-stream", size: f.size });
    try {
      await sendDirectMessageToUser(peerId, body);
    } catch (e: any) {
      setBusy(false);
      return toast.error(e?.message ?? "Could not send attachment");
    }
    setBusy(false);
    sfx.send();
  }
  return (
    <>
      <input ref={ref} type="file" hidden onChange={onPick} />
      <button type="button" onClick={() => ref.current?.click()} disabled={busy}
        className="h-10 w-10 rounded-full bg-surface grid place-items-center shrink-0 hover:bg-surface-2">
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Paperclip className="h-4 w-4" />}
      </button>
    </>
  );
}


/* -------------------- LFG Board (real database) -------------------- */

type RealLfg = {
  id: string;
  host_id: string;
  game: string;
  mode: string | null;
  region: string | null;
  description: string | null;
  slots_total: number;
  slots_filled: number;
  mic_required: boolean;
  min_rank: string | null;
  tags: string[] | null;
  expires_at: string;
  created_at: string;
  host?: Profile | null;
};

function LFGBoard() {
  const { user } = useAuth();
  const [rows, setRows] = useState<RealLfg[]>([]);
  const [loading, setLoading] = useState(true);
  const [posting, setPosting] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("lfg_ads" as any)
        .select("id, host_id, game, mode, region, description, slots_total, slots_filled, mic_required, min_rank, tags, expires_at, created_at")
        .is("closed_at", null)
        .gt("expires_at", new Date().toISOString())
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      const list = ((data as any[]) ?? []) as RealLfg[];
      const profiles = await fetchProfiles(Array.from(new Set(list.map((r) => r.host_id))));
      const byId = new Map(profiles.map((p) => [p.id, p]));
      setRows(list.map((r) => ({ ...r, host: byId.get(r.host_id) ?? null })));
    } catch (e: any) {
      toast.error(e?.message ?? "Could not load LFG board");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
    const ch = supabase
      .channel(`lfg-board-${Math.random().toString(36).slice(2, 8)}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "lfg_ads" }, () => void load())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);

  async function join(row: RealLfg) {
    if (!user || busy) return;
    setBusy(row.id);
    try {
      await joinLfgAd(row.id);
      await requestFriend(row.host_id);
      const sent = await sendDirectMessageToUser(row.host_id, `Joined your ${row.game} LFG — ready to squad up?`);
      toast.success("Joined LFG", { description: "Friend request sent and DM opened." });
      window.dispatchEvent(new CustomEvent("rostr:open-chat", { detail: { conversationId: sent.conversation.id } }));
      await load();
    } catch (e: any) {
      toast.error(e?.message ?? "Could not join LFG");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-muted-foreground">{rows.length} active ticket{rows.length === 1 ? "" : "s"}</p>
        <Button size="sm" onClick={() => setPosting(true)}>Post LFG</Button>
      </div>

      <LfgAdSheet open={posting} onOpenChange={(v: boolean) => { setPosting(v); if (!v) void load(); }} />

      <div className="grid gap-3">
        {loading ? (
          <div className="rounded-2xl border border-border bg-card p-10 grid place-items-center text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
          </div>
        ) : rows.length === 0 ? (
          <EmptyState
            variant="controller"
            title="No LFGs live"
            body="Post the first squad ticket and make the board feel alive."
            action={<GlowButton onClick={() => setPosting(true)} icon={<Gamepad2 className="h-5 w-5" />}>Post LFG</GlowButton>}
          />
        ) : rows.map((t) => {
          const openSlots = Math.max(0, t.slots_total - t.slots_filled);
          const hostName = t.host?.display_name ?? t.host?.username ?? "Player";
          return (
          <div key={t.id} className="rounded-2xl border border-border bg-card p-4 flex items-center gap-4 soft-rise">
            <div className="h-12 w-12 rounded-xl bg-primary/15 text-primary grid place-items-center shrink-0">
              <Gamepad2 className="h-6 w-6" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-baseline gap-2 flex-wrap">
                <p className="font-bold">{t.game}</p>
                <span className="text-xs text-muted-foreground">· {t.mode ?? "Squad"}</span>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                {t.min_rank ?? "Any rank"} · hosted by <span className="text-foreground font-semibold">{hostName}</span> · {relTime(t.created_at)}
              </p>
              {t.description && <p className="text-xs text-foreground/80 mt-1 line-clamp-2">{t.description}</p>}
            </div>
            <div className="text-right shrink-0">
              <p className={cn("text-sm font-bold font-mono", openSlots === 0 ? "text-muted-foreground" : "text-primary")}>
                {openSlots}/{t.slots_total}
              </p>
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">slots</p>
            </div>
            <Button
              size="sm"
              disabled={openSlots === 0 || busy === t.id || t.host_id === user?.id}
              onClick={() => join(t)}
            >
              {busy === t.id ? <Loader2 className="h-4 w-4 animate-spin" /> : t.host_id === user?.id ? "Mine" : openSlots === 0 ? "Full" : "Join"}
            </Button>
          </div>
        );})}
      </div>
    </div>
  );
}

/* -------------------- Helpers -------------------- */

function Avatar({ profile, size = 12 }: { profile: Profile | null; size?: number }) {
  const px = size * 4;
  return (
    <UserAvatar
      userId={profile?.id}
      avatarUrl={profile?.avatar_url ?? undefined}
      fallback={profile?.display_name ?? profile?.username ?? "?"}
      size={px}
    />
  );
}


function isSameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function formatDateHeader(d: Date) {
  const today = new Date();
  const yest = new Date(); yest.setDate(today.getDate() - 1);
  if (isSameDay(d, today)) return "Today";
  if (isSameDay(d, yest)) return "Yesterday";
  return d.toLocaleDateString(undefined, { month: "long", day: "numeric" });
}

function relTime(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "now";
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  const d = Math.floor(h / 24);
  return `${d}d`;
}
