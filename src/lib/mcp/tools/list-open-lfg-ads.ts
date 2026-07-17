import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";

export default defineTool({
  name: "list_open_lfg_ads",
  title: "Browse open LFG ads",
  description: "List currently open LFG ads on Rostr, optionally filtered by game. Newest first.",
  inputSchema: {
    game: z.string().trim().min(1).max(60).optional().describe("Filter by game name."),
    limit: z.number().int().min(1).max(50).optional().describe("Max results (default 20)."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ game, limit }, ctx) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "Not authenticated" }], isError: true };
    }
    const supabase = supabaseForUser(ctx);
    let q = supabase
      .from("lfg_ads")
      .select("*")
      .eq("status", "open")
      .order("created_at", { ascending: false })
      .limit(limit ?? 20);
    if (game) q = q.ilike("game", game);
    const { data, error } = await q;
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return {
      content: [{ type: "text", text: JSON.stringify(data ?? []) }],
      structuredContent: { ads: data ?? [] },
    };
  },
});
