import { createFileRoute, redirect, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { getSeoStatus, submitSitemapToGoogle } from "@/lib/seo.functions";
import { toast } from "sonner";
import {
  ArrowLeft,
  Search,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  RefreshCcw,
  FileCode2,
  MousePointerClick,
  Eye,
} from "lucide-react";

export const Route = createFileRoute("/seo")({
  ssr: false,
  beforeLoad: async ({ location }) => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user)
      throw redirect({ to: "/auth", search: { next: location.pathname + location.searchStr } });
    const { data: isAdmin } = await supabase.rpc("has_role", {
      _user_id: data.user.id,
      _role: "admin",
    });
    if (!isAdmin) throw redirect({ to: "/" });
    return { user: data.user };
  },
  head: () => ({
    meta: [{ title: "SEO status — Rostr" }, { name: "robots", content: "noindex" }],
  }),
  component: SeoStatusPage,
});

function Stat({ icon: Icon, label, value }: { icon: any; label: string; value: string | number }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <div className="flex items-center gap-2 text-[11px] font-black uppercase tracking-widest text-muted-foreground">
        <Icon className="h-3.5 w-3.5" /> {label}
      </div>
      <div className="mt-2 font-display text-3xl font-black text-foreground">{value}</div>
    </div>
  );
}

function SeoStatusPage() {
  const [selected, setSelected] = useState<string | undefined>(undefined);
  const fetchStatus = useServerFn(getSeoStatus);
  const submit = useServerFn(submitSitemapToGoogle);

  const status = useQuery({
    queryKey: ["seo-status", selected],
    queryFn: () => fetchStatus({ data: { selectedSiteUrl: selected } }),
    staleTime: 60_000,
  });

  const submitMutation = useMutation({
    mutationFn: (siteUrl: string) => submit({ data: { siteUrl } }),
    onSuccess: (res: any) => {
      if (res?.ok) {
        toast.success("Sitemap submitted to Google");
        status.refetch();
      } else toast.error(res?.error ?? "Submit failed");
    },
    onError: (e: any) => toast.error(e?.message ?? "Submit failed"),
  });

  const data = status.data as any;

  return (
    <main className="mx-auto min-h-screen w-full max-w-3xl px-4 py-8">
      <div className="mb-6 flex items-center justify-between gap-3">
        <Link
          to="/"
          className="inline-flex items-center gap-2 text-xs font-black uppercase tracking-widest text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" /> Back
        </Link>
        <button
          onClick={() => status.refetch()}
          className="inline-flex items-center gap-2 rounded-xl border border-border px-3 py-2 text-xs font-black uppercase tracking-widest text-foreground hover:bg-accent"
        >
          <RefreshCcw className={`h-3.5 w-3.5 ${status.isFetching ? "animate-spin" : ""}`} /> Refresh
        </button>
      </div>

      <h1 className="font-display text-3xl font-black tracking-tight text-foreground">SEO status</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Live Google Search Console data for rostr, plus on-site crawl surfaces.
      </p>

      {status.isPending && (
        <div className="mt-8 flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading Search Console…
        </div>
      )}

      {data && data.ok === false && (
        <div className="mt-6 flex items-start gap-3 rounded-2xl border border-warning/40 bg-warning/5 p-4 text-sm text-foreground">
          <AlertTriangle className="mt-0.5 h-4 w-4 text-warning" />
          <div>
            <p className="font-bold">Search Console isn't reporting yet</p>
            <p className="mt-1 text-muted-foreground">{data.error}</p>
          </div>
        </div>
      )}

      {data?.status === "selection_required" && (
        <div className="mt-6 rounded-2xl border border-border bg-card p-4">
          <p className="text-sm font-bold text-foreground">Pick the Search Console property to report on</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {data.candidates.map((c: string) => (
              <button
                key={c}
                onClick={() => setSelected(c)}
                className="rounded-xl border border-border px-3 py-2 text-xs font-bold text-foreground hover:bg-accent"
              >
                {c}
              </button>
            ))}
          </div>
        </div>
      )}

      {data?.status === "selected" && (
        <div className="mt-6 space-y-6">
          <div className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-muted-foreground">
            <CheckCircle2 className="h-4 w-4 text-success" /> {data.siteUrl}
          </div>

          <div className="grid grid-cols-3 gap-3">
            <Stat icon={MousePointerClick} label="Clicks 28d" value={data.totals.clicks} />
            <Stat icon={Eye} label="Impressions" value={data.totals.impressions} />
            <Stat icon={Search} label="Queries" value={data.totals.queries} />
          </div>

          <section className="rounded-2xl border border-border bg-card p-4">
            <div className="flex items-center justify-between gap-3">
              <h2 className="flex items-center gap-2 text-sm font-black uppercase tracking-widest text-foreground">
                <FileCode2 className="h-4 w-4" /> Sitemaps
              </h2>
              <button
                disabled={submitMutation.isPending}
                onClick={() => submitMutation.mutate(data.siteUrl)}
                className="inline-flex items-center gap-2 rounded-xl bg-primary px-3 py-2 text-xs font-black uppercase tracking-widest text-primary-foreground disabled:opacity-60"
              >
                {submitMutation.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />} Submit sitemap
              </button>
            </div>
            {data.sitemaps.length === 0 ? (
              <p className="mt-3 text-sm text-muted-foreground">
                No sitemap submitted yet — hit “Submit sitemap” to register /sitemap.xml.
              </p>
            ) : (
              <ul className="mt-3 space-y-2">
                {data.sitemaps.map((s: any) => (
                  <li key={s.path} className="rounded-xl border border-border/70 p-3 text-xs">
                    <p className="font-bold text-foreground break-all">{s.path}</p>
                    <p className="mt-1 text-muted-foreground">
                      {s.isPending ? "Pending" : "Processed"}
                      {s.lastDownloaded ? ` · last read ${new Date(s.lastDownloaded).toLocaleDateString()}` : ""}
                      {s.errors && s.errors !== "0" ? ` · ${s.errors} errors` : ""}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="rounded-2xl border border-border bg-card p-4">
            <h2 className="text-sm font-black uppercase tracking-widest text-foreground">Top queries</h2>
            {data.topQueries.length === 0 ? (
              <p className="mt-3 text-sm text-muted-foreground">
                No impressions recorded yet. Google usually needs a few days after verification.
              </p>
            ) : (
              <table className="mt-3 w-full text-left text-xs">
                <thead className="text-muted-foreground">
                  <tr>
                    <th className="pb-2 font-black uppercase tracking-widest">Query</th>
                    <th className="pb-2 text-right font-black uppercase tracking-widest">Clicks</th>
                    <th className="pb-2 text-right font-black uppercase tracking-widest">Impr.</th>
                    <th className="pb-2 text-right font-black uppercase tracking-widest">Pos.</th>
                  </tr>
                </thead>
                <tbody>
                  {data.topQueries.map((r: any) => (
                    <tr key={r.keys[0]} className="border-t border-border/60">
                      <td className="py-2 font-bold text-foreground">{r.keys[0]}</td>
                      <td className="py-2 text-right text-muted-foreground">{r.clicks}</td>
                      <td className="py-2 text-right text-muted-foreground">{r.impressions}</td>
                      <td className="py-2 text-right text-muted-foreground">{r.position?.toFixed(1)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>
        </div>
      )}
    </main>
  );
}
