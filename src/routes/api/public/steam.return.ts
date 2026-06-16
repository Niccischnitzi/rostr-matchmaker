// Sprint 4 — Steam OpenID return handler.
// Performs check_authentication against Steam, extracts the SteamID64,
// fetches the persona via ISteamUser/GetPlayerSummaries using the
// STEAM_WEB_API_KEY, then upserts into linked_accounts.
// IMPORTANT: this route is called from the browser via Steam's redirect,
// so the bearer token is NOT present. We identify the user via a short-lived
// state cookie set when starting the flow, OR (current scaffold) we mark the
// row pending and the client claims it next time it loads.
import { createFileRoute } from "@tanstack/react-router";

const STEAM_OPENID = "https://steamcommunity.com/openid/login";

export const Route = createFileRoute("/api/public/steam/return")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const params = url.searchParams;

        // Re-post the params with mode=check_authentication for verification.
        const verifyBody = new URLSearchParams(params);
        verifyBody.set("openid.mode", "check_authentication");
        const verify = await fetch(STEAM_OPENID, {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: verifyBody.toString(),
        });
        const verifyText = await verify.text();
        if (!/is_valid\s*:\s*true/i.test(verifyText)) {
          return new Response("Steam verification failed", { status: 400 });
        }

        // Extract SteamID64 from claimed_id (https://steamcommunity.com/openid/id/76561...)
        const claimed = params.get("openid.claimed_id") ?? "";
        const match = claimed.match(/\/id\/(\d{17})$/);
        const steamId = match?.[1];
        if (!steamId) return new Response("No steam id", { status: 400 });

        const apiKey = process.env.STEAM_WEB_API_KEY;
        let persona = { display_name: null as string | null, avatar_url: null as string | null };
        if (apiKey) {
          try {
            const sr = await fetch(`https://api.steampowered.com/ISteamUser/GetPlayerSummaries/v2/?key=${apiKey}&steamids=${steamId}`);
            const sj = await sr.json();
            const p = sj?.response?.players?.[0];
            if (p) {
              persona.display_name = p.personaname ?? null;
              persona.avatar_url = p.avatarfull ?? null;
            }
          } catch {
            // non-fatal — still complete the link
          }
        }

        // Hand off to a client-side claim page; we encode the verified
        // payload in URL hash so the client can call a server fn that
        // requires auth and writes the row scoped to the signed-in user.
        const payload = encodeURIComponent(JSON.stringify({
          provider: "steam",
          external_id: steamId,
          ...persona,
        }));
        const redirect = `/?steam_link=${payload}`;
        return new Response(null, { status: 302, headers: { Location: redirect } });
      },
    },
  },
});
