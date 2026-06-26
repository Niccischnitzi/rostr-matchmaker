import { Trophy, Target, Zap, TrendingUp, Award, Crosshair, ShieldCheck, Flame } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { refreshBattlecardStats, deterministicStubStats } from "@/lib/playerStats.functions";

type Props = {
  username: string;
  linkedPlatforms: string[];
  loading?: boolean;
};

const BADGES = [
  { key: "verified", label: "Verified", icon: ShieldCheck, color: "from-sky-500 to-blue-600" },
  { key: "toxic-free", label: "Toxic-free", icon: Trophy, color: "from-emerald-500 to-green-600" },
  { key: "tryhard", label: "Tryhard", icon: Flame, color: "from-rose-500 to-red-600" },
  { key: "coach", label: "Coach", icon: Award, color: "from-primary to-primary-glow" },
];

// Aggregate the user's per-game cache rows into a single Battlecard view.
function aggregate(rows: Array<{
  rank_tier: string | null; kd: number | null; win_rate: number | null;
  hours_played: number | null; headshot_pct: number | null; longest_streak: number | null;
}>) {
  if (!rows.length) return null;
  const num = (v: number | null) => (typeof v === "number" ? v : null);
  const avg = (vals: Array<number | null>) => {
    const f = vals.filter((v): v is number => typeof v === "number");
    return f.length ? f.reduce((a, b) => a + b, 0) / f.length : null;
  };
  const sum = (vals: Array<number | null>) => vals.reduce<number>((a, b) => a + (b ?? 0), 0);
  const peak = rows.map((r) => r.rank_tier).filter(Boolean)[0] ?? null;
  return {
    kd: avg(rows.map((r) => num(r.kd))),
    win_rate: avg(rows.map((r) => num(r.win_rate))),
    hours_played: sum(rows.map((r) => num(r.hours_played))),
    headshot_pct: avg(rows.map((r) => num(r.headshot_pct))),
    rank_tier: peak,
    longest_streak: Math.max(0, ...rows.map((r) => num(r.longest_streak) ?? 0)),
  };
}

export function BattleCard({ username, linkedPlatforms, loading = false }: Props) {
  const refresh = useServerFn(refreshBattlecardStats);
  const stub = useMemo(() => deterministicStubStats(username || "guest"), [username]);
  const synced = linkedPlatforms.length > 0;

  // Pull whatever is in the cache for the signed-in user right now.
  const { data: cacheRows, isLoading: cacheLoading, refetch, isError } = useQuery({
    queryKey: ["battlecard-stats", username],
    queryFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return [];
      const { data, error } = await supabase
        .from("player_stats_cache")
        .select("rank_tier,kd,win_rate,hours_played,headshot_pct,longest_streak")
        .eq("user_id", u.user.id);
      if (error) throw error;
      return data ?? [];
    },
    staleTime: 60_000,
    retry: 1,
  });

  // Kick off a background refresh whenever the user has linked accounts. The
  // server fn is a graceful no-op when no API keys are configured, so this is
  // safe to call unconditionally — it never blocks first paint or errors loud.
  const [refreshing, setRefreshing] = useState(false);
  useEffect(() => {
    if (!synced) return;
    let cancelled = false;
    setRefreshing(true);
    refresh({ data: undefined as never })
      .then((res) => {
        if (cancelled) return;
        if (res?.ok && res.refreshed > 0) void refetch();
      })
      .catch((e) => console.warn("[Battlecard] refresh failed, using cache", e))
      .finally(() => { if (!cancelled) setRefreshing(false); });
    return () => { cancelled = true; };
  }, [synced, refresh, refetch]);

  const aggregated = useMemo(() => aggregate(cacheRows ?? []), [cacheRows]);
  const usingCache = !!aggregated;
  const stats = aggregated ?? stub;

  const isLoading = loading || cacheLoading;
  const statusLabel = isLoading
    ? "Loading…"
    : refreshing
      ? "Updating…"
      : usingCache
        ? `Live · ${linkedPlatforms.join(" · ") || "cached"}`
        : isError
          ? "Cache unavailable · demo"
          : synced ? "Awaiting first sync · demo" : "Demo data";

  const fmt = (v: number | null | undefined, suffix = "") =>
    typeof v === "number" && isFinite(v) ? `${Math.round(v * 100) / 100}${suffix}` : "—";

  return (
    <div className="hover-spin-inset rounded-3xl border border-border bg-gradient-to-br from-card via-card to-surface overflow-hidden relative shadow-[0_8px_30px_-12px_rgba(0,0,0,0.45)] animate-fade-in">
      <div
        className="absolute inset-0 opacity-[0.06] pointer-events-none"
        style={{
          backgroundImage:
            "radial-gradient(circle at 20% 20%, var(--primary) 1px, transparent 1px), radial-gradient(circle at 80% 60%, var(--primary) 1px, transparent 1px)",
          backgroundSize: "32px 32px, 48px 48px",
        }}
      />
      <div className="absolute -top-16 -right-16 h-48 w-48 rounded-full bg-primary/20 blur-3xl pointer-events-none" />

      <div className="relative p-4 sm:p-5">
        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 mb-4">
          <div className="flex min-w-0 items-center gap-2">
            <span className="grid place-items-center h-7 w-7 rounded-xl bg-primary/15 text-primary shrink-0">
              <Crosshair className="h-3.5 w-3.5" />
            </span>
            <h2 className="font-display text-base sm:text-lg font-black tracking-tight truncate">Battlecard</h2>
          </div>
          <span className="flex items-center gap-1.5 text-[10px] uppercase tracking-widest font-semibold shrink-0">
            <span
              className={`h-1.5 w-1.5 rounded-full ${
                isLoading || refreshing
                  ? "bg-amber-400 animate-pulse"
                  : usingCache
                    ? "bg-emerald-400"
                    : "bg-muted-foreground/50"
              }`}
            />
            <span className="text-muted-foreground truncate max-w-[160px] sm:max-w-none">{statusLabel}</span>
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
          <Stat icon={Target} label="K/D" value={fmt(stats.kd)} accent loading={isLoading} />
          <Stat icon={Trophy} label="Win %" value={fmt(stats.win_rate, "%")} loading={isLoading} />
          <Stat icon={Zap} label="Hours" value={typeof stats.hours_played === "number" ? Math.round(stats.hours_played).toLocaleString() : "—"} loading={isLoading} />
          <Stat icon={Crosshair} label="HS %" value={fmt(stats.headshot_pct, "%")} loading={isLoading} />
          <Stat icon={Award} label="Peak" value={stats.rank_tier ?? "—"} loading={isLoading} />
          <Stat icon={TrendingUp} label="Streak" value={typeof stats.longest_streak === "number" && stats.longest_streak > 0 ? `W${stats.longest_streak}` : "—"} loading={isLoading} />
        </div>

        <div className="mt-4 flex flex-wrap gap-1.5">
          {BADGES.map((b) => {
            const Icon = b.icon;
            return (
              <span
                key={b.key}
                className={`inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full text-white bg-gradient-to-r ${b.color} shadow-sm`}
              >
                <Icon className="h-3 w-3" />
                {b.label}
              </span>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function Stat({
  icon: Icon,
  label,
  value,
  accent = false,
  loading = false,
}: {
  icon: typeof Trophy;
  label: string;
  value: string;
  accent?: boolean;
  loading?: boolean;
}) {
  return (
    <div
      className={`hover-spin-ring rounded-2xl border p-3 transition-colors min-w-0 ${
        accent ? "border-primary/40 bg-primary/5" : "border-border bg-surface/60 hover:border-border/80"
      }`}
    >
      <div className="flex items-center gap-1 text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
        <Icon className="h-3 w-3 shrink-0" />
        <span className="truncate">{label}</span>
      </div>
      {loading ? (
        <div className="mt-2 h-5 w-12 rounded-md bg-muted/60 animate-pulse" />
      ) : (
        <p
          className={`font-display text-lg sm:text-xl font-black mt-1 truncate ${
            accent ? "text-primary" : "text-foreground"
          }`}
        >
          {value}
        </p>
      )}
    </div>
  );
}
