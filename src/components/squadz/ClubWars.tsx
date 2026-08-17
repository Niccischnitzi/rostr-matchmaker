import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Swords, Trophy, Loader2, Check, X, Flag, Plus, Calendar } from "lucide-react";
import type { Club } from "@/lib/squadz-supabase";
import {
  WAR_FORMATS,
  createClubWar,
  fetchActiveSeason,
  fetchClubWars,
  fetchRivalClubs,
  fetchWarStandings,
  mapsToWin,
  reportClubWarResult,
  respondClubWar,
  type ClubWar,
} from "@/lib/wars";
import { ShardIcon } from "@/components/cosmetics/ShardIcon";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";

const GAMES = ["Valorant", "CS2", "League of Legends", "Rocket League", "Apex Legends", "Fortnite", "Overwatch 2", "Rainbow Six Siege"];

const statusStyle: Record<string, string> = {
  pending: "bg-primary/15 text-primary",
  accepted: "bg-success/15 text-success",
  active: "bg-success/15 text-success",
  reported: "bg-accent/20 text-accent-foreground",
  completed: "bg-muted text-muted-foreground",
  declined: "bg-muted text-muted-foreground",
  cancelled: "bg-muted text-muted-foreground",
};

export function ClubWars({ club, isOfficer = false }: { club: Club; isOfficer?: boolean }) {
  const qc = useQueryClient();
  const [tab, setTab] = useState<"wars" | "ladder">("wars");
  const [declaring, setDeclaring] = useState(false);

  const season = useQuery({ queryKey: ["war-season"], queryFn: fetchActiveSeason });
  const wars = useQuery({ queryKey: ["club-wars", club.id], queryFn: () => fetchClubWars(club.id) });
  const standings = useQuery({ queryKey: ["war-standings"], queryFn: fetchWarStandings });

  const clubIds = useMemo(() => {
    const ids = new Set<string>();
    (wars.data ?? []).forEach((w) => {
      ids.add(w.challenger_club_id);
      ids.add(w.defender_club_id);
    });
    return [...ids];
  }, [wars.data]);

  const names = useQuery({
    queryKey: ["war-club-names", clubIds.join(",")],
    enabled: clubIds.length > 0,
    queryFn: async () => {
      const rows = await fetchRivalClubs(club.id);
      const map = new Map<string, string>([[club.id, club.name]]);
      rows.forEach((r) => map.set(r.id, r.tag ? `${r.name} [${r.tag}]` : r.name));
      return map;
    },
  });

  const nameOf = (id: string) => (id === club.id ? club.name : names.data?.get(id) ?? "Crew");

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["club-wars", club.id] });
    qc.invalidateQueries({ queryKey: ["war-standings"] });
    qc.invalidateQueries({ queryKey: ["wallet"] });
  };

  const respond = useMutation({
    mutationFn: ({ id, accept }: { id: string; accept: boolean }) => respondClubWar(id, accept),
    onSuccess: (_d, v) => {
      toast.success(v.accept ? "War accepted — good luck" : "Challenge declined");
      refresh();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not respond"),
  });

  const openWars = (wars.data ?? []).filter((w) => ["pending", "accepted", "active", "reported"].includes(w.status));
  const pastWars = (wars.data ?? []).filter((w) => !["pending", "accepted", "active", "reported"].includes(w.status));

  const record = useMemo(() => {
    const done = (wars.data ?? []).filter((w) => w.status === "completed");
    const wins = done.filter((w) => w.winner_club_id === club.id).length;
    return { wins, losses: done.length - wins };
  }, [wars.data, club.id]);

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="relative overflow-hidden rounded-2xl border border-border bg-card">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/12 via-transparent to-transparent" />
        <div className="relative p-5 flex flex-wrap items-center gap-4">
          <div className="h-12 w-12 rounded-xl bg-primary/15 grid place-items-center shrink-0">
            <Swords className="h-6 w-6 text-primary" />
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="font-display text-xl font-black leading-tight">Clan Wars</h3>
            <p className="text-xs text-muted-foreground">
              {season.data ? `${season.data.name} · ends ${new Date(season.data.ends_at).toLocaleDateString()}` : "Season loading…"}
            </p>
          </div>
          <div className="flex items-center gap-4 text-center">
            <Stat label="Rating" value={String((club as unknown as { elo?: number }).elo ?? 1000)} />
            <Stat label="Won" value={String(record.wins)} />
            <Stat label="Lost" value={String(record.losses)} />
          </div>
          {isOfficer && (
            <button
              onClick={() => setDeclaring(true)}
              className="h-10 px-4 rounded-xl bg-primary text-primary-foreground text-xs font-bold flex items-center gap-1.5 hover:opacity-90"
            >
              <Plus className="h-4 w-4" /> Declare war
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 rounded-xl bg-surface w-fit">
        {(["wars", "ladder"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={cn(
              "h-8 px-4 rounded-lg text-xs font-bold capitalize transition-colors",
              tab === t ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
            )}
          >
            {t === "wars" ? "Our wars" : "Season ladder"}
          </button>
        ))}
      </div>

      {tab === "wars" ? (
        wars.isLoading ? (
          <div className="space-y-3">
            <Skeleton className="h-28 rounded-2xl" />
            <Skeleton className="h-28 rounded-2xl" />
          </div>
        ) : (wars.data ?? []).length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border bg-card/40 p-10 text-center">
            <Swords className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
            <p className="font-bold">No wars yet</p>
            <p className="text-sm text-muted-foreground mt-1">
              {isOfficer ? "Declare war on a rival crew to start climbing the ladder." : "Your officers can declare war on rival crews."}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {openWars.map((w) => (
              <WarCard
                key={w.id}
                war={w}
                club={club}
                isOfficer={isOfficer}
                nameOf={nameOf}
                onRespond={(accept) => respond.mutate({ id: w.id, accept })}
                busy={respond.isPending}
                onReported={refresh}
              />
            ))}
            {pastWars.length > 0 && (
              <>
                <p className="pt-2 text-[10px] uppercase tracking-widest font-bold text-muted-foreground">History</p>
                {pastWars.map((w) => (
                  <WarCard key={w.id} war={w} club={club} isOfficer={false} nameOf={nameOf} onReported={refresh} />
                ))}
              </>
            )}
          </div>
        )
      ) : standings.isLoading ? (
        <Skeleton className="h-64 rounded-2xl" />
      ) : (standings.data ?? []).length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-card/40 p-10 text-center">
          <Trophy className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
          <p className="font-bold">The ladder is empty</p>
          <p className="text-sm text-muted-foreground mt-1">Settle the first war of the season to take top spot.</p>
        </div>
      ) : (
        <div className="rounded-2xl border border-border bg-card overflow-hidden">
          <div className="grid grid-cols-[2.5rem_1fr_3rem_3rem_3.5rem_3rem] gap-2 px-4 py-2 text-[10px] uppercase tracking-widest font-bold text-muted-foreground border-b border-border">
            <span>#</span><span>Crew</span><span className="text-right">W</span><span className="text-right">L</span><span className="text-right">Diff</span><span className="text-right">Pts</span>
          </div>
          {(standings.data ?? []).map((s, i) => (
            <div
              key={s.club_id}
              className={cn(
                "grid grid-cols-[2.5rem_1fr_3rem_3rem_3.5rem_3rem] gap-2 px-4 py-2.5 text-sm border-b border-border/60 last:border-0",
                s.club_id === club.id && "bg-primary/10",
              )}
            >
              <span className="font-bold text-muted-foreground">{i + 1}</span>
              <span className="font-bold truncate">{s.club_name}{s.club_tag ? ` [${s.club_tag}]` : ""}</span>
              <span className="text-right font-mono">{s.wins}</span>
              <span className="text-right font-mono">{s.losses}</span>
              <span className="text-right font-mono">{s.map_diff > 0 ? `+${s.map_diff}` : s.map_diff}</span>
              <span className="text-right font-mono font-bold text-primary">{s.points}</span>
            </div>
          ))}
        </div>
      )}

      {declaring && <DeclareWarDialog club={club} onClose={() => setDeclaring(false)} onCreated={refresh} />}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="font-display text-lg font-black leading-none">{value}</p>
      <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold">{label}</p>
    </div>
  );
}

function WarCard({
  war,
  club,
  isOfficer,
  nameOf,
  onRespond,
  busy,
  onReported,
}: {
  war: ClubWar;
  club: Club;
  isOfficer: boolean;
  nameOf: (id: string) => string;
  onRespond?: (accept: boolean) => void;
  busy?: boolean;
  onReported: () => void;
}) {
  const [reporting, setReporting] = useState(false);
  const w = war as ClubWar & {
    challenger_score: number;
    defender_score: number;
    wager_shards: number;
    reported_club_id: string | null;
  };
  const iAmChallenger = w.challenger_club_id === club.id;
  const incoming = w.status === "pending" && !iAmChallenger;
  const awaitingMyConfirm = w.status === "reported" && w.reported_club_id !== club.id;
  const canScore = isOfficer && ["accepted", "active", "reported"].includes(w.status);

  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <div className="flex flex-wrap items-center gap-2 mb-3">
        <span className={cn("px-2 py-0.5 rounded-md text-[10px] uppercase tracking-widest font-bold", statusStyle[w.status] ?? "bg-muted")}>
          {w.status}
        </span>
        <span className="text-[10px] uppercase tracking-widest font-bold text-muted-foreground">{w.game_title} · {w.format}</span>
        {w.wager_shards > 0 && (
          <span className="inline-flex items-center gap-1 text-[10px] font-bold text-primary">
            <ShardIcon className="h-3 w-3" /> {w.wager_shards} each
          </span>
        )}
        {w.starts_at && (
          <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground font-semibold">
            <Calendar className="h-3 w-3" /> {new Date(w.starts_at).toLocaleString()}
          </span>
        )}
      </div>

      <div className="flex items-center gap-3">
        <Side name={nameOf(w.challenger_club_id)} mine={iAmChallenger} won={w.winner_club_id === w.challenger_club_id} />
        <div className="font-display text-xl font-black tabular-nums shrink-0">
          {w.status === "pending" ? "vs" : `${w.challenger_score}–${w.defender_score}`}
        </div>
        <Side name={nameOf(w.defender_club_id)} mine={!iAmChallenger} won={w.winner_club_id === w.defender_club_id} right />
      </div>

      {incoming && isOfficer && (
        <div className="flex gap-2 mt-4">
          <button
            onClick={() => onRespond?.(true)}
            disabled={busy}
            className="flex-1 h-9 rounded-lg bg-primary text-primary-foreground text-xs font-bold flex items-center justify-center gap-1.5 disabled:opacity-50"
          >
            {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />} Accept{w.wager_shards > 0 ? ` (${w.wager_shards} Shards)` : ""}
          </button>
          <button
            onClick={() => onRespond?.(false)}
            disabled={busy}
            className="h-9 px-4 rounded-lg border border-border bg-surface text-xs font-bold flex items-center gap-1.5 hover:bg-surface-2 disabled:opacity-50"
          >
            <X className="h-3.5 w-3.5" /> Decline
          </button>
        </div>
      )}

      {w.status === "pending" && iAmChallenger && (
        <p className="mt-3 text-xs text-muted-foreground">Waiting for {nameOf(w.defender_club_id)} to respond.</p>
      )}

      {canScore && !reporting && (
        <button
          onClick={() => setReporting(true)}
          className="mt-4 h-9 w-full rounded-lg border border-border bg-surface text-xs font-bold flex items-center justify-center gap-1.5 hover:bg-surface-2"
        >
          <Flag className="h-3.5 w-3.5" /> {awaitingMyConfirm ? "Confirm reported result" : "Report result"}
        </button>
      )}

      {w.status === "reported" && !awaitingMyConfirm && (
        <p className="mt-3 text-xs text-muted-foreground">Result submitted — waiting for the other crew to confirm.</p>
      )}

      {reporting && (
        <ReportForm
          war={w}
          challengerName={nameOf(w.challenger_club_id)}
          defenderName={nameOf(w.defender_club_id)}
          onClose={() => setReporting(false)}
          onDone={() => {
            setReporting(false);
            onReported();
          }}
        />
      )}
    </div>
  );
}

function Side({ name, mine, won, right }: { name: string; mine: boolean; won?: boolean; right?: boolean }) {
  return (
    <div className={cn("min-w-0 flex-1", right && "text-right")}>
      <p className={cn("font-bold truncate text-sm", won && "text-success")}>{name}</p>
      <p className="text-[10px] uppercase tracking-widest font-bold text-muted-foreground">{mine ? "Your crew" : "Rival"}</p>
    </div>
  );
}

function ReportForm({
  war,
  challengerName,
  defenderName,
  onClose,
  onDone,
}: {
  war: ClubWar & { challenger_score: number; defender_score: number };
  challengerName: string;
  defenderName: string;
  onClose: () => void;
  onDone: () => void;
}) {
  const needed = mapsToWin(war.format);
  const [a, setA] = useState(war.challenger_score || needed);
  const [b, setB] = useState(war.defender_score || 0);

  const submit = useMutation({
    mutationFn: () => reportClubWarResult(war.id, a, b),
    onSuccess: (res) => {
      toast.success(res.status === "completed" ? "War settled" : "Result reported — waiting on confirmation");
      onDone();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not report result"),
  });

  return (
    <div className="mt-4 rounded-xl border border-border bg-surface p-3 space-y-3">
      <p className="text-[10px] uppercase tracking-widest font-bold text-muted-foreground">
        Map score — winner must reach {needed}
      </p>
      <div className="flex items-center gap-3">
        <ScoreInput label={challengerName} value={a} onChange={setA} max={needed} />
        <span className="font-display font-black">–</span>
        <ScoreInput label={defenderName} value={b} onChange={setB} max={needed} />
      </div>
      <div className="flex gap-2">
        <button onClick={onClose} className="flex-1 h-9 rounded-lg border border-border bg-card text-xs font-bold hover:bg-surface-2">
          Cancel
        </button>
        <button
          onClick={() => submit.mutate()}
          disabled={submit.isPending}
          className="flex-1 h-9 rounded-lg bg-primary text-primary-foreground text-xs font-bold flex items-center justify-center gap-1.5 disabled:opacity-50"
        >
          {submit.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />} Submit
        </button>
      </div>
      <p className="text-[10px] text-muted-foreground">
        Both crews must submit the same score. Shards are paid out to the winning side once it matches.
      </p>
    </div>
  );
}

function ScoreInput({ label, value, onChange, max }: { label: string; value: number; onChange: (n: number) => void; max: number }) {
  return (
    <label className="flex-1 min-w-0">
      <span className="block text-[10px] font-bold truncate text-muted-foreground mb-1">{label}</span>
      <input
        type="number"
        min={0}
        max={max}
        value={value}
        onChange={(e) => onChange(Math.max(0, Math.min(max, Number(e.target.value) || 0)))}
        className="w-full h-9 rounded-lg border border-border bg-card px-3 text-sm font-mono font-bold"
      />
    </label>
  );
}

function DeclareWarDialog({ club, onClose, onCreated }: { club: Club; onClose: () => void; onCreated: () => void }) {
  const rivals = useQuery({ queryKey: ["war-rivals", club.id], queryFn: () => fetchRivalClubs(club.id) });
  const [defender, setDefender] = useState("");
  const [game, setGame] = useState(GAMES[0]);
  const [format, setFormat] = useState<string>("bo3");
  const [when, setWhen] = useState("");
  const [wager, setWager] = useState(0);

  const create = useMutation({
    mutationFn: () =>
      createClubWar({
        challengerClubId: club.id,
        defenderClubId: defender,
        game,
        format,
        scheduledAt: when ? new Date(when).toISOString() : null,
        wager,
      }),
    onSuccess: () => {
      toast.success("War declared");
      onCreated();
      onClose();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not declare war"),
  });

  const field = "w-full h-10 rounded-xl border border-border bg-surface px-3 text-sm";

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-background/80 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="w-full max-w-md rounded-2xl border border-border bg-card p-5 space-y-4" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h4 className="font-display text-lg font-black">Declare war</h4>
          <button onClick={onClose} className="h-8 w-8 rounded-lg hover:bg-surface grid place-items-center"><X className="h-4 w-4" /></button>
        </div>

        <div className="space-y-3">
          <Field label="Rival crew">
            {rivals.isLoading ? (
              <Skeleton className="h-10 rounded-xl" />
            ) : (
              <select value={defender} onChange={(e) => setDefender(e.target.value)} className={field}>
                <option value="">Choose a crew…</option>
                {(rivals.data ?? []).map((r) => (
                  <option key={r.id} value={r.id}>{r.tag ? `${r.name} [${r.tag}]` : r.name}</option>
                ))}
              </select>
            )}
          </Field>
          <Field label="Game">
            <select value={game} onChange={(e) => setGame(e.target.value)} className={field}>
              {GAMES.map((g) => <option key={g} value={g}>{g}</option>)}
            </select>
          </Field>
          <Field label="Format">
            <div className="flex gap-2">
              {WAR_FORMATS.map((f) => (
                <button
                  key={f.value}
                  onClick={() => setFormat(f.value)}
                  className={cn(
                    "flex-1 h-10 rounded-xl border text-xs font-bold",
                    format === f.value ? "border-primary bg-primary/10 text-primary" : "border-border bg-surface hover:bg-surface-2",
                  )}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </Field>
          <Field label="Scheduled (optional)">
            <input type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} className={field} />
          </Field>
          <Field label="Shard wager per side">
            <input
              type="number"
              min={0}
              max={5000}
              value={wager}
              onChange={(e) => setWager(Math.max(0, Math.min(5000, Number(e.target.value) || 0)))}
              className={field}
            />
          </Field>
          {wager > 0 && (
            <p className="text-[11px] text-muted-foreground">
              {wager} Shards are held from your balance now and matched by the defending officer on accept. The winning side takes the pool.
            </p>
          )}
        </div>

        <button
          onClick={() => create.mutate()}
          disabled={!defender || create.isPending}
          className="h-11 w-full rounded-xl bg-primary text-primary-foreground text-sm font-bold flex items-center justify-center gap-2 disabled:opacity-50"
        >
          {create.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Swords className="h-4 w-4" />} Declare war
        </button>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-[10px] uppercase tracking-widest font-bold text-muted-foreground mb-1.5">{label}</span>
      {children}
    </label>
  );
}
