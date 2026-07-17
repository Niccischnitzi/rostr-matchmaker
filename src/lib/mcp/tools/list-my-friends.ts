import { defineTool } from "@lovable.dev/mcp-js";
import { supabaseForUser, requireUser } from "../supabase";

export default defineTool({
  name: "list_my_friends",
  title: "List my friends",
  description: "List the signed-in user's accepted Rostr friends.",
  inputSchema: {},
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async (_input, ctx) => {
    const u = requireUser(ctx);
    if ("error" in u) return { content: [{ type: "text", text: u.error }], isError: true };
    const { data, error } = await supabaseForUser(ctx)
      .from("friends")
      .select("user_id, friend_id, status, created_at")
      .or(`user_id.eq.${u.uid},friend_id.eq.${u.uid}`)
      .eq("status", "accepted")
      .limit(200);
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return {
      content: [{ type: "text", text: JSON.stringify(data ?? []) }],
      structuredContent: { friends: data ?? [] },
    };
  },
});
