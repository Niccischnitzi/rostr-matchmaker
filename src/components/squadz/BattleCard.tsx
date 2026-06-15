import { Trophy, Target, Zap, TrendingUp, Award, Crosshair } from "lucide-react";
import { useMemo } from "react";

type Props = {
  username: string;
  linkedPlatforms: string[];
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
  { key: "verified", label: "Verified", color: "from-sky-500 to-blue-600" },
  { key: "toxic-free", label: "Toxic-free", color: "from-emerald-500 to-green-600" },
  { key: "tryhard", label: "Tryhard", color: "from-rose-500 to-red-600" },
  { key: "coach", label: "Coach", color: "from-amber-500 to-orange-600" },
];

export function BattleCard({ username, linkedPlatforms }: Props) {
  const stats = useMemo(() => seededStats(username), [username]);

  return (
    <div className="rounded-3xl border border-border bg-gradient-to-br from-card via-card to-surface overflow-hidden relative">
      <div className="absolute inset-0 opacity-[0.07] pointer-events-none"
        style={{ backgroundImage: "radial-gradient(circle at 20% 20%, var(--primary) 1px, transparent 1px), radial-gradient(circle at 80% 60%, var(--primary) 1px, transparent 1px)", backgroundSize: "32px 32px, 48px 48px" }} />
      <div className="relative p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Crosshair className="h-4 w-4 text-primary" />
            <h2 className="font-display text-lg font-black tracking-tight">Battlecard</h2>
          </div>
          <span className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">
            {linkedPlatforms.length > 0 ? `Synced · ${linkedPlatforms.join(" · ")}` : "Demo data"}
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
          <Stat icon={Target} label="K/D" value={stats.kd} accent />
          <Stat icon={Trophy} label="Win %" value={`${stats.winrate}%`} />
          <Stat icon={Zap} label="Hours" value={stats.hours.toLocaleString()} />
          <Stat icon={Crosshair} label="HS %" value={`${stats.headshot}%`} />
          <Stat icon={Award} label="Peak" value={stats.peakRank} />
          <Stat icon={TrendingUp} label="Streak" value={`W${stats.streak}`} />
        </div>

        <div className="mt-4 flex flex-wrap gap-1.5">
          {BADGES.map((b) => (
            <span key={b.key} className={`text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full text-white bg-gradient-to-r ${b.color}`}>
              {b.label}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

function Stat({ icon: Icon, label, value, accent = false }: { icon: typeof Trophy; label: string; value: string; accent?: boolean }) {
  return (
    <div className={`rounded-2xl border p-3 ${accent ? "border-primary/40 bg-primary/5" : "border-border bg-surface/60"}`}>
      <div className="flex items-center gap-1 text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
        <Icon className="h-3 w-3" /> {label}
      </div>
      <p className={`font-display text-xl font-black mt-1 truncate ${accent ? "text-primary" : "text-foreground"}`}>{value}</p>
    </div>
  );
}
