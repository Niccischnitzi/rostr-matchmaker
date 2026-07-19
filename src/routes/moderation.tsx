import { createFileRoute, redirect, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { ArrowLeft, ShieldAlert, CheckCircle2, XCircle, Loader2, AlertTriangle } from "lucide-react";

type ReportStatus = "open" | "reviewing" | "resolved" | "dismissed";

type Report = {
  id: string;
  reporter_id: string;
  target_type: string;
  target_id: string;
  reason: string;
  details: string | null;
  status: ReportStatus;
  reviewer_id: string | null;
  created_at: string;
  resolved_at: string | null;
};

export const Route = createFileRoute("/moderation")({
  ssr: false,
  beforeLoad: async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/auth", search: {} });
    const { data: isAdmin } = await supabase.rpc("has_role", {
      _user_id: data.user.id,
      _role: "admin",
    });
    if (!isAdmin) throw redirect({ to: "/" });
    return { user: data.user };
  },
  head: () => ({
    meta: [{ title: "Moderation queue — Rostr" }, { name: "robots", content: "noindex" }],
  }),
  component: ModerationPage,
});

const FILTERS: { key: ReportStatus | "all"; label: string }[] = [
  { key: "open", label: "Open" },
  { key: "reviewing", label: "In review" },
  { key: "resolved", label: "Resolved" },
  { key: "dismissed", label: "Dismissed" },
  { key: "all", label: "All" },
];

function ModerationPage() {
  const [filter, setFilter] = useState<ReportStatus | "all">("open");
  const [reports, setReports] = useState<Report[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const load = async () => {
    setReports(null);
    let q = supabase
      .from("user_reports" as any)
      .select("*")
      .order("created_at", { ascending: false })
      .limit(100);
    if (filter !== "all") q = q.eq("status", filter);
    const { data, error } = await q;
    if (error) {
      toast.error("Couldn't load reports");
      setReports([]);
      return;
    }
    setReports((data ?? []) as unknown as Report[]);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter]);

  const update = async (id: string, status: ReportStatus) => {
    setBusy(id);
    const { data: u } = await supabase.auth.getUser();
    const patch: Record<string, unknown> = {
      status,
      reviewer_id: u.user?.id ?? null,
      resolved_at: status === "resolved" || status === "dismissed" ? new Date().toISOString() : null,
    };
    const { error } = await supabase.from("user_reports" as any).update(patch as any).eq("id", id);
    setBusy(null);
    if (error) return toast.error(error.message);
    toast.success(`Marked ${status}`);
    setReports((prev) => (prev ?? []).filter((r) => filter === "all" || r.status === filter ? r.id !== id : true).map((r) => (r.id === id ? { ...r, ...(patch as any) } : r)));
    if (filter !== "all") load();
  };

  const counts = (reports ?? []).reduce<Record<string, number>>((acc, r) => {
    acc[r.status] = (acc[r.status] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-30 border-b border-border bg-background/85 backdrop-blur-xl">
        <div className="max-w-4xl mx-auto px-4 py-3 grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3">
          <Link to="/" className="h-9 w-9 grid place-items-center rounded-lg bg-surface hover:bg-surface-2 shrink-0">
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div className="min-w-0">
            <h1 className="font-display text-lg sm:text-xl font-black truncate flex items-center gap-2">
              <ShieldAlert className="h-5 w-5 text-primary shrink-0" />
              Moderation
            </h1>
            <p className="text-[11px] text-muted-foreground truncate">Triage user reports and keep Rostr clean.</p>
          </div>
          <span className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold shrink-0">Admin</span>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-5 space-y-4">
        <div className="flex flex-wrap gap-1.5">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-colors ${
                filter === f.key
                  ? "bg-primary text-primary-foreground"
                  : "bg-surface text-muted-foreground hover:text-foreground"
              }`}
            >
              {f.label}
              {counts[f.key as string] ? ` · ${counts[f.key as string]}` : ""}
            </button>
          ))}
        </div>

        {reports === null ? (
          <div className="py-16 grid place-items-center text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
          </div>
        ) : reports.length === 0 ? (
          <div className="rounded-2xl border border-border bg-surface/40 p-10 text-center text-muted-foreground">
            <ShieldAlert className="h-8 w-8 mx-auto text-primary/60 mb-3" />
            <p className="font-semibold">No reports here</p>
            <p className="text-xs mt-1">Looks like the community is behaving itself.</p>
          </div>
        ) : (
          <ul className="space-y-2">
            {reports.map((r) => (
              <li
                key={r.id}
                className="rounded-2xl border border-border bg-card/80 p-4 grid grid-cols-1 sm:grid-cols-[minmax(0,1fr)_auto] gap-3"
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2 mb-1.5">
                    <StatusPill status={r.status} />
                    <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold">
                      {r.target_type}
                    </span>
                    <span className="text-[10px] text-muted-foreground">
                      {new Date(r.created_at).toLocaleString()}
                    </span>
                  </div>
                  <p className="text-sm font-semibold truncate">{r.reason}</p>
                  {r.details && (
                    <p className="text-xs text-muted-foreground mt-1 line-clamp-3">{r.details}</p>
                  )}
                  <p className="text-[11px] text-muted-foreground mt-1.5 font-mono truncate">
                    target: {r.target_id} · by {r.reporter_id.slice(0, 8)}
                  </p>
                </div>
                <div className="flex sm:flex-col gap-1.5 sm:w-32">
                  {r.status !== "reviewing" && r.status !== "resolved" && r.status !== "dismissed" && (
                    <button
                      onClick={() => update(r.id, "reviewing")}
                      disabled={busy === r.id}
                      className="flex-1 sm:flex-none text-xs font-bold px-2 py-1.5 rounded-lg bg-surface hover:bg-surface-2 border border-border disabled:opacity-50"
                    >
                      Review
                    </button>
                  )}
                  {r.status !== "resolved" && (
                    <button
                      onClick={() => update(r.id, "resolved")}
                      disabled={busy === r.id}
                      className="flex-1 sm:flex-none text-xs font-bold px-2 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white disabled:opacity-50 inline-flex items-center justify-center gap-1"
                    >
                      <CheckCircle2 className="h-3 w-3" /> Resolve
                    </button>
                  )}
                  {r.status !== "dismissed" && (
                    <button
                      onClick={() => update(r.id, "dismissed")}
                      disabled={busy === r.id}
                      className="flex-1 sm:flex-none text-xs font-bold px-2 py-1.5 rounded-lg bg-surface hover:bg-surface-2 border border-border disabled:opacity-50 inline-flex items-center justify-center gap-1"
                    >
                      <XCircle className="h-3 w-3" /> Dismiss
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}

        <p className="text-[11px] text-muted-foreground flex items-center gap-1.5 pt-2">
          <AlertTriangle className="h-3 w-3" /> Resolving a report keeps it on file for audit; it does not auto-suspend the account.
        </p>
      </main>
    </div>
  );
}

function StatusPill({ status }: { status: ReportStatus }) {
  const map: Record<ReportStatus, string> = {
    open: "bg-amber-500/15 text-amber-400 border-amber-500/40",
    reviewing: "bg-sky-500/15 text-sky-400 border-sky-500/40",
    resolved: "bg-emerald-500/15 text-emerald-400 border-emerald-500/40",
    dismissed: "bg-muted/40 text-muted-foreground border-border",
  };
  return (
    <span className={`text-[10px] uppercase tracking-widest font-bold px-2 py-0.5 rounded-full border ${map[status]}`}>
      {status}
    </span>
  );
}
