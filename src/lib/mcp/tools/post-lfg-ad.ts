import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser, requireUser } from "../supabase";

export default defineTool({
  name: "post_lfg_ad",
  title: "Post an LFG ad",
  description: "Post a Looking-For-Group ad on Rostr as the signed-in user.",
  inputSchema: {
    game: z.string().trim().min(1).max(60).describe("Game name (e.g. 'Valorant')."),
    description: z.string().trim().min(1).max(1000).describe("Details about who you're looking for."),
    mode: z.string().trim().max(60).optional().describe("Game mode (optional)."),
    region: z.string().trim().max(20).optional().describe("Region tag (optional)."),
    mic_required: z.boolean().optional().describe("Require voice chat (default false)."),
    slots_total: z.number().int().min(2).max(10).optional().describe("Total party size (default 4)."),
  },
  annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
  handler: async ({ game, description, mode, region, mic_required, slots_total }, ctx) => {
    const u = requireUser(ctx);
    if ("error" in u) return { content: [{ type: "text", text: u.error }], isError: true };
    const { data, error } = await supabaseForUser(ctx)
      .from("lfg_ads")
      .insert({
        host_id: u.uid,
        game,
        description,
        mode: mode ?? null,
        region: region ?? null,
        mic_required: mic_required ?? false,
        slots_total: slots_total ?? 4,
      })
      .select()
      .single();
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return {
      content: [{ type: "text", text: `Posted LFG ad ${data.id}` }],
      structuredContent: { ad: data },
    };
  },
});
