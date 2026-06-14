import { useSquadz } from "@/lib/squadz-store";
import { Check, Copy, Plus, Trophy, Users } from "lucide-react";
import { toast } from "sonner";
import { useState } from "react";
import { cn } from "@/lib/utils";

const statuses = ["Online", "In-Game", "Busy", "Looking for Squad"] as const;
const statusColors: Record<string, string> = {
  "Online": "bg-success",
  "In-Game": "bg-primary",
  "Busy": "bg-destructive",
  "Looking for Squad": "bg-orange-500",
};

export function ProfileTab() {
  const { linked, clips, connected, status, setStatus } = useSquadz();
  const pinned = clips.filter((c) => c.pinned).slice(0, 3);
  const [copied, setCopied] = useState<string | null>(null);

  const copy = (platform: string, tag: string) => {
    navigator.clipboard?.writeText(tag).catch(() => {});
    setCopied(platform);
    toast.success(`${platform} ID copied!`, { description: tag });
    setTimeout(() => setCopied(null), 1500);
  };

  const add = (platform: string) => toast.success(`Friend request sent on ${platform}!`);

  return (
    <div className="max-w-5xl mx-auto px-4 pt-6 lg:pt-10 pb-10">
      {/* Header card */}
      <div className="rounded-3xl border border-border bg-card overflow-hidden">
        <div className="h-32 bg-gradient-to-br from-primary via-orange-600 to-accent relative">
          <div className="absolute inset-0 opacity-20" style={{ backgroundImage: "radial-gradient(circle at 30% 30%, white 1px, transparent 1px)", backgroundSize: "30px 30px" }} />
        </div>
        <div className="px-5 pb-5 -mt-12">
          <div className="flex items-end gap-4 flex-wrap">
            <div className="h-24 w-24 rounded-2xl border-4 border-card bg-surface-2 overflow-hidden shrink-0">
              <img src="https://api.dicebear.com/9.x/bottts-neutral/svg?seed=you&backgroundColor=ff5722" alt="you" className="h-full w-full" />
            </div>
            <div className="flex-1 min-w-0 pt-12">
              <h1 className="font-display text-2xl font-black truncate">SquadzPlayer</h1>
              <p className="text-sm text-muted-foreground">@squadz_main · Member since 2024</p>
            </div>
          </div>

          <div className="mt-5">
            <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold mb-2">Status</p>
            <div className="flex flex-wrap gap-2">
              {statuses.map((s) => (
                <button key={s} onClick={() => setStatus(s)}
                  className={cn("flex items-center gap-2 text-xs font-semibold px-3 py-1.5 rounded-full border transition-all",
                    status === s ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:bg-surface")}>
                  <span className={cn("h-2 w-2 rounded-full", statusColors[s])} />
                  {s}
                </button>
              ))}
            </div>
          </div>

          <div className="mt-5 grid grid-cols-3 gap-3">
            {[
              { label: "Squad", value: connected.length, icon: Users },
              { label: "Clips", value: clips.length, icon: Trophy },
              { label: "Wins", value: 142, icon: Trophy },
            ].map(({ label, value, icon: Icon }) => (
              <div key={label} className="rounded-xl bg-surface border border-border p-3 text-center">
                <Icon className="h-4 w-4 text-primary mx-auto" />
                <p className="font-display text-xl font-black mt-1">{value}</p>
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Linked accounts */}
      <div className="mt-6">
        <h2 className="font-display text-xl font-black mb-3">Linked accounts</h2>
        <p className="text-sm text-muted-foreground mb-4">Your universal gaming passport. Players can add you on any platform with one tap.</p>
        <div className="grid sm:grid-cols-2 gap-3">
          {linked.map((a) => (
            <div key={a.platform} className="rounded-2xl border border-border bg-card p-4 flex items-center gap-3">
              <div className="h-11 w-11 rounded-xl grid place-items-center text-xl shrink-0" style={{ background: a.color, color: "white" }}>{a.icon}</div>
              <div className="min-w-0 flex-1">
                <p className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">{a.platform}</p>
                <p className="font-mono font-bold truncate text-sm">{a.tag}</p>
              </div>
              <button onClick={() => copy(a.platform, a.tag)}
                className="h-9 w-9 rounded-lg bg-surface hover:bg-surface-2 grid place-items-center transition-colors">
                {copied === a.platform ? <Check className="h-4 w-4 text-success" /> : <Copy className="h-4 w-4" />}
              </button>
              <button onClick={() => add(a.platform)}
                className="h-9 px-3 rounded-lg bg-primary text-primary-foreground text-xs font-bold flex items-center gap-1 hover:opacity-90">
                <Plus className="h-3 w-3" /> ADD
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Showcase */}
      <div className="mt-6">
        <h2 className="font-display text-xl font-black mb-3">Showcase</h2>
        <div className="grid grid-cols-3 gap-3">
          {pinned.map((c) => (
            <div key={c.id} className="relative aspect-[3/4] rounded-2xl overflow-hidden border border-border group cursor-pointer">
              <img src={c.thumb} alt={c.title} className="absolute inset-0 h-full w-full object-cover" />
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent" />
              <div className="absolute bottom-2 left-2 right-2 text-white">
                <p className="text-[10px] font-bold uppercase tracking-wider text-primary">{c.game}</p>
                <p className="text-xs font-bold truncate">{c.title}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
