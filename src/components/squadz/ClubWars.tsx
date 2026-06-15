import { useEffect, useMemo, useState } from "react";
import { Swords, Loader2, Plus, Trophy, Flame, Clock, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import type { Club } from "@/lib/squadz-supabase";

type WarStatus = "pending" | "accepted" | "declined" | "active" | "completed" | "cancelled";

interface ClubWar {
  id: string;
  challenger_club_id: string;
  defender_club_id: string;
  game_title: string;
  ruleset: string;
  format: string;
  wager_pool: number;
  status: WarStatus;
  starts_at: string | null;
  ends_at: string | null;
  winner_club_id: string | null;
  created_at: string;
}

const FORMATS = [
  { id: "bo1", label: "Best of 1" },
  { id: "bo3", label: "Best of 3" },
  { id: "bo5", label: "Best of 5" },
  { id: "kill_race", label: "Kill Race" },
  { id: "score_attack", label: "Score Attack" },
];

export function ClubWars({ club, isOfficer }: { club: Club; isOfficer: boolean }) {
  const [tab, setTab] = useState<"active" | "history">("active");
  const [wars, setWars] = useState<ClubWar[]>([]);
  const [clubMap, setClubMap] = useState<Map<string, Club>>(new Map());
  const [loading, setLoading] = useState(true);
  const [showChallenge, setShowChallenge] = useState(false);

  async function reload() {
    const { data } = await supabase
      .from("club_wars" as any)
      .select("*")
      .or(`challenger_club_id.eq.${club.id},defender_club_id.eq.${club.id}`)
      .order("created_at", { ascending: false });
    const rows = (data ?? []) as unknown as ClubWar[];
    setWars(rows);
    const ids = Array.from(new Set(rows.flatMap((w) => [w.challenger_club_id, w.defender_club_id])));
    if (ids.length) {
      const { data: cs } = await supabase.from("clubs").select("*").in("id", ids);
      setClubMap(new Map((cs ?? []).map((c) => [c.id, c as Club])));
    }
    setLoading(false);
  }

  useEffect(() => {
    reload();
    const ch = supabase
      .channel(`club-wars-${club.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "club_wars" }, reload)
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [club.id]);

  const active = useMemo(
    () => wars.filter((w) => ["pending", "accepted", "active"].includes(w.status)),
    [wars],
  );
  const history = useMemo(
    () => wars.filter((w) => ["completed", "declined", "cancelled"].includes(w.status)),
    [wars],
  );

  const rivalries = useMemo(() => {
    const map = new Map<string, { rivalId: string; wins: number; losses: number; streak: number; lastResult: "W" | "L" | null }>();
    for (const w of history.filter((h) => h.status === "completed")) {
      const rivalId = w.challenger_club_id === club.id ? w.defender_club_id : w.challenger_club_id;
      const win = w.winner_club_id === club.id;
      const cur = map.get(rivalId) ?? { rivalId, wins: 0, losses: 0, streak: 0, lastResult: null as "W" | "L" | null };
      if (win) cur.wins += 1;
      else cur.losses += 1;
      const result: "W" | "L" = win ? "W" : "L";
      if (cur.lastResult === result) cur.streak += 1;
      else {
        cur.streak = 1;
        cur.lastResult = result;
      }
      map.set(rivalId, cur);
    }
    return Array.from(map.values()).sort((a, b) => b.wins + b.losses - (a.wins + a.losses));
  }, [history, club.id]);

  async function setStatus(warId: string, status: WarStatus, winnerClubId?: string | null) {
    const patch: Record<string, unknown> = { status };
    if (winnerClubId !== undefined) patch.winner_club_id = winnerClubId;
    if (status === "active") patch.starts_at = new Date().toISOString();
    if (status === "completed") patch.ends_at = new Date().toISOString();
    const { error } = await supabase.from("club_wars" as any).update(patch).eq("id", warId);
    if (error) toast.error(error.message);
    else toast.success("War updated");
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <Swords className="h-5 w-5 text-primary" />
          <h3 className="font-display text-xl font-black">Club Wars</h3>
        </div>
        {isOfficer && (
          <Button size="sm" className="gap-1.5" onClick={() => setShowChallenge(true)}>
            <Plus className="h-4 w-4" /> Challenge a club
          </Button>
        )}
      </div>

      <div className="inline-flex rounded-full bg-muted p-1">
        {([
          ["active", `Active (${active.length})`, Flame],
          ["history", `History & Rivalries`, Trophy],
        ] as const).map(([id, label, Icon]) => (
          <button
            key={id}
            onClick={() => setTab(id as "active" | "history")}
            className={cn(
              "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition",
              tab === id
                ? "bg-background shadow text-foreground"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            <Icon className="h-3.5 w-3.5" /> {label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="py-10 grid place-items-center text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
        </div>
      ) : tab === "active" ? (
        active.length === 0 ? (
          <EmptyState message="No active wars. Challenge a rival club to start one." />
        ) : (
          <div className="space-y-2">
            {active.map((w) => (
              <WarRow
                key={w.id}
                war={w}
                myClubId={club.id}
                clubMap={clubMap}
                canManage={isOfficer && (w.challenger_club_id === club.id || w.defender_club_id === club.id)}
                isDefender={w.defender_club_id === club.id}
                onAccept={() => setStatus(w.id, "accepted")}
                onDecline={() => setStatus(w.id, "declined")}
                onStart={() => setStatus(w.id, "active")}
                onComplete={(winnerId) => setStatus(w.id, "completed", winnerId)}
                onCancel={() => setStatus(w.id, "cancelled")}
              />
            ))}
          </div>
        )
      ) : (
        <div className="space-y-6">
          {rivalries.length > 0 && (
            <div>
              <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold mb-2">Top rivalries</p>
              <div className="grid sm:grid-cols-2 gap-2">
                {rivalries.slice(0, 4).map((r) => {
                  const rival = clubMap.get(r.rivalId);
                  return (
                    <div key={r.rivalId} className="rounded-xl border border-border bg-card p-3 flex items-center justify-between">
                      <div>
                        <p className="font-bold text-sm">{rival?.name ?? "Unknown club"}</p>
                        <p className="text-xs text-muted-foreground">
                          {r.wins}W – {r.losses}L
                        </p>
                      </div>
                      <span
                        className={cn(
                          "text-xs font-mono px-2 py-1 rounded-md",
                          r.lastResult === "W"
                            ? "bg-emerald-500/15 text-emerald-500"
                            : "bg-rose-500/15 text-rose-500",
                        )}
                      >
                        {r.lastResult ?? "–"}{r.streak > 1 ? `×${r.streak}` : ""}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <div>
            <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold mb-2">Past wars</p>
            {history.length === 0 ? (
              <EmptyState message="No completed wars yet." />
            ) : (
              <div className="space-y-2">
                {history.map((w) => (
                  <WarRow key={w.id} war={w} myClubId={club.id} clubMap={clubMap} canManage={false} isDefender={false} />
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {showChallenge && (
        <ChallengeModal
          fromClub={club}
          onClose={() => setShowChallenge(false)}
          onCreated={() => {
            setShowChallenge(false);
            reload();
          }}
        />
      )}
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
      {message}
    </div>
  );
}

function WarRow({
  war,
  myClubId,
  clubMap,
  canManage,
  isDefender,
  onAccept,
  onDecline,
  onStart,
  onComplete,
  onCancel,
}: {
  war: ClubWar;
  myClubId: string;
  clubMap: Map<string, Club>;
  canManage: boolean;
  isDefender: boolean;
  onAccept?: () => void;
  onDecline?: () => void;
  onStart?: () => void;
  onComplete?: (winnerClubId: string) => void;
  onCancel?: () => void;
}) {
  const challenger = clubMap.get(war.challenger_club_id);
  const defender = clubMap.get(war.defender_club_id);
  const won = war.winner_club_id === myClubId;
  const formatLabel = FORMATS.find((f) => f.id === war.format)?.label ?? war.format;

  return (
    <div className="rounded-2xl border border-border bg-card p-4 space-y-3">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2 min-w-0">
          <span className="font-bold truncate">{challenger?.name ?? "—"}</span>
          <Swords className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
          <span className="font-bold truncate">{defender?.name ?? "—"}</span>
        </div>
        <StatusBadge status={war.status} won={war.status === "completed" ? won : null} />
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
        <span>🎮 {war.game_title}</span>
        <span>📋 {formatLabel}</span>
        {war.wager_pool > 0 && <span>💰 {war.wager_pool.toLocaleString()} tokens</span>}
        {war.starts_at && (
          <span className="flex items-center gap-1">
            <Clock className="h-3 w-3" /> {new Date(war.starts_at).toLocaleString()}
          </span>
        )}
      </div>
      {war.ruleset && <p className="text-xs text-muted-foreground italic">"{war.ruleset}"</p>}
      {canManage && (
        <div className="flex gap-2 flex-wrap pt-1">
          {war.status === "pending" && isDefender && onAccept && onDecline && (
            <>
              <Button size="sm" onClick={onAccept}>Accept</Button>
              <Button size="sm" variant="outline" onClick={onDecline}>Decline</Button>
            </>
          )}
          {war.status === "pending" && !isDefender && onCancel && (
            <Button size="sm" variant="outline" onClick={onCancel}>Cancel</Button>
          )}
          {war.status === "accepted" && onStart && (
            <Button size="sm" onClick={onStart}>Start war</Button>
          )}
          {war.status === "active" && onComplete && challenger && defender && (
            <>
              <Button size="sm" onClick={() => onComplete(war.challenger_club_id)}>
                {challenger.name} wins
              </Button>
              <Button size="sm" onClick={() => onComplete(war.defender_club_id)}>
                {defender.name} wins
              </Button>
            </>
          )}
        </div>
      )}
    </div>
  );
}

function StatusBadge({ status, won }: { status: WarStatus; won: boolean | null }) {
  const styles: Record<WarStatus, string> = {
    pending: "bg-amber-500/15 text-amber-500",
    accepted: "bg-sky-500/15 text-sky-500",
    active: "bg-primary/15 text-primary",
    completed: won ? "bg-emerald-500/15 text-emerald-500" : "bg-rose-500/15 text-rose-500",
    declined: "bg-muted text-muted-foreground",
    cancelled: "bg-muted text-muted-foreground",
  };
  const label = status === "completed" ? (won ? "Won" : "Lost") : status[0].toUpperCase() + status.slice(1);
  return <span className={cn("text-[10px] uppercase tracking-widest font-bold px-2 py-1 rounded-md", styles[status])}>{label}</span>;
}

function ChallengeModal({
  fromClub,
  onClose,
  onCreated,
}: {
  fromClub: Club;
  onClose: () => void;
  onCreated: () => void;
}) {
  const { user } = useAuth();
  const [search, setSearch] = useState("");
  const [results, setResults] = useState<Club[]>([]);
  const [defender, setDefender] = useState<Club | null>(null);
  const [gameTitle, setGameTitle] = useState("");
  const [ruleset, setRuleset] = useState("");
  const [format, setFormat] = useState("bo3");
  const [startsAt, setStartsAt] = useState("");
  const [wager, setWager] = useState(0);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const q = supabase.from("clubs").select("*").neq("id", fromClub.id).limit(8);
      const { data } = search.trim()
        ? await q.ilike("name", `%${search.trim()}%`)
        : await q.order("member_count", { ascending: false });
      if (!cancelled) setResults((data ?? []) as Club[]);
    })();
    return () => {
      cancelled = true;
    };
  }, [search, fromClub.id]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!user || !defender || !gameTitle.trim()) return;
    setBusy(true);
    const { error } = await supabase.from("club_wars" as any).insert({
      challenger_club_id: fromClub.id,
      defender_club_id: defender.id,
      game_title: gameTitle.trim(),
      ruleset: ruleset.trim() || "Standard rules",
      format,
      wager_pool: Math.max(0, wager),
      starts_at: startsAt ? new Date(startsAt).toISOString() : null,
      created_by: user.id,
    });
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(`Challenge sent to ${defender.name}`);
    onCreated();
  }

  return (
    <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm grid place-items-center p-4" onClick={onClose}>
      <form
        className="w-full max-w-lg rounded-2xl border border-border bg-card shadow-2xl p-5 space-y-4 max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
        onSubmit={submit}
      >
        <div className="flex items-center justify-between">
          <p className="font-bold text-lg flex items-center gap-2">
            <Swords className="h-5 w-5 text-primary" /> Challenge a club
          </p>
          <button type="button" onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X className="h-4 w-4" />
          </button>
        </div>

        {!defender ? (
          <div className="space-y-2">
            <label className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">Pick a defender</label>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search clubs by name…"
              className="w-full rounded-xl bg-surface border border-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            />
            <div className="max-h-64 overflow-y-auto space-y-1 mt-2">
              {results.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setDefender(c)}
                  className="w-full text-left rounded-lg border border-border bg-background px-3 py-2 hover:border-primary/50 transition"
                >
                  <p className="font-semibold text-sm">{c.name}</p>
                  <p className="text-xs text-muted-foreground">{c.member_count} members</p>
                </button>
              ))}
              {results.length === 0 && (
                <p className="text-xs text-muted-foreground py-4 text-center">No clubs match.</p>
              )}
            </div>
          </div>
        ) : (
          <>
            <div className="rounded-xl border border-border bg-surface p-3 flex items-center justify-between">
              <div>
                <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">Defender</p>
                <p className="font-bold">{defender.name}</p>
              </div>
              <Button type="button" size="sm" variant="outline" onClick={() => setDefender(null)}>
                Change
              </Button>
            </div>

            <Field label="Game title" value={gameTitle} onChange={setGameTitle} placeholder="Apex Legends" required />

            <div>
              <label className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">Format</label>
              <select
                value={format}
                onChange={(e) => setFormat(e.target.value)}
                className="mt-1 w-full rounded-xl bg-surface border border-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              >
                {FORMATS.map((f) => (
                  <option key={f.id} value={f.id}>{f.label}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">Ruleset / notes</label>
              <textarea
                value={ruleset}
                onChange={(e) => setRuleset(e.target.value)}
                rows={2}
                placeholder="Map pool, banned weapons, captain rules…"
                className="mt-1 w-full rounded-xl bg-surface border border-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">Time window</label>
                <input
                  type="datetime-local"
                  value={startsAt}
                  onChange={(e) => setStartsAt(e.target.value)}
                  className="mt-1 w-full rounded-xl bg-surface border border-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
              <div>
                <label className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">Wager (tokens)</label>
                <input
                  type="number"
                  min={0}
                  value={wager}
                  onChange={(e) => setWager(parseInt(e.target.value) || 0)}
                  className="mt-1 w-full rounded-xl bg-surface border border-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
            </div>

            <div className="flex gap-2 justify-end">
              <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
              <Button type="submit" disabled={busy || !gameTitle.trim()}>
                {busy && <Loader2 className="h-4 w-4 animate-spin mr-1.5" />}Send challenge
              </Button>
            </div>
          </>
        )}
      </form>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  required,
  maxLength,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  required?: boolean;
  maxLength?: number;
}) {
  return (
    <div>
      <label className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">{label}</label>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        required={required}
        maxLength={maxLength}
        className="mt-1 w-full rounded-xl bg-surface border border-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
      />
    </div>
  );
}
