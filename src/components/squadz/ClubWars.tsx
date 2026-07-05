import { Swords, Sparkles } from "lucide-react";
import type { Club } from "@/lib/squadz-supabase";

// Clan Wars is being redesigned. The full challenge/rivalry system is
// temporarily disabled behind a polished "Coming Soon" placeholder.
export function ClubWars({ club }: { club: Club; isOfficer?: boolean }) {
  return (
    <div className="relative overflow-hidden rounded-3xl border border-border bg-card shadow-xl">
      <div className="absolute inset-0 bg-gradient-to-br from-primary/25 via-accent/10 to-transparent" />
      <div
        className="absolute inset-0 opacity-20"
        style={{
          backgroundImage:
            "radial-gradient(circle at 15% 25%, white 1px, transparent 1px), radial-gradient(circle at 75% 65%, white 1px, transparent 1px)",
          backgroundSize: "44px 44px",
        }}
      />
      <div className="absolute -inset-24 bg-primary/20 blur-3xl animate-pulse -z-0 pointer-events-none" />

      <div className="relative p-8 sm:p-12 flex flex-col items-center text-center gap-4 min-h-[360px] justify-center">
        <div className="inline-flex items-center gap-2 rounded-full bg-primary/15 text-primary px-3 py-1">
          <Sparkles className="h-3.5 w-3.5" />
          <span className="text-[10px] uppercase tracking-[0.2em] font-bold">Coming Soon</span>
        </div>

        <div className="p-4 rounded-2xl bg-background/60 backdrop-blur border border-border">
          <Swords className="h-10 w-10 text-primary" />
        </div>

        <h3 className="font-display text-2xl sm:text-3xl font-black">
          Clan Wars for {club.name}
        </h3>
        <p className="text-sm text-muted-foreground max-w-md">
          Challenge rival clubs, stake tokens, and climb the seasonal
          leaderboard. We're rebuilding this system from the ground up — stay
          tuned for a launch soon.
        </p>

        <div className="flex flex-wrap justify-center gap-2 pt-2 text-[10px] uppercase tracking-widest text-muted-foreground/70 font-bold">
          <span className="px-2 py-1 rounded-md bg-muted">Best-of formats</span>
          <span className="px-2 py-1 rounded-md bg-muted">Token wagers</span>
          <span className="px-2 py-1 rounded-md bg-muted">Live rivalries</span>
        </div>
      </div>
    </div>
  );
}
