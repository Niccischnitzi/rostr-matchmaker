import { defineTool } from "@lovable.dev/mcp-js";
import { supabaseForUser, requireUser } from "../supabase";

export default defineTool({
  name: "get_my_profile",
  title: "Get my profile",
  description: "Return the signed-in Rostr user's profile row (username, display name, avatar, bio).",
  inputSchema: {},
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async (_input, ctx) => {
    const u = requireUser(ctx);
    if ("error" in u) return { content: [{ type: "text", text: u.error }], isError: true };
    const { data, error } = await supabaseForUser(ctx)
      .from("profiles")
      .select("id, username, display_name, avatar_url, bio")
      .eq("id", u.uid)
      .maybeSingle();
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return {
      content: [{ type: "text", text: JSON.stringify(data) }],
      structuredContent: { profile: data },
    };
  },
});
