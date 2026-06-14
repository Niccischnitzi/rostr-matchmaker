import { useState } from "react";
import { useSquadz } from "@/lib/squadz-store";
import { ArrowLeft, Send, Plus, Gamepad2, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export function ChatTab() {
  const [view, setView] = useState<"chats" | "lfg">("chats");
  const [openChat, setOpenChat] = useState<string | null>(null);

  return (
    <div className="max-w-5xl mx-auto px-4 pt-6 lg:pt-10 pb-10">
      {!openChat && (
        <>
          <h1 className="font-display text-3xl lg:text-4xl font-black tracking-tight">Chat</h1>
          <p className="text-sm text-muted-foreground mt-1 mb-5">DMs, group chats, and the LFG board.</p>

          <div className="inline-flex rounded-full bg-surface p-1 border border-border mb-5">
            {([["chats", "Messages"], ["lfg", "LFG Board"]] as const).map(([k, l]) => (
              <button key={k} onClick={() => setView(k)}
                className={cn("px-4 py-1.5 rounded-full text-sm font-semibold transition-colors",
                  view === k ? "bg-primary text-primary-foreground" : "text-muted-foreground")}>{l}</button>
            ))}
          </div>
        </>
      )}

      {openChat ? <ChatWindow chatId={openChat} onBack={() => setOpenChat(null)} /> :
        view === "chats" ? <ChatList onOpen={setOpenChat} /> : <LFGBoard />}
    </div>
  );
}

function ChatList({ onOpen }: { onOpen: (id: string) => void }) {
  const { chats } = useSquadz();
  return (
    <div className="rounded-2xl border border-border bg-card overflow-hidden">
      {chats.map((c, i) => (
        <button key={c.id} onClick={() => onOpen(c.id)}
          className={cn("w-full flex items-center gap-3 p-4 hover:bg-surface text-left", i > 0 && "border-t border-border")}>
          <div className="h-12 w-12 rounded-xl bg-surface-2 grid place-items-center overflow-hidden shrink-0">
            {c.avatar.startsWith("http") ? <img src={c.avatar} className="h-full w-full object-cover" alt={c.name} /> : <span className="text-2xl">{c.avatar}</span>}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between gap-2">
              <p className="font-semibold truncate flex items-center gap-1.5">{c.name}{c.isGroup && <Users className="h-3 w-3 text-muted-foreground" />}</p>
              <span className="text-xs text-muted-foreground shrink-0">{c.lastTime}</span>
            </div>
            <p className="text-sm text-muted-foreground truncate">{c.messages[c.messages.length - 1]?.text}</p>
          </div>
          {c.unread > 0 && <span className="h-5 min-w-5 px-1.5 rounded-full bg-primary text-primary-foreground text-xs font-bold grid place-items-center">{c.unread}</span>}
        </button>
      ))}
    </div>
  );
}

function ChatWindow({ chatId, onBack }: { chatId: string; onBack: () => void }) {
  const { chats, sendMessage } = useSquadz();
  const chat = chats.find((c) => c.id === chatId)!;
  const [text, setText] = useState("");

  return (
    <div className="rounded-2xl border border-border bg-card flex flex-col h-[calc(100vh-12rem)] lg:h-[calc(100vh-6rem)] overflow-hidden">
      <div className="flex items-center gap-3 p-4 border-b border-border">
        <button onClick={onBack} className="h-9 w-9 rounded-lg hover:bg-surface grid place-items-center"><ArrowLeft className="h-4 w-4" /></button>
        <div className="h-10 w-10 rounded-xl bg-surface-2 grid place-items-center overflow-hidden">
          {chat.avatar.startsWith("http") ? <img src={chat.avatar} alt="" className="h-full w-full object-cover" /> : <span className="text-xl">{chat.avatar}</span>}
        </div>
        <div className="min-w-0">
          <p className="font-bold truncate">{chat.name}</p>
          <p className="text-xs text-success flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-full bg-success" />Online</p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {chat.messages.map((m) => {
          const me = m.from === "me";
          return (
            <div key={m.id} className={cn("flex flex-col max-w-[80%]", me ? "ml-auto items-end" : "items-start")}>
              {!me && chat.isGroup && <p className="text-[10px] text-muted-foreground mb-0.5 px-2">{m.from}</p>}
              <div className={cn("rounded-2xl px-4 py-2 text-sm", me ? "bg-primary text-primary-foreground rounded-br-sm" : "bg-surface rounded-bl-sm")}>
                {m.text}
                {m.invite && (
                  <div className="mt-2 rounded-lg bg-background/20 border border-current/20 p-2 flex items-center gap-2">
                    <Gamepad2 className="h-4 w-4" />
                    <div className="min-w-0">
                      <p className="font-bold text-xs">{m.invite.game}</p>
                      <p className="text-[10px] opacity-70 font-mono truncate">{m.invite.lobby}</p>
                    </div>
                    <button onClick={() => toast.success(`Joining ${m.invite!.game}…`)}
                      className="ml-auto text-xs font-bold bg-background text-foreground px-3 py-1 rounded-md">JOIN</button>
                  </div>
                )}
              </div>
              <p className="text-[10px] text-muted-foreground mt-1 px-2">{m.time}</p>
            </div>
          );
        })}
      </div>

      <form onSubmit={(e) => { e.preventDefault(); sendMessage(chatId, text); setText(""); }}
        className="p-3 border-t border-border flex items-center gap-2">
        <button type="button" onClick={() => toast("Attachment menu (mock)")}
          className="h-10 w-10 rounded-full bg-surface grid place-items-center shrink-0 hover:bg-surface-2"><Plus className="h-4 w-4" /></button>
        <input value={text} onChange={(e) => setText(e.target.value)} placeholder="Message…"
          className="flex-1 bg-surface rounded-full px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
        <Button type="submit" size="icon" className="rounded-full h-10 w-10 shrink-0"><Send className="h-4 w-4" /></Button>
      </form>
    </div>
  );
}

function LFGBoard() {
  const { lfg, joinLFG, postLFG } = useSquadz();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ game: "Valorant", mode: "Ranked", rank: "Any", slotsOpen: 3, slotsTotal: 4 });

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-muted-foreground">{lfg.length} active tickets</p>
        <Button size="sm" onClick={() => setShowForm((s) => !s)}>{showForm ? "Cancel" : "Post Ticket"}</Button>
      </div>

      {showForm && (
        <form onSubmit={(e) => { e.preventDefault(); postLFG(form); setShowForm(false); toast.success("LFG ticket posted!"); }}
          className="rounded-2xl border border-primary/30 bg-card p-4 mb-4 grid grid-cols-2 gap-3">
          {[["game", "Game"], ["mode", "Mode"], ["rank", "Rank needed"]].map(([k, l]) => (
            <div key={k} className={k === "rank" ? "col-span-2 sm:col-span-1" : ""}>
              <label className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">{l}</label>
              <input value={form[k as keyof typeof form] as string} onChange={(e) => setForm((p) => ({ ...p, [k]: e.target.value }))}
                className="w-full mt-1 bg-surface rounded-lg px-3 py-2 text-sm border border-border focus:outline-none focus:ring-2 focus:ring-primary" />
            </div>
          ))}
          <div>
            <label className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Slots open</label>
            <input type="number" min={1} max={9} value={form.slotsOpen}
              onChange={(e) => setForm((p) => ({ ...p, slotsOpen: +e.target.value, slotsTotal: Math.max(+e.target.value, p.slotsTotal) }))}
              className="w-full mt-1 bg-surface rounded-lg px-3 py-2 text-sm border border-border focus:outline-none focus:ring-2 focus:ring-primary" />
          </div>
          <Button type="submit" className="col-span-2">Post Ticket</Button>
        </form>
      )}

      <div className="grid gap-3">
        {lfg.map((t) => (
          <div key={t.id} className="rounded-2xl border border-border bg-card p-4 flex items-center gap-4">
            <div className="h-12 w-12 rounded-xl bg-primary/15 text-primary grid place-items-center shrink-0"><Gamepad2 className="h-6 w-6" /></div>
            <div className="min-w-0 flex-1">
              <div className="flex items-baseline gap-2 flex-wrap">
                <p className="font-bold">{t.game}</p>
                <span className="text-xs text-muted-foreground">· {t.mode}</span>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">{t.rank} · hosted by <span className="text-foreground font-semibold">{t.host}</span> · {t.postedAt}</p>
            </div>
            <div className="text-right shrink-0">
              <p className={cn("text-sm font-bold font-mono", t.slotsOpen === 0 ? "text-muted-foreground" : "text-primary")}>{t.slotsOpen}/{t.slotsTotal}</p>
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">slots</p>
            </div>
            <Button size="sm" disabled={t.slotsOpen === 0}
              onClick={() => { joinLFG(t.id); toast.success(`Joined ${t.host}'s ${t.game} party!`); }}>
              {t.slotsOpen === 0 ? "Full" : "Join"}
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
}
