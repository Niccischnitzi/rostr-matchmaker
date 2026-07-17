import { defineTool } from "@lovable.dev/mcp-js";
import { supabaseForUser } from "../supabase";

export default defineTool({
  name: "get_my_wallet",
  title: "Get my Shards wallet",
  description: "Return the signed-in user's Rostr Shards balance and recent transactions.",
  inputSchema: {},
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async (_input, ctx) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "Not authenticated" }], isError: true };
    }
    const supabase = supabaseForUser(ctx);
    const uid = ctx.getUserId();
    const [wallet, txns] = await Promise.all([
      supabase.from("wallets").select("*").eq("user_id", uid).maybeSingle(),
      supabase
        .from("token_transactions")
        .select("*")
        .eq("user_id", uid)
        .order("created_at", { ascending: false })
        .limit(20),
    ]);
    if (wallet.error) return { content: [{ type: "text", text: wallet.error.message }], isError: true };
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({ wallet: wallet.data, transactions: txns.data ?? [] }),
        },
      ],
      structuredContent: { wallet: wallet.data, transactions: txns.data ?? [] },
    };
  },
});
