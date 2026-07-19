import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowLeft, Inbox as InboxIcon, CheckCheck, UserPlus, MessageCircle, Trophy, ShieldAlert, Bell } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useNotifications, type NotificationRow } from "@/hooks/use-notifications";
import { formatDistanceToNow } from "date-fns";

export const Route = createFileRoute("/inbox")({
  ssr: false,
  beforeLoad: async ({ location }) => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/auth", search: { next: location.pathname + location.searchStr } });
  },
  head: () => ({
    meta: [
      { title: "Inbox — Rostr" },
      { name: "description", content: "Friend requests, messages, and crew activity, all in one place." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: InboxPage,
});

function iconFor(kind: string) {
  if (kind.includes("friend")) return UserPlus;
  if (kind.includes("message") || kind.includes("dm")) return MessageCircle;
  if (kind.includes("tournament") || kind.includes("cup") || kind.includes("challenge")) return Trophy;
  if (kind.includes("report") || kind.includes("moderation")) return ShieldAlert;
  return Bell;
}

function InboxPage() {
  const { rows, unread, loading, markAllRead, reload } = useNotifications();
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    // Mark on first render so the badge clears while the user reads.
    if (unread > 0) markAllRead();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const clear = async () => {
    setBusy(true);
    await markAllRead();
    setBusy(false);
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-30 border-b border-border bg-background/85 backdrop-blur-xl">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center gap-3">
          <Link to="/" className="h-9 w-9 grid place-items-center rounded-lg bg-surface hover:bg-surface-2 shrink-0">
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div className="min-w-0 flex-1">
            <h1 className="font-display text-lg font-black flex items-center gap-2">
              <InboxIcon className="h-5 w-5 text-primary" />
              Inbox
              {unread > 0 && (
                <span className="text-[10px] uppercase tracking-widest bg-primary/15 text-primary px-2 py-0.5 rounded-full">
                  {unread} new
                </span>
              )}
            </h1>
          </div>
          <button
            onClick={clear}
            disabled={busy || rows.length === 0}
            className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider px-3 py-1.5 rounded-lg bg-surface hover:bg-surface-2 border border-border disabled:opacity-40"
          >
            <CheckCheck className="h-3.5 w-3.5" />
            Mark read
          </button>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-5">
        {loading ? (
          <ul className="space-y-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <li key={i} className="h-16 rounded-2xl bg-surface/40 animate-pulse" />
            ))}
          </ul>
        ) : rows.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border p-12 text-center text-muted-foreground">
            <InboxIcon className="h-8 w-8 mx-auto mb-3 opacity-60" />
            <p className="font-semibold text-foreground">All caught up</p>
            <p className="text-xs mt-1">Friend requests, DMs, and crew activity will land here.</p>
            <button
              onClick={() => reload()}
              className="mt-4 text-xs font-bold uppercase tracking-wider px-3 py-1.5 rounded-lg bg-primary text-primary-foreground"
            >
              Refresh
            </button>
          </div>
        ) : (
          <ul className="space-y-2">
            {rows.map((r) => <Row key={r.id} row={r} />)}
          </ul>
        )}
      </main>
    </div>
  );
}

function Row({ row }: { row: NotificationRow }) {
  const Icon = iconFor(row.kind ?? "");
  const isUnread = !row.read_at;
  return (
    <li
      className={`rounded-2xl border p-3 flex items-start gap-3 transition ${
        isUnread ? "border-primary/40 bg-primary/5" : "border-border bg-card/60"
      }`}
    >
      <div className={`h-10 w-10 rounded-xl grid place-items-center shrink-0 ${isUnread ? "bg-primary/20 text-primary" : "bg-surface text-muted-foreground"}`}>
        <Icon className="h-5 w-5" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-bold truncate">{row.title ?? row.kind}</p>
        {row.body && <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">{row.body}</p>}
        <p className="text-[10px] uppercase tracking-widest text-muted-foreground/70 mt-1">
          {formatDistanceToNow(new Date(row.created_at), { addSuffix: true })}
        </p>
      </div>
      {isUnread && <span className="h-2 w-2 rounded-full bg-primary mt-2 shrink-0" aria-label="Unread" />}
    </li>
  );
}
