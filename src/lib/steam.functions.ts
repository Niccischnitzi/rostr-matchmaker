// Sprint 4 — finalize the Steam link from the client after the OpenID
// redirect lands. Requires the signed-in user. Enforces one-rostr-account-per-Steam.
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const Input = z.object({
  external_id: z.string().regex(/^\d{17}$/),
  display_name: z.string().max(120).nullable().optional(),
  avatar_url: z.string().url().max(500).nullable().optional(),
});

export const linkSteam = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => Input.parse(data))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    // Enforce one rostr account per Steam id.
    const { data: existing } = await supabase
      .from("linked_accounts")
      .select("user_id")
      .eq("provider", "steam")
      .eq("external_id", data.external_id)
      .maybeSingle();
    if (existing && existing.user_id !== userId) {
      return { error: "This Steam account is already linked to another rostr profile." };
    }

    const { error } = await supabase
      .from("linked_accounts")
      .upsert(
        {
          user_id: userId,
          provider: "steam",
          external_id: data.external_id,
          display_name: data.display_name ?? null,
          avatar_url: data.avatar_url ?? null,
        },
        { onConflict: "user_id,provider" }
      );
    if (error) return { error: error.message };
    return { ok: true as const };
  });
