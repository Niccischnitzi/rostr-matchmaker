import { useEffect, useMemo, useState } from "react";
import { Eye, Megaphone, Loader2, TrendingUp, Users2, Clock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

export function LfgAdStats({ userId }: { userId: string }) {
  const [loading, setLoading] = useState(true);
  const [ad, setAd] = useState<{ title: string | null; body: string | null; games: string[] | null; updated_at: string | null } | null>(null);
  const [rows, setRows] = useState<{ viewer_id: string; created_at: string }[]>([]);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data: prof } = await supabase
        .from("profiles" as any)
        .select("lfg_title, lfg_body, lfg_games, updated_at")
        .eq("id", userId)
        .maybeSingle();
      const p = prof as any;
      setAd(p ? { title: p.lfg_title, body: p.lfg_body, games: p.lfg_games, updated_at: p.updated_at } : null);

      const { data: views } = await supabase
        .from("lfg_ad_views" as any)
        .select("viewer_id, created_at")
        .eq("ad_owner_id", userId);
      setRows(((views as any[]) ?? []) as any);
      setLoading(false);
    })();
  }, [userId]);

  const { totalViews, uniqueViewers, views24h, hourly, prev24h } = useMemo(() => {
    const now = Date.now();
    const cutoff24 = now - 24 * 60 * 60 * 1000;
    const cutoff48 = now - 48 * 60 * 60 * 1000;
    const buckets = new Array(24).fill(0);
    let v24 = 0;
    let vPrev = 0;
    for (const r of rows) {
      const ts = new Date(r.created_at).getTime();
      if (ts > cutoff24) {
        v24++;
        const hoursAgo = Math.floor((now - ts) / (60 * 60 * 1000));
        const idx = 23 - Math.min(23, Math.max(0, hoursAgo));
        buckets[idx]++;
      } else if (ts > cutoff48) {
        vPrev++;
      }
    }
    return {
      totalViews: rows.length,
      uniqueViewers: new Set(rows.map((r) => r.viewer_id)).size,
      views24h: v24,
      hourly: buckets,
      prev24h: vPrev,
    };
  }, [rows]);

  if (loading) {
    return (
      <div className="mt-6 rounded-2xl border border-border bg-card p-4 grid place-items-center">
        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!ad?.title) {
    return (
      <div className="mt-6 rounded-2xl border border-primary/30 bg-primary/5 p-4 flex items-center gap-3 animate-fade-in">
        <div className="h-10 w-10 rounded-xl bg-primary/15 text-primary grid place-items-center shrink-0">
          <Megaphone className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <p className="font-display text-base font-black">No active LFG ad</p>
          <p className="text-xs text-muted-foreground">Post one from the Find tab to start matching with players.</p>
        </div>
      </div>
    );
  }

  const trend = prev24h === 0 ? (views24h > 0 ? 100 : 0) : Math.round(((views24h - prev24h) / prev24h) * 100);
  const trendPositive = trend >= 0;

  return (
    <div className="mt-6 rounded-2xl border border-border bg-card overflow-hidden animate-fade-in">
      <div className="relative p-4 bg-gradient-to-br from-primary/20 via-primary/5 to-transparent">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Megaphone className="h-4 w-4 text-primary" />
            <p className="text-[10px] uppercase tracking-[0.2em] font-bold text-primary">Your LFG ad performance</p>
          </div>
          <div className={`flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded-full ${trendPositive ? "bg-success/15 text-success" : "bg-destructive/15 text-destructive"}`}>
            <TrendingUp className={`h-3 w-3 ${trendPositive ? "" : "rotate-180"}`} />
            {trendPositive ? "+" : ""}{trend}%
          </div>
        </div>
        <p className="font-display text-lg font-black truncate mt-2">{ad.title}</p>
        {ad.body && <p className="text-sm text-muted-foreground line-clamp-2 mt-1">{ad.body}</p>}
        {ad.games && ad.games.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {ad.games.slice(0, 6).map((g) => (
              <span key={g} className="text-[10px] px-2 py-0.5 rounded-full bg-surface/80 border border-border font-semibold">{g}</span>
            ))}
          </div>
        )}
      </div>

      <div className="px-4 pb-4">
        <Sparkline data={hourly} />

        <div className="mt-3 grid grid-cols-3 gap-2">
          <Stat icon={Eye} label="Total views" value={totalViews} />
          <Stat icon={Users2} label="Unique" value={uniqueViewers} />
          <Stat icon={Clock} label="Last 24h" value={views24h} highlight />
        </div>
      </div>
    </div>
  );
}

function Sparkline({ data }: { data: number[] }) {
  const max = Math.max(1, ...data);
  const w = 280;
  const h = 56;
  const stepX = w / Math.max(1, data.length - 1);
  const points = data.map((v, i) => [i * stepX, h - (v / max) * (h - 6) - 2] as const);
  const path = points.map((p, i) => `${i === 0 ? "M" : "L"}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(" ");
  const area = `${path} L${w},${h} L0,${h} Z`;
  const peak = data.reduce((acc, v, i) => (v > data[acc] ? i : acc), 0);

  return (
    <div className="mt-3 rounded-xl border border-border bg-surface/60 p-3">
      <div className="flex items-center justify-between mb-1">
        <p className="text-[9px] uppercase tracking-widest text-muted-foreground font-bold">Views · last 24h</p>
        <p className="text-[9px] uppercase tracking-widest text-muted-foreground font-bold">Peak {data[peak]} @ {23 - peak}h ago</p>
      </div>
      <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-14 overflow-visible" preserveAspectRatio="none">
        <defs>
          <linearGradient id="lfg-spark-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity="0.35" />
            <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d={area} fill="url(#lfg-spark-fill)" />
        <path
          d={path}
          fill="none"
          stroke="hsl(var(--primary))"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{
            strokeDasharray: 800,
            strokeDashoffset: 800,
            animation: "spark-draw 1.1s cubic-bezier(0.22, 1, 0.36, 1) forwards",
          }}
        />
        {points.map(([x, y], i) => (
          <circle
            key={i}
            cx={x}
            cy={y}
            r={i === peak ? 3 : 1.5}
            fill={i === peak ? "hsl(var(--primary))" : "hsl(var(--primary) / 0.6)"}
            className={i === peak ? "animate-pulse" : ""}
          />
        ))}
      </svg>
      <style>{`@keyframes spark-draw { to { stroke-dashoffset: 0; } }`}</style>
    </div>
  );
}

function Stat({ icon: Icon, label, value, highlight }: { icon: typeof Eye; label: string; value: number; highlight?: boolean }) {
  return (
    <div className={`rounded-xl border p-3 text-center transition-all hover:scale-[1.02] ${highlight ? "border-primary/40 bg-primary/10" : "border-border bg-surface"}`}>
      <div className={`flex items-center justify-center gap-1 ${highlight ? "text-primary" : "text-foreground"}`}>
        <Icon className="h-3.5 w-3.5" />
        <span className="font-display text-xl font-black leading-none">{value}</span>
      </div>
      <p className="text-[9px] uppercase tracking-widest text-muted-foreground font-bold mt-1">{label}</p>
    </div>
  );
}
