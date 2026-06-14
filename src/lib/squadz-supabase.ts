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
  const [user_a, user_b] = orderedPair(meId, otherId);
  const existing = await supabase
    .from("conversations").select("*").eq("user_a", user_a).eq("user_b", user_b).maybeSingle();
  if (existing.data) return existing.data;
  const inserted = await supabase.from("conversations").insert({ user_a, user_b }).select("*").single();
  if (inserted.error) throw inserted.error;
  return inserted.data;
}

export async function fetchProfiles(ids: string[]) {
  if (ids.length === 0) return [] as Profile[];
  const { data, error } = await supabase.from("profiles").select("*").in("id", ids);
  if (error) throw error;
  return data;
}
