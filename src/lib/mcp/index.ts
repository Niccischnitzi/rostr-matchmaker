import { auth, defineMcp } from "@lovable.dev/mcp-js";
import searchUsersTool from "./tools/search-users";
import getMyProfileTool from "./tools/get-my-profile";
import listMyFriendsTool from "./tools/list-my-friends";
import listMyConversationsTool from "./tools/list-my-conversations";
import sendDirectMessageTool from "./tools/send-direct-message";
import postLfgAdTool from "./tools/post-lfg-ad";
import listOpenLfgAdsTool from "./tools/list-open-lfg-ads";
import getMyWalletTool from "./tools/get-my-wallet";

// Issuer must be the DIRECT supabase.co host (not the .lovable.cloud proxy) —
// mcp-js rejects any token whose runtime issuer doesn't match this. VITE_
// literals are inlined at build time; the fallback keeps the string well-formed
// during the manifest-extract eval where env may be absent.
const projectRef = import.meta.env.VITE_SUPABASE_PROJECT_ID ?? "project-ref-unset";

export default defineMcp({
  name: "rostr-mcp",
  title: "Rostr",
  version: "0.1.0",
  instructions:
    "Rostr is a gaming social hub. Use these tools to search players, read the signed-in user's profile / friends / DMs / wallet, post and browse LFG ads, and send DMs on their behalf. Every tool acts as the signed-in Rostr user; RLS controls what they can see.",
  auth: auth.oauth.issuer({
    issuer: `https://${projectRef}.supabase.co/auth/v1`,
    acceptedAudiences: "authenticated",
  }),
  tools: [
    getMyProfileTool,
    searchUsersTool,
    listMyFriendsTool,
    listMyConversationsTool,
    sendDirectMessageTool,
    postLfgAdTool,
    listOpenLfgAdsTool,
    getMyWalletTool,
  ],
});
