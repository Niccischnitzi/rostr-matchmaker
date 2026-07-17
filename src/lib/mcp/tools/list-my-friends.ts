import { defineTool } from "@lovable.dev/mcp-js";
import { supabaseForUser } from "../supabase";

export default defineTool({
  name: "list_my_friends",
  title: "List my friends",
  description: "List the signed-in user's accepted Rostr friends.",
  inputSchema: {},
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async (_input, ctx) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "Not authenticated" }], isError: true };
    }
    const supabase = supabaseForUser(ctx);
    const uid = ctx.getUserId();
    const { data, error } = await supabase
      .from("friends")
      .select("user_id, friend_id, status, created_at")
      .or(`user_id.eq.${uid},friend_id.eq.${uid}`)
      .eq("status", "accepted")
      .limit(200);
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return {
      content: [{ type: "text", text: JSON.stringify(data ?? []) }],
      structuredContent: { friends: data ?? [] },
    };
  },
});
