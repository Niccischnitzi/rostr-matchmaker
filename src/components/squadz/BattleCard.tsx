import { Trophy, Target, Zap, TrendingUp, Award, Crosshair, ShieldCheck, Flame } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

type Props = {
  username: string;
  linkedPlatforms: string[];
  loading?: boolean;
};

// Deterministic mock stats per user — replace with real Tracker.gg/Steam aggregation later.
function seededStats(seed: string) {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  const rng = () => ((h = (h * 1103515245 + 12345) >>> 0) % 1000) / 1000;
  const kd = (1 + rng() * 1.5).toFixed(2);
  const winrate = Math.floor(48 + rng() * 22);
  const hours = Math.floor(800 + rng() * 3500);
  const headshot = Math.floor(30 + rng() * 35);
  const peakRank = ["Gold III", "Platinum I", "Diamond II", "Ascendant", "Immortal"][Math.floor(rng() * 5)];
  const streak = Math.floor(2 + rng() * 9);
  return { kd, winrate, hours, headshot, peakRank, streak };
}

const BADGES = [
  { key: "verified", label: "Verified", icon: ShieldCheck, color: "from-sky-500 to-blue-600" },
  { key: "toxic-free", label: "Toxic-free", icon: Trophy, color: "from-emerald-500 to-green-600" },
  { key: "tryhard", label: "Tryhard", icon: Flame, color: "from-rose-500 to-red-600" },
  { key: "coach", label: "Coach", icon: Award, color: "from-amber-500 to-orange-600" },
];

export function BattleCard({ username, linkedPlatforms, loading = false }: Props) {
  const stats = useMemo(() => seededStats(username || "guest"), [username]);
  const synced = linkedPlatforms.length > 0;

  // Simulate a brief data-hydration tick on mount or when linked platforms change.
  const [hydrating, setHydrating] = useState(true);
  useEffect(() => {
    setHydrating(true);
    const t = setTimeout(() => setHydrating(false), 450);
    return () => clearTimeout(t);
  }, [username, linkedPlatforms.length]);

  const isLoading = loading || hydrating;

  return (
    <div className="rounded-3xl border border-border bg-gradient-to-br from-card via-card to-surface overflow-hidden relative shadow-[0_8px_30px_-12px_rgba(0,0,0,0.45)]">
      {/* dotted backdrop */}
      <div
        className="absolute inset-0 opacity-[0.06] pointer-events-none"
        style={{
          backgroundImage:
            "radial-gradient(circle at 20% 20%, var(--primary) 1px, transparent 1px), radial-gradient(circle at 80% 60%, var(--primary) 1px, transparent 1px)",
          backgroundSize: "32px 32px, 48px 48px",
        }}
      />
      {/* primary glow */}
      <div className="absolute -top-16 -right-16 h-48 w-48 rounded-full bg-primary/20 blur-3xl pointer-events-none" />

      <div className="relative p-4 sm:p-5">
        {/* header */}
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
                isLoading ? "bg-amber-400 animate-pulse" : synced ? "bg-emerald-400" : "bg-muted-foreground/50"
              }`}
            />
            <span className="text-muted-foreground truncate max-w-[140px] sm:max-w-none">
              {isLoading ? "Syncing…" : synced ? `Synced · ${linkedPlatforms.join(" · ")}` : "Demo data"}
            </span>
          </span>
        </div>

        {/* stats grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
          <Stat icon={Target} label="K/D" value={stats.kd} accent loading={isLoading} />
          <Stat icon={Trophy} label="Win %" value={`${stats.winrate}%`} loading={isLoading} />
          <Stat icon={Zap} label="Hours" value={stats.hours.toLocaleString()} loading={isLoading} />
          <Stat icon={Crosshair} label="HS %" value={`${stats.headshot}%`} loading={isLoading} />
          <Stat icon={Award} label="Peak" value={stats.peakRank} loading={isLoading} />
          <Stat icon={TrendingUp} label="Streak" value={`W${stats.streak}`} loading={isLoading} />
        </div>

        {/* badges */}
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
      className={`rounded-2xl border p-3 transition-colors min-w-0 ${
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
