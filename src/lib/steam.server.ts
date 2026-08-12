// Server-only signing/verification for the Steam OpenID claim hand-off.
// The OpenID return route runs unauthenticated (Steam redirects the browser),
// so the verified SteamID64 travels back to the app through the URL. Signing it
// with a server-only secret means the client cannot forge an identity or a
// "verified" gaming account.
import { createHmac, timingSafeEqual } from "crypto";

export type SteamClaim = {
  provider: "steam";
  external_id: string;
  display_name: string | null;
  avatar_url: string | null;
  exp: number;
};

function secret(): string {
  const s =
    process.env["STEAM_LINK_SECRET"] ||
    process.env["STEAM_WEB_API_KEY"] ||
    process.env["SUPABASE_SERVICE_ROLE_KEY"];
  if (!s) throw new Error("Steam link signing secret is not configured");
  return s;
}

const b64url = (buf: Buffer) => buf.toString("base64url");

export function signSteamClaim(claim: SteamClaim): string {
  const body = b64url(Buffer.from(JSON.stringify(claim)));
  const sig = b64url(createHmac("sha256", secret()).update(body).digest());
  return `${body}.${sig}`;
}

export function verifySteamClaim(token: string): SteamClaim | null {
  const [body, sig] = token.split(".");
  if (!body || !sig) return null;
  const expected = b64url(createHmac("sha256", secret()).update(body).digest());
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  try {
    const claim = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as SteamClaim;
    if (claim.provider !== "steam") return null;
    if (!/^\d{17}$/.test(String(claim.external_id))) return null;
    if (!Number.isFinite(claim.exp) || claim.exp < Date.now()) return null;
    return claim;
  } catch {
    return null;
  }
}
