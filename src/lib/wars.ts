import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

export type ClubWar = Database["public"]["Tables"]["club_wars"]["Row"];

export type WarStanding = {
  club_id: string;
  club_name: string;
  club_tag: string | null;
  elo: number;
  wins: number;
  losses: number;
  map_diff: number;
  points: number;
};

export type WarSeason = {
  id: string;
  name: string;
  slug: string;
  starts_at: string;
  ends_at: string;
  is_active: boolean;
};

export const WAR_FORMATS = [
  { value: "bo1", label: "Best of 1", maps: 1 },
  { value: "bo3", label: "Best of 3", maps: 2 },
  { value: "bo5", label: "Best of 5", maps: 3 },
] as const;

export function mapsToWin(format: string) {
  return WAR_FORMATS.find((f) => f.value === format)?.maps ?? 2;
}

export async function fetchActiveSeason() {
  const { data, error } = await supabase
    .from("war_seasons" as never)
    .select("id, name, slug, starts_at, ends_at, is_active")
    .eq("is_active", true)
    .order("starts_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return (data ?? null) as WarSeason | null;
}

export async function fetchClubWars(clubId: string) {
  const { data, error } = await supabase
    .from("club_wars")
    .select("*")
    .or(`challenger_club_id.eq.${clubId},defender_club_id.eq.${clubId}`)
    .order("created_at", { ascending: false })
    .limit(40);
  if (error) throw error;
  return (data ?? []) as ClubWar[];
}

export async function fetchWarStandings() {
  const { data, error } = await supabase.rpc("club_war_standings" as never, {} as never);
  if (error) throw error;
  return (data ?? []) as WarStanding[];
}

export async function fetchRivalClubs(clubId: string) {
  const { data, error } = await supabase
    .from("clubs")
    .select("id, name, tag, elo, member_count")
    .neq("id", clubId)
    .order("member_count", { ascending: false })
    .limit(60);
  if (error) throw error;
  return (data ?? []) as Array<{ id: string; name: string; tag: string | null; elo: number; member_count: number }>;
}

export async function createClubWar(input: {
  challengerClubId: string;
  defenderClubId: string;
  game: string;
  format: string;
  scheduledAt?: string | null;
  wager: number;
}) {
  const { data, error } = await supabase.rpc("create_club_war" as never, {
    _challenger_club: input.challengerClubId,
    _defender_club: input.defenderClubId,
    _game: input.game,
    _format: input.format,
    _scheduled_at: input.scheduledAt ?? null,
    _wager: input.wager,
  } as never);
  if (error) throw error;
  return data as unknown as ClubWar;
}

export async function respondClubWar(warId: string, accept: boolean) {
  const { data, error } = await supabase.rpc("respond_club_war" as never, {
    _war_id: warId,
    _accept: accept,
  } as never);
  if (error) throw error;
  return data as unknown as ClubWar;
}

export async function reportClubWarResult(warId: string, challengerScore: number, defenderScore: number) {
  const { data, error } = await supabase.rpc("report_club_war_result" as never, {
    _war_id: warId,
    _challenger_score: challengerScore,
    _defender_score: defenderScore,
  } as never);
  if (error) throw error;
  return data as unknown as ClubWar;
}

/* ── Participation: rosters & per-map submissions ─────────────────────── */

export type WarRosterEntry = {
  user_id: string;
  club_id: string;
  slot: number;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  submissions: number;
};

export type WarSubmission = {
  id: string;
  war_id: string;
  club_id: string;
  user_id: string;
  map_index: number;
  our_score: number;
  their_score: number;
  proof_url: string | null;
  note: string | null;
  created_at: string;
};

export async function fetchWarRoster(warId: string) {
  const { data, error } = await supabase.rpc("club_war_roster" as never, { _war_id: warId } as never);
  if (error) throw error;
  return (data ?? []) as WarRosterEntry[];
}

export async function fetchWarSubmissions(warId: string) {
  const { data, error } = await supabase
    .from("club_war_submissions" as never)
    .select("*")
    .eq("war_id", warId)
    .order("map_index", { ascending: true });
  if (error) throw error;
  return (data ?? []) as unknown as WarSubmission[];
}

export async function joinClubWar(warId: string) {
  const { data, error } = await supabase.rpc("join_club_war" as never, { _war_id: warId } as never);
  if (error) throw error;
  return data as unknown as { ok: boolean; already_joined: boolean; slot?: number; club_id?: string };
}

export async function leaveClubWar(warId: string) {
  const { error } = await supabase.rpc("leave_club_war" as never, { _war_id: warId } as never);
  if (error) throw error;
}

export async function submitClubWarResult(input: {
  warId: string;
  mapIndex: number;
  ourScore: number;
  theirScore: number;
  proofUrl?: string | null;
  note?: string | null;
}) {
  const { error } = await supabase.rpc("submit_club_war_result" as never, {
    _war_id: input.warId,
    _map_index: input.mapIndex,
    _our_score: input.ourScore,
    _their_score: input.theirScore,
    _proof_url: input.proofUrl ?? null,
    _note: input.note ?? null,
  } as never);
  if (error) throw error;
}
