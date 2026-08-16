import { Trophy, Target, Zap, TrendingUp, Award, Crosshair, ShieldCheck, Flame, RefreshCw, Link2, Info } from "lucide-react";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { refreshBattlecardStats } from "@/lib/playerStats.functions";
import { deterministicStubStats } from "@/lib/playerStats.stub";
import { cn } from "@/lib/utils";

type Props = {
  username: string;
  linkedPlatforms: string[];
  verifiedPlatforms?: string[];
  loading?: boolean;
};

type StatRow = {
  game_key: string;
  source: string;
  rank_tier: string | null;
  kd: number | null;
  win_rate: number | null;
  hours_played: number | null;
  headshot_pct: number | null;
  longest_streak: number | null;
  fetched_at: string | null;
};

/** Friendly labels for the game keys the adapters write. */
const GAME_LABELS: Record<string, string> = {
  cs2: "CS2",
  dota2: "Dota 2",
  apex: "Apex Legends",
  rust: "Rust",
  pubg: "PUBG",
  r6s: "Rainbow Six",
  val: "Valorant",
  steam_library: "Steam library",
};
const gameLabel = (k: string) => GAME_LABELS[k] ?? k.replace(/_/g, " ");

type Aggregate = {
  kd: number | null;
  win_rate: number | null;
  hours_played: number | null;
  headshot_pct: number | null;
  rank_tier: string | null;
  longest_streak: number | null;
};

function aggregate(rows: StatRow[]): Aggregate | null {
  if (!rows.length) return null;
  const avg = (vals: Array<number | null>) => {
    const f = vals.filter((v): v is number => typeof v === "number");
    return f.length ? Math.round((f.reduce((a, b) => a + b, 0) / f.length) * 100) / 100 : null;
  };
  return {
    kd: avg(rows.map((r) => r.kd)),
    win_rate: avg(rows.map((r) => r.win_rate)),
    hours_played: rows.reduce((a, r) => a + (r.hours_played ?? 0), 0) || null,
    headshot_pct: avg(rows.map((r) => r.headshot_pct)),
    rank_tier: rows.map((r) => r.rank_tier).find(Boolean) ?? null,
    longest_streak: Math.max(0, ...rows.map((r) => r.longest_streak ?? 0)) || null,
  };
}

function relTime(iso: string | null) {
  if (!iso) return null;
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60_000);
  if (!isFinite(mins)) return null;
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const h = Math.round(mins / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.round(h / 24)}d ago`;
}

export function BattleCard({ username, linkedPlatforms, verifiedPlatforms = [], loading = false }: Props) {
  const refresh = useServerFn(refreshBattlecardStats);
  const stub = useMemo(() => deterministicStubStats(username || "guest"), [username]);
  const synced = linkedPlatforms.length > 0;
  const [refreshing, setRefreshing] = useState(false);
  const [game, setGame] = useState<string>("all");

  const { data: rows, isLoading: cacheLoading, refetch, isError } = useQuery<StatRow[]>({
    queryKey: ["battlecard-stats", username],
    queryFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return [];
      const { data, error } = await supabase
        .from("player_stats_cache")
        .select("game_key,source,rank_tier,kd,win_rate,hours_played,headshot_pct,longest_streak,fetched_at")
        .eq("user_id", u.user.id);
      if (error) throw error;
      return (data ?? []) as StatRow[];
    },
    staleTime: 60_000,
    retry: 1,
  });

  const allRows = rows ?? [];
  const games = useMemo(
    () => Array.from(new Set(allRows.map((r) => r.game_key))).sort(),
    [allRows],
  );
  const visibleRows = game === "all" ? allRows : allRows.filter((r) => r.game_key === game);
  const aggregated = aggregate(visibleRows);
  const usingLive = !!aggregated;
  const stats: Aggregate = aggregated ?? stub;
  const lastSynced = relTime(
    allRows.map((r) => r.fetched_at).filter(Boolean).sort().at(-1) ?? null,
  );
  const isLoading = loading || cacheLoading;

  const doRefresh = async () => {
    if (!synced) {
      toast.info("Link a platform first", { description: "Connect Steam to pull live stats onto your battlecard." });
      return;
    }
    setRefreshing(true);
    try {
      const res: any = await refresh({ data: undefined as never });
      if (res?.ok) {
        await refetch();
        if (res.refreshed > 0) toast.success(`Battlecard updated · ${res.refreshed} game${res.refreshed === 1 ? "" : "s"}`);
        else if (res.adaptersConfigured) toast.info("Nothing new to sync yet", { description: "Steam had no tracked stats for your linked games." });
        else toast.info("Live stats aren't configured for this platform yet.");
      } else {
        toast.error(res?.error ?? "Refresh failed");
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Refresh failed");
    } finally {
      setRefreshing(false);
    }
  };

  // Badges are earned from real data — no decorative fakes.
  const badges = useMemo(() => {
    const out: { key: string; label: string; icon: typeof Trophy }[] = [];
    if (verifiedPlatforms.length) out.push({ key: "verified", label: "Verified", icon: ShieldCheck });
    if (usingLive) {
      if ((stats.hours_played ?? 0) >= 1000) out.push({ key: "grinder", label: "1k+ hours", icon: Zap });
      if ((stats.headshot_pct ?? 0) >= 40) out.push({ key: "hs", label: "Sharpshooter", icon: Crosshair });
      if ((stats.kd ?? 0) >= 1.5) out.push({ key: "fragger", label: "Fragger", icon: Flame });
      if ((stats.win_rate ?? 0) >= 55) out.push({ key: "winner", label: "Winning record", icon: Trophy });
      if (games.length >= 3) out.push({ key: "multi", label: "Multi-game", icon: Award });
    }
    return out;
  }, [verifiedPlatforms.length, usingLive, stats, games.length]);

  const fmt = (v: number | null | undefined, suffix = "") =>
    typeof v === "number" && isFinite(v) ? `${Math.round(v * 100) / 100}${suffix}` : "—";

  return (
    <div className="rounded-3xl border border-border bg-card overflow-hidden shadow-sm animate-fade-in">
      <div className="flex items-center gap-2 px-4 sm:px-5 py-3 border-b border-border bg-surface/50">
        <span className="grid place-items-center h-7 w-7 rounded-xl bg-primary/15 text-primary shrink-0">
          <Crosshair className="h-3.5 w-3.5" />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="font-display text-base sm:text-lg font-black tracking-tight truncate">Battlecard</h2>
          <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold truncate">
            {isLoading
              ? "Loading…"
              : refreshing
                ? "Syncing…"
                : usingLive
                  ? `Live · ${lastSynced ? `synced ${lastSynced}` : linkedPlatforms.join(" · ")}`
                  : isError
                    ? "Stats unavailable · sample data"
                    : synced
                      ? "Awaiting first sync · sample data"
                      : "Sample data"}
          </p>
        </div>
        <button
          onClick={doRefresh}
          disabled={refreshing || isLoading}
          className="h-9 px-3 rounded-lg bg-surface hover:bg-surface-2 border border-border text-xs font-bold flex items-center gap-1.5 disabled:opacity-50 shrink-0"
        >
          <RefreshCw className={cn("h-3.5 w-3.5", refreshing && "animate-spin")} />
          <span className="hidden sm:inline">Refresh</span>
        </button>
      </div>

      <div className="p-4 sm:p-5">
        {games.length > 1 && (
          <div className="flex gap-1.5 mb-3 overflow-x-auto pb-1" data-swipe-ignore="true">
            {["all", ...games].map((g) => (
              <button
                key={g}
                onClick={() => setGame(g)}
                className={cn(
                  "px-3 py-1.5 rounded-full text-[11px] font-bold uppercase tracking-wider whitespace-nowrap border transition-colors",
                  game === g
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-surface border-border text-muted-foreground hover:text-foreground",
                )}
              >
                {g === "all" ? "All games" : gameLabel(g)}
              </button>
            ))}
          </div>
        )}

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
          <Stat icon={Target} label="K/D" value={fmt(stats.kd)} accent loading={isLoading} />
          <Stat icon={Trophy} label="Win %" value={fmt(stats.win_rate, "%")} loading={isLoading} />
          <Stat
            icon={Zap}
            label="Hours"
            value={typeof stats.hours_played === "number" ? Math.round(stats.hours_played).toLocaleString() : "—"}
            loading={isLoading}
          />
          <Stat icon={Crosshair} label="HS %" value={fmt(stats.headshot_pct, "%")} loading={isLoading} />
          <Stat icon={Award} label="Peak" value={stats.rank_tier ?? "—"} loading={isLoading} />
          <Stat
            icon={TrendingUp}
            label="Streak"
            value={stats.longest_streak ? `W${stats.longest_streak}` : "—"}
            loading={isLoading}
          />
        </div>

        {/* Per-game breakdown — the actual data behind the aggregate. */}
        {!isLoading && visibleRows.length > 0 && (
          <div className="mt-4 rounded-2xl border border-border overflow-hidden">
            <table className="w-full text-xs">
              <thead className="bg-surface/60 text-muted-foreground">
                <tr className="[&>th]:px-3 [&>th]:py-2 [&>th]:text-left [&>th]:font-semibold [&>th]:uppercase [&>th]:tracking-wider [&>th]:text-[10px]">
                  <th>Game</th>
                  <th className="text-right">K/D</th>
                  <th className="text-right">Win %</th>
                  <th className="text-right">HS %</th>
                  <th className="text-right">Hours</th>
                </tr>
              </thead>
              <tbody>
                {visibleRows
                  .slice()
                  .sort((a, b) => (b.hours_played ?? 0) - (a.hours_played ?? 0))
                  .map((r) => (
                    <tr key={`${r.game_key}-${r.source}`} className="border-t border-border [&>td]:px-3 [&>td]:py-2">
                      <td className="font-semibold truncate">{gameLabel(r.game_key)}</td>
                      <td className="text-right font-mono">{fmt(r.kd)}</td>
                      <td className="text-right font-mono">{fmt(r.win_rate, "%")}</td>
                      <td className="text-right font-mono">{fmt(r.headshot_pct, "%")}</td>
                      <td className="text-right font-mono">
                        {r.hours_played != null ? r.hours_played.toLocaleString() : "—"}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        )}

        {!isLoading && !usingLive && (
          <div className="mt-4 flex items-start gap-2 rounded-2xl border border-dashed border-border bg-surface/40 p-3">
            <Info className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
            <div className="min-w-0 text-xs text-muted-foreground">
              <p className="font-semibold text-foreground">These are sample numbers</p>
              <p className="mt-0.5">
                {synced
                  ? "Hit refresh to pull real stats from your linked platforms."
                  : "Link Steam under Linked accounts to fill your battlecard with real playtime and match stats."}
              </p>
              {!synced && (
                <span className="mt-2 inline-flex items-center gap-1 text-[11px] font-bold uppercase tracking-wider text-primary">
                  <Link2 className="h-3 w-3" /> Link a platform
                </span>
              )}
            </div>
          </div>
        )}

        {badges.length > 0 && (
          <div className="mt-4 flex flex-wrap gap-1.5">
            {badges.map((b) => {
              const Icon = b.icon;
              return (
                <span
                  key={b.key}
                  className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full border border-primary/30 bg-primary/10 text-primary"
                >
                  <Icon className="h-3 w-3" />
                  {b.label}
                </span>
              );
            })}
          </div>
        )}
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
      className={cn(
        "rounded-2xl border p-3 min-w-0 transition-colors",
        accent ? "border-primary/40 bg-primary/5" : "border-border bg-surface/60",
      )}
    >
      <div className="flex items-center gap-1 text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
        <Icon className="h-3 w-3 shrink-0" />
        <span className="truncate">{label}</span>
      </div>
      {loading ? (
        <div className="mt-2 h-5 w-12 rounded-md bg-muted/60 animate-pulse" />
      ) : (
        <p className={cn("font-display text-lg sm:text-xl font-black mt-1 truncate", accent ? "text-primary" : "text-foreground")}>
          {value}
        </p>
      )}
    </div>
  );
}
