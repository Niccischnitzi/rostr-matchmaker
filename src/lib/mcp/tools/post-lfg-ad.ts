import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";

export default defineTool({
  name: "post_lfg_ad",
  title: "Post an LFG ad",
  description: "Post a Looking-For-Group ad on Rostr as the signed-in user.",
  inputSchema: {
    title: z.string().trim().min(3).max(120).describe("Short headline for the ad."),
    game: z.string().trim().min(1).max(60).describe("Game name (e.g. 'Valorant')."),
    description: z.string().trim().min(1).max(1000).describe("Details about who you're looking for."),
  },
  annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
  handler: async ({ title, game, description }, ctx) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "Not authenticated" }], isError: true };
    }
    const supabase = supabaseForUser(ctx);
    const { data, error } = await supabase
      .from("lfg_ads")
      .insert({ user_id: ctx.getUserId(), title, game, description, status: "open" })
      .select()
      .single();
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return {
      content: [{ type: "text", text: `Posted LFG ad ${data.id}` }],
      structuredContent: { ad: data },
    };
  },
});
