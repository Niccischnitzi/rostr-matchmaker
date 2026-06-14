import { useState } from "react";
import { useSquadz } from "@/lib/squadz-store";
import { ArrowLeft, Crown, Hash, Volume2, Users, Swords, Flame } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export function ClubsTab() {
  const { clubs, joinClub } = useSquadz();
  const [selected, setSelected] = useState<string | null>(null);
  const club = clubs.find((c) => c.id === selected);

  if (club) return <ClubDetail clubId={club.id} onBack={() => setSelected(null)} />;

  const joined = clubs.filter((c) => c.joined);
  const discover = clubs.filter((c) => !c.joined);

  return (
    <div className="max-w-5xl mx-auto px-4 pt-6 lg:pt-10 pb-10">
      <h1 className="font-display text-3xl lg:text-4xl font-black tracking-tight">Clubs</h1>
      <p className="text-sm text-muted-foreground mt-1 mb-6">Communities, leaderboards, and live club wars.</p>

      {joined.length > 0 && (
        <>
          <SectionLabel>Your clubs</SectionLabel>
          <div className="grid sm:grid-cols-2 gap-3 mb-8">
            {joined.map((c) => <ClubCard key={c.id} club={c} onOpen={() => setSelected(c.id)} onToggle={() => joinClub(c.id)} />)}
          </div>
        </>
      )}

      <SectionLabel>Discover</SectionLabel>
      <div className="grid sm:grid-cols-2 gap-3">
        {discover.map((c) => (
          <ClubCard key={c.id} club={c}
            onOpen={() => setSelected(c.id)}
            onToggle={() => { joinClub(c.id); toast.success(`Joined ${c.name}`); }} />
        ))}
      </div>
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <p className="text-xs uppercase tracking-widest text-muted-foreground font-semibold mb-3">{children}</p>;
}

function ClubCard({ club, onOpen, onToggle }: { club: ReturnType<typeof useSquadz>["clubs"][number]; onOpen: () => void; onToggle: () => void }) {
  return (
    <div onClick={onOpen} className="group rounded-2xl border border-border bg-card overflow-hidden cursor-pointer hover:border-primary/40 transition-colors">
      <div className="h-20 relative" style={{ background: `linear-gradient(135deg, ${club.color}, ${club.color}88)` }}>
        <div className="absolute inset-0 opacity-20" style={{ backgroundImage: "radial-gradient(circle at 30% 30%, white 1px, transparent 1px)", backgroundSize: "20px 20px" }} />
        <div className="absolute -bottom-6 left-4 h-12 w-12 rounded-xl bg-card border-4 border-card grid place-items-center font-black text-sm" style={{ color: club.color }}>{club.tag}</div>
      </div>
      <div className="p-4 pt-8">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="font-bold truncate">{club.name}</p>
            <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5"><Users className="h-3 w-3" />{club.members} members</p>
          </div>
          <Button size="sm" variant={club.joined ? "outline" : "default"}
            onClick={(e) => { e.stopPropagation(); onToggle(); }}>
            {club.joined ? "Leave" : "Join"}
          </Button>
        </div>
        <p className="text-xs text-muted-foreground mt-2 line-clamp-2">{club.description}</p>
        {club.warAgainst && (
          <div className="mt-3 rounded-lg bg-primary/10 border border-primary/30 px-3 py-2 flex items-center gap-2 text-xs">
            <Swords className="h-3.5 w-3.5 text-primary" />
            <span className="font-semibold">War vs {club.warAgainst}</span>
            <span className="ml-auto font-mono">{club.warScore?.[0]}–{club.warScore?.[1]}</span>
          </div>
        )}
      </div>
    </div>
  );
}

function ClubDetail({ clubId, onBack }: { clubId: string; onBack: () => void }) {
  const { clubs } = useSquadz();
  const club = clubs.find((c) => c.id === clubId)!;
  const [tab, setTab] = useState<"leaderboard" | "channels">("leaderboard");

  return (
    <div className="max-w-5xl mx-auto px-4 pt-6 lg:pt-10 pb-10">
      <button onClick={onBack} className="text-sm text-muted-foreground flex items-center gap-1.5 mb-4 hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Back to Clubs
      </button>

      <div className="rounded-3xl border border-border bg-card overflow-hidden">
        <div className="h-32 relative" style={{ background: `linear-gradient(135deg, ${club.color}, ${club.color}66)` }}>
          <div className="absolute inset-0 opacity-20" style={{ backgroundImage: "radial-gradient(circle at 30% 30%, white 1px, transparent 1px)", backgroundSize: "24px 24px" }} />
        </div>
        <div className="p-5">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <div className="flex items-center gap-2">
                <h2 className="font-display text-2xl font-black">{club.name}</h2>
                <span className="text-xs font-mono px-2 py-0.5 rounded bg-surface border border-border">{club.tag}</span>
              </div>
              <p className="text-sm text-muted-foreground mt-1 flex items-center gap-1.5"><Users className="h-3.5 w-3.5" />{club.members} members</p>
            </div>
          </div>

          {club.warAgainst && (
            <div className="mt-4 rounded-2xl border border-primary/40 bg-gradient-to-r from-primary/15 to-transparent p-4">
              <div className="flex items-center gap-2 text-primary font-bold text-sm mb-2"><Flame className="h-4 w-4" /> ACTIVE CLUB WAR</div>
              <div className="flex items-center justify-between gap-4">
                <div className="text-center flex-1">
                  <p className="text-xs text-muted-foreground">{club.name}</p>
                  <p className="font-display text-3xl font-black text-primary">{club.warScore?.[0]}</p>
                </div>
                <div className="text-center">
                  <p className="text-xs text-muted-foreground">Ends in</p>
                  <p className="font-mono font-bold">{club.warTimeLeft}</p>
                </div>
                <div className="text-center flex-1">
                  <p className="text-xs text-muted-foreground">{club.warAgainst}</p>
                  <p className="font-display text-3xl font-black text-muted-foreground">{club.warScore?.[1]}</p>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="border-t border-border flex">
          {[["leaderboard", "Leaderboard"], ["channels", "Channels"]].map(([k, l]) => (
            <button key={k} onClick={() => setTab(k as never)}
              className={cn("flex-1 py-3 text-sm font-semibold border-b-2 transition-colors",
                tab === k ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground")}>{l}</button>
          ))}
        </div>

        {tab === "leaderboard" && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wider text-muted-foreground bg-surface/40">
                  <th className="px-4 py-3">#</th><th className="px-4 py-3">Player</th>
                  <th className="px-4 py-3 text-right">Kills/wk</th><th className="px-4 py-3 text-right">Wins</th>
                  <th className="px-4 py-3 text-right">Points</th>
                </tr>
              </thead>
              <tbody>
                {club.leaderboard.map((row) => (
                  <tr key={row.rank} className="border-t border-border hover:bg-surface/40">
                    <td className="px-4 py-3 font-mono font-bold">
                      {row.rank === 1 ? <Crown className="h-4 w-4 text-primary inline" /> : `#${row.rank}`}
                    </td>
                    <td className="px-4 py-3 font-semibold">{row.player}</td>
                    <td className="px-4 py-3 text-right font-mono">{row.kills}</td>
                    <td className="px-4 py-3 text-right font-mono">{row.wins}</td>
                    <td className="px-4 py-3 text-right font-mono font-bold text-primary">{row.points.toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {tab === "channels" && (
          <div className="p-4 space-y-1.5">
            {club.channels.map((ch) => (
              <div key={ch.name} className="rounded-lg hover:bg-surface px-3 py-2.5 cursor-pointer">
                <div className="flex items-center gap-2">
                  {ch.type === "text" ? <Hash className="h-4 w-4 text-muted-foreground" /> : <Volume2 className="h-4 w-4 text-success" />}
                  <span className="font-medium text-sm">{ch.name}</span>
                  {ch.type === "voice" && ch.sitting?.length ? (
                    <span className="ml-auto text-xs text-muted-foreground">{ch.sitting.length} in voice</span>
                  ) : null}
                </div>
                {ch.type === "voice" && ch.sitting && (
                  <div className="mt-2 pl-6 flex flex-wrap gap-1.5">
                    {ch.sitting.map((u) => (
                      <span key={u} className="text-xs px-2 py-0.5 rounded-full bg-success/15 text-success border border-success/30">🎙 {u}</span>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
