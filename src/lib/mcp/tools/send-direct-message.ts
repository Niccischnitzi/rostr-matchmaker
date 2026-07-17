import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";

export default defineTool({
  name: "send_direct_message",
  title: "Send a direct message",
  description: "Send a DM to another Rostr user in an existing conversation.",
  inputSchema: {
    conversation_id: z.string().uuid().describe("ID of the conversation to post into."),
    body: z.string().trim().min(1).max(2000).describe("Message text."),
  },
  annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
  handler: async ({ conversation_id, body }, ctx) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "Not authenticated" }], isError: true };
    }
    const supabase = supabaseForUser(ctx);
    const { data, error } = await supabase
      .from("direct_messages")
      .insert({ conversation_id, sender_id: ctx.getUserId(), body })
      .select()
      .single();
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return {
      content: [{ type: "text", text: `Sent message ${data.id}` }],
      structuredContent: { message: data },
    };
  },
});
