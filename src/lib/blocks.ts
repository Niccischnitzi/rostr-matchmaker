import { supabase } from "@/integrations/supabase/client";

export async function fetchBlockedIds(userId: string): Promise<Set<string>> {
  const { data } = await supabase.from("user_blocks" as any).select("blocked_id").eq("blocker_id", userId);
  return new Set(((data ?? []) as any[]).map((r) => r.blocked_id));
}

export async function blockUser(blocker: string, blocked: string) {
  return supabase
    .from("user_blocks" as any)
    .upsert({ blocker_id: blocker, blocked_id: blocked } as any, { onConflict: "blocker_id,blocked_id" });
}

export async function unblockUser(blocker: string, blocked: string) {
  return supabase.from("user_blocks" as any).delete().eq("blocker_id", blocker).eq("blocked_id", blocked);
}

export async function reportTarget(opts: {
  reporter_id: string;
  target_type: "profile" | "media_post" | "direct_message" | "crew" | "comment";
  target_id: string;
  reason: string;
  details?: string;
}) {
  return supabase.from("user_reports" as any).insert({
    ...opts,
    reason: opts.reason.trim().slice(0, 120),
    details: opts.details?.trim().slice(0, 1000) || null,
  } as any);
}
