import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser, requireUser } from "../supabase";

export default defineTool({
  name: "list_open_lfg_ads",
  title: "Browse open LFG ads",
  description: "List currently open LFG ads on Rostr (not yet expired or closed), optionally filtered by game. Newest first.",
  inputSchema: {
    game: z.string().trim().min(1).max(60).optional().describe("Filter by game name."),
    limit: z.number().int().min(1).max(50).optional().describe("Max results (default 20)."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ game, limit }, ctx) => {
    const u = requireUser(ctx);
    if ("error" in u) return { content: [{ type: "text", text: u.error }], isError: true };
    let q = supabaseForUser(ctx)
      .from("lfg_ads")
      .select("*")
      .is("closed_at", null)
      .gt("expires_at", new Date().toISOString())
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
