import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

export type Profile = Database["public"]["Tables"]["profiles"]["Row"];
export type Conversation = Database["public"]["Tables"]["conversations"]["Row"];
export type DirectMessage = Database["public"]["Tables"]["direct_messages"]["Row"];
export type Club = Database["public"]["Tables"]["clubs"]["Row"];
export type ClubChannel = Database["public"]["Tables"]["club_channels"]["Row"];
export type ClubMessage = Database["public"]["Tables"]["club_messages"]["Row"];
export type ClubMember = Database["public"]["Tables"]["club_members"]["Row"];
export type Clan = Database["public"]["Tables"]["clans"]["Row"];
export type ClanMember = Database["public"]["Tables"]["clan_members"]["Row"];
export type Challenge = Database["public"]["Tables"]["challenges"]["Row"];
export type Wallet = Database["public"]["Tables"]["wallets"]["Row"];
export type Tournament = Database["public"]["Tables"]["tournaments"]["Row"];
export type TournamentEntry = Database["public"]["Tables"]["tournament_entries"]["Row"];
export type LeaderboardEntry = Database["public"]["Tables"]["leaderboard_entries"]["Row"];

export function orderedPair(a: string, b: string): [string, string] {
  return a < b ? [a, b] : [b, a];
}

export async function getOrCreateConversation(meId: string, otherId: string) {
  // `meId` is kept for older callers; auth.uid() is authoritative in the RPC.
  void meId;
  const { data, error } = await supabase.rpc("get_or_create_conversation" as any, { _other_user: otherId });
  if (error) throw error;
  return data as Conversation;
}

export async function requestFriend(targetUserId: string) {
  const { data, error } = await supabase.rpc("request_friend" as any, { _target_user: targetUserId });
  if (error) throw error;
  return data as { ok: boolean; status: "pending" | "accepted" | "blocked"; matched?: boolean; friendship_id?: string };
}

export async function sendDirectMessageToUser(otherUserId: string, body: string, attachmentUrl?: string | null) {
  const { data, error } = await supabase.rpc("send_dm_to_user" as any, {
    _other_user: otherUserId,
    _body: body,
    _attachment_url: attachmentUrl ?? null,
  });
  if (error) throw error;
  return data as { ok: boolean; conversation: Conversation; message: DirectMessage };
}

export async function joinLfgAd(adId: string) {
  const { data, error } = await supabase.rpc("join_lfg_ad" as any, { _ad_id: adId });
  if (error) throw error;
  return data as { ok: boolean; already_joined: boolean; ad: Record<string, unknown> };
}

export async function submitMatchRating(input: {
  targetUserId: string;
  challengeId: string;
  chemistry: number;
  comms: number;
  reliability: number;
  tags?: string[];
  note?: string;
}) {
  const { data, error } = await supabase.rpc("submit_match_rating" as any, {
    _target_user: input.targetUserId,
    _challenge_id: input.challengeId,
    _chemistry: input.chemistry,
    _comms: input.comms,
    _reliability: input.reliability,
    _tags: input.tags ?? [],
    _note: input.note ?? null,
  });
  if (error) throw error;
  return data as { ok: boolean; rating_id: string };
}

export async function getPairChemistry(otherUserId: string) {
  const { data, error } = await supabase.rpc("pair_chemistry" as any, { _other_user: otherUserId });
  if (error) throw error;
  const row = Array.isArray(data) ? data[0] : data;
  return (row ?? { score: 0, sessions: 0, label: "New duo" }) as { score: number; sessions: number; label: string };
}

export async function getProfileRatingSummary(userId: string) {
  const { data, error } = await supabase.rpc("profile_rating_summary" as any, { _user_id: userId });
  if (error) throw error;
  const row = Array.isArray(data) ? data[0] : data;
  return (row ?? { avg_score: 0, rating_count: 0, top_tags: [] }) as { avg_score: number; rating_count: number; top_tags: string[] };
}

export async function fetchProfiles(ids: string[]) {
  if (ids.length === 0) return [] as Profile[];
  const { data, error } = await supabase.from("profiles").select("*").in("id", ids);
  if (error) throw error;
  return data;
}
