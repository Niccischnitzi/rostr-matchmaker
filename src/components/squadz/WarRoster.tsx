import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2, LogOut, UserPlus, Upload, Link2, Users } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import {
  fetchWarRoster,
  fetchWarSubmissions,
  joinClubWar,
  leaveClubWar,
  submitClubWarResult,
  mapsToWin,
  type ClubWar,
} from "@/lib/wars";

/**
 * Roster + per-map submissions for a single war. Members claim a slot, then
 * every participant can submit their own map score with optional proof.
 */
export function WarRoster({
  war,
  myClubId,
  rivalName,
  onChanged,
}: {
  war: ClubWar & { roster_size?: number };
  myClubId: string;
  rivalName: string;
  onChanged?: () => void;
}) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const size = war.roster_size ?? 5;
  const signupsOpen = ["pending", "accepted", "active"].includes(war.status);

  const roster = useQuery({ queryKey: ["war-roster", war.id], queryFn: () => fetchWarRoster(war.id) });
  const subs = useQuery({ queryKey: ["war-subs", war.id], queryFn: () => fetchWarSubmissions(war.id) });

  // Live: any roster/submission change refreshes this war instantly.
  useEffect(() => {
    const ch = supabase
      .channel(`war-${war.id}-${Math.random().toString(36).slice(2, 8)}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "club_war_participants", filter: `war_id=eq.${war.id}` }, () => {
        void qc.invalidateQueries({ queryKey: ["war-roster", war.id] });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "club_war_submissions", filter: `war_id=eq.${war.id}` }, () => {
        void qc.invalidateQueries({ queryKey: ["war-subs", war.id] });
        void qc.invalidateQueries({ queryKey: ["war-roster", war.id] });
      })
      .subscribe();
    return () => { void supabase.removeChannel(ch); };
  }, [war.id, qc]);

  const mine = useMemo(() => (roster.data ?? []).filter((r) => r.club_id === myClubId), [roster.data, myClubId]);
  const theirs = useMemo(() => (roster.data ?? []).filter((r) => r.club_id !== myClubId), [roster.data, myClubId]);
  const joined = !!user?.id && mine.some((r) => r.user_id === user.id);
  const full = mine.length >= size;

  const refresh = () => {
    void qc.invalidateQueries({ queryKey: ["war-roster", war.id] });
    void qc.invalidateQueries({ queryKey: ["war-subs", war.id] });
    onChanged?.();
  };

  const join = useMutation({
    mutationFn: () => joinClubWar(war.id),
    onSuccess: (res) => {
      toast.success(res.already_joined ? "You're already on the roster" : `Slot ${res.slot} claimed`);
      refresh();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not join"),
  });

  const leave = useMutation({
    mutationFn: () => leaveClubWar(war.id),
    onSuccess: () => {
      toast.success("You left the roster");
      refresh();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not leave"),
  });

  return (
    <div className="mt-4 rounded-xl border border-border bg-surface p-3 space-y-4">
      <div className="flex items-center justify-between gap-2">
        <p className="inline-flex items-center gap-1.5 text-[10px] uppercase tracking-widest font-bold text-muted-foreground">
          <Users className="h-3.5 w-3.5" /> Roster · {mine.length}/{size} slots
        </p>
        {signupsOpen && (
          joined ? (
            <button
              onClick={() => leave.mutate()}
              disabled={leave.isPending}
              className="h-8 px-3 rounded-lg border border-border bg-card text-[11px] font-bold inline-flex items-center gap-1.5 hover:bg-surface-2 disabled:opacity-50"
            >
              {leave.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <LogOut className="h-3 w-3" />} Leave
            </button>
          ) : (
            <button
              onClick={() => join.mutate()}
              disabled={join.isPending || full}
              className="h-8 px-3 rounded-lg bg-primary text-primary-foreground text-[11px] font-bold inline-flex items-center gap-1.5 disabled:opacity-50"
            >
              {join.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <UserPlus className="h-3 w-3" />}
              {full ? "Roster full" : "Claim slot"}
            </button>
          )
        )}
      </div>

      {roster.isLoading ? (
        <div className="grid sm:grid-cols-2 gap-3">
          <Skeleton className="h-24 rounded-lg" />
          <Skeleton className="h-24 rounded-lg" />
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 gap-3">
          <SlotColumn title="Your crew" size={size} entries={mine} meId={user?.id} />
          <SlotColumn title={rivalName} size={size} entries={theirs} meId={user?.id} />
        </div>
      )}

      {joined && signupsOpen && (
        <SubmitMapForm war={war} onDone={refresh} />
      )}

      {(subs.data ?? []).length > 0 && (
        <div className="space-y-1.5">
          <p className="text-[10px] uppercase tracking-widest font-bold text-muted-foreground">Submissions</p>
          {(subs.data ?? []).map((s) => {
            const who = (roster.data ?? []).find((r) => r.user_id === s.user_id);
            const ours = s.club_id === myClubId;
            return (
              <div key={s.id} className="flex items-center gap-2 rounded-lg bg-card border border-border px-3 py-2 text-xs">
                <span className="font-mono font-bold text-muted-foreground shrink-0">M{s.map_index}</span>
                <span className="truncate font-semibold">{who?.display_name ?? who?.username ?? "Player"}</span>
                <span className={cn("ml-auto font-mono font-bold shrink-0", ours ? "text-primary" : "text-muted-foreground")}>
                  {s.our_score}–{s.their_score}
                </span>
                {s.proof_url && (
                  <a href={s.proof_url} target="_blank" rel="noreferrer" className="shrink-0 text-primary hover:underline">
                    <Link2 className="h-3.5 w-3.5" />
                  </a>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function SlotColumn({
  title,
  size,
  entries,
  meId,
}: {
  title: string;
  size: number;
  entries: Array<{ user_id: string; slot: number; username: string; display_name: string | null; submissions: number }>;
  meId?: string;
}) {
  const slots = Array.from({ length: size }, (_, i) => i + 1);
  return (
    <div className="rounded-lg border border-border bg-card p-2.5">
      <p className="text-[10px] uppercase tracking-widest font-bold text-muted-foreground truncate mb-2">{title}</p>
      <div className="space-y-1">
        {slots.map((slot) => {
          const e = entries.find((x) => x.slot === slot);
          return (
            <div
              key={slot}
              className={cn(
                "flex items-center gap-2 h-7 px-2 rounded-md text-xs",
                e ? "bg-surface" : "border border-dashed border-border text-muted-foreground",
                e && e.user_id === meId && "ring-1 ring-primary",
              )}
            >
              <span className="font-mono text-[10px] font-bold text-muted-foreground w-3">{slot}</span>
              <span className="truncate font-semibold">{e ? e.display_name ?? e.username : "Open slot"}</span>
              {e && e.submissions > 0 && (
                <span className="ml-auto text-[10px] font-bold text-primary shrink-0">{e.submissions} sent</span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function SubmitMapForm({ war, onDone }: { war: ClubWar; onDone: () => void }) {
  const maps = mapsToWin(war.format) * 2 - 1;
  const [mapIndex, setMapIndex] = useState(1);
  const [ours, setOurs] = useState(13);
  const [theirs, setTheirs] = useState(0);
  const [proof, setProof] = useState("");

  const submit = useMutation({
    mutationFn: () =>
      submitClubWarResult({ warId: war.id, mapIndex, ourScore: ours, theirScore: theirs, proofUrl: proof }),
    onSuccess: () => {
      toast.success(`Map ${mapIndex} submitted`);
      setProof("");
      onDone();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not submit"),
  });

  const field = "h-9 rounded-lg border border-border bg-card px-2 text-sm font-mono font-bold";

  return (
    <div className="rounded-lg border border-border bg-card p-3 space-y-2">
      <p className="text-[10px] uppercase tracking-widest font-bold text-muted-foreground">Submit your map score</p>
      <div className="flex gap-2">
        <select value={mapIndex} onChange={(e) => setMapIndex(Number(e.target.value))} className={cn(field, "flex-1")}>
          {Array.from({ length: maps }, (_, i) => i + 1).map((m) => (
            <option key={m} value={m}>Map {m}</option>
          ))}
        </select>
        <input type="number" min={0} max={99} value={ours} onChange={(e) => setOurs(Math.max(0, Math.min(99, Number(e.target.value) || 0)))} className={cn(field, "w-16 text-center")} aria-label="Your score" />
        <span className="self-center font-display font-black">–</span>
        <input type="number" min={0} max={99} value={theirs} onChange={(e) => setTheirs(Math.max(0, Math.min(99, Number(e.target.value) || 0)))} className={cn(field, "w-16 text-center")} aria-label="Rival score" />
      </div>
      <input
        value={proof}
        onChange={(e) => setProof(e.target.value)}
        placeholder="Proof link (scoreboard screenshot, VOD) — optional"
        className="w-full h-9 rounded-lg border border-border bg-surface px-3 text-xs"
      />
      <button
        onClick={() => submit.mutate()}
        disabled={submit.isPending}
        className="h-9 w-full rounded-lg bg-primary text-primary-foreground text-xs font-bold inline-flex items-center justify-center gap-1.5 disabled:opacity-50"
      >
        {submit.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />} Submit map result
      </button>
    </div>
  );
}
