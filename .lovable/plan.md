# Fix "steamcommunity.com refused to connect"

## What's happening

Nothing is broken with your Steam key or the backend. The problem is where the Steam login page tries to open.

The Connect Steam button currently navigates the current page to Steam's login. Inside the Lovable preview, your app runs inside an embedded frame, and Steam explicitly forbids being embedded (it sends a "don't allow framing" header). The browser blocks it and shows "steamcommunity.com refused to connect".

Confirmed in code: `SteamConnectButton.tsx` sets `window.location.href` to the Steam OpenID URL, and the app's own security headers (`vercel.json`, `netlify.toml`) don't list Steam as an allowed frame either.

So: nothing needed from you — no extra keys, no Steam config. It's a client-side navigation fix.

## The fix

1. Open Steam login in a real top-level context instead of inside the frame:
   - Open a new browser tab/window (`window.open(..., "_blank")`) for the Steam OpenID URL.
   - If a popup is blocked, show a fallback "Open Steam login" link the user can click directly.
2. Build the OpenID `return_to` / `realm` from the app's public origin (the published/preview app URL) rather than the frame's origin, so Steam returns to a page that can complete the link.
3. After Steam returns to `/api/public/steam/return`, that page redirects with the signed payload. In the new-tab flow it will:
   - complete the claim in that tab (existing `SteamClaimListener` + `linkSteam` logic already handles `?steam_link=`),
   - notify the original tab (postMessage / storage event) so the button flips to "Steam · <name>" without a manual refresh, then close itself.
4. Keep the existing behaviour intact when the app is not framed (published site opened directly): same-tab navigation still works.

## Notes

- No database or server-function changes; `steam.return.ts`, `linkSteam`, and `syncSteam` stay as they are.
- Optional hardening: leave CSP alone — we are not embedding Steam, we are opening it top-level.
