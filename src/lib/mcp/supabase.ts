import { createClient } from "@supabase/supabase-js";
import type { ToolContext } from "@lovable.dev/mcp-js";
import type { Database } from "@/integrations/supabase/types";

/**
 * Build a Supabase client scoped to the signed-in Rostr user for the current
 * MCP tool call. RLS runs as that user — never use the service-role key here.
 * Throws if the caller is not authenticated (isAuthenticated should be checked first).
 */
export function supabaseForUser(ctx: ToolContext) {
  const token = ctx.getToken();
  if (!token) throw new Error("Not authenticated");
  return createClient<Database>(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_PUBLISHABLE_KEY!,
    {
      global: { headers: { Authorization: `Bearer ${token}` } },
      auth: { persistSession: false, autoRefreshToken: false },
    },
  );
}

export function requireUser(ctx: ToolContext): { uid: string } | { error: string } {
  const uid = ctx.getUserId();
  if (!ctx.isAuthenticated() || !uid) return { error: "Not authenticated" };
  return { uid };
}
