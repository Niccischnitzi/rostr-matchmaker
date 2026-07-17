import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser, requireUser } from "../supabase";

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
    const u = requireUser(ctx);
    if ("error" in u) return { content: [{ type: "text", text: u.error }], isError: true };
    const { data, error } = await supabaseForUser(ctx)
      .from("direct_messages")
      .insert({ conversation_id, sender_id: u.uid, body })
      .select()
      .single();
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return {
      content: [{ type: "text", text: `Sent message ${data.id}` }],
      structuredContent: { message: data },
    };
  },
});
