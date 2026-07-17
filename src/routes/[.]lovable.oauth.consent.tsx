import { createFileRoute, redirect } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { RostrMark } from "@/components/squadz/RostrMark";
import { Loader2 } from "lucide-react";

// Beta namespace not surfaced in the SDK's public types yet — narrow local typing.
type OAuthNs = {
  getAuthorizationDetails: (id: string) => Promise<{ data: AuthorizationDetails | null; error: { message: string } | null }>;
  approveAuthorization: (id: string) => Promise<{ data: AuthorizationResult | null; error: { message: string } | null }>;
  denyAuthorization: (id: string) => Promise<{ data: AuthorizationResult | null; error: { message: string } | null }>;
};
type AuthorizationDetails = {
  client?: { name?: string; client_uri?: string; redirect_uris?: string[] };
  scopes?: string[];
  redirect_url?: string;
  redirect_to?: string;
};
type AuthorizationResult = { redirect_url?: string; redirect_to?: string };

function oauth(): OAuthNs {
  return (supabase.auth as unknown as { oauth: OAuthNs }).oauth;
}

export const Route = createFileRoute("/.lovable/oauth/consent")({
  ssr: false,
  validateSearch: (s: Record<string, unknown>) => ({
    authorization_id: typeof s.authorization_id === "string" ? s.authorization_id : "",
  }),
  beforeLoad: async ({ search, location }) => {
    if (!search.authorization_id) throw new Error("Missing authorization_id");
    const { data } = await supabase.auth.getSession();
    if (!data.session) {
      const next = location.pathname + location.searchStr;
      throw redirect({ to: "/auth", search: { next } });
    }
  },
  loader: async ({ location }) => {
    const authorizationId = new URLSearchParams(location.search).get("authorization_id")!;
    const { data, error } = await oauth().getAuthorizationDetails(authorizationId);
    if (error) throw new Error(error.message);
    const immediate = data?.redirect_url ?? data?.redirect_to;
    if (immediate && !data?.client) throw redirect({ href: immediate });
    return data as AuthorizationDetails;
  },
  component: Consent,
  errorComponent: ({ error }) => (
    <main className="min-h-screen grid place-items-center bg-background text-foreground px-4">
      <div className="max-w-md text-center space-y-3">
        <RostrMark variant="lockup" size={36} />
        <h1 className="text-xl font-bold">Could not load this authorization request</h1>
        <p className="text-sm text-muted-foreground">{String((error as Error)?.message ?? error)}</p>
        <a href="/" className="inline-block mt-3 rounded-lg bg-primary text-primary-foreground px-4 py-2 text-sm font-bold">Go home</a>
      </div>
    </main>
  ),
});

function Consent() {
  const details = Route.useLoaderData();
  const { authorization_id } = Route.useSearch();
  const [busy, setBusy] = useState<"approve" | "deny" | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function decide(approve: boolean) {
    setBusy(approve ? "approve" : "deny");
    setError(null);
    const { data, error } = approve
      ? await oauth().approveAuthorization(authorization_id)
      : await oauth().denyAuthorization(authorization_id);
    if (error) {
      setBusy(null);
      setError(error.message);
      return;
    }
    const target = data?.redirect_url ?? data?.redirect_to;
    if (!target) {
      setBusy(null);
      setError("No redirect returned by the authorization server.");
      return;
    }
    window.location.href = target;
  }

  const clientName = details?.client?.name ?? "an app";
  const scopes = details?.scopes ?? ["openid", "email", "profile"];
  const redirectHost = (() => {
    const first = details?.client?.redirect_uris?.[0];
    try { return first ? new URL(first).host : null; } catch { return null; }
  })();

  return (
    <main className="min-h-screen grid place-items-center bg-background text-foreground px-4 py-10">
      <div className="w-full max-w-md">
        <div className="flex flex-col items-center gap-2 mb-6">
          <RostrMark variant="lockup" size={40} />
          <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Agent integrations</p>
        </div>

        <div className="rounded-3xl border border-border bg-card p-6 shadow-xl space-y-5">
          <div className="space-y-1 text-center">
            <h1 className="text-xl font-bold">Connect {clientName} to Rostr</h1>
            <p className="text-sm text-muted-foreground">
              This lets {clientName} use Rostr as you — it will be able to call this app's enabled tools while you're signed in.
            </p>
            {redirectHost && (
              <p className="text-[11px] text-muted-foreground/80">Redirects to <span className="font-mono">{redirectHost}</span></p>
            )}
          </div>

          <div className="rounded-xl border border-border bg-surface p-3 text-xs space-y-1.5">
            <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">Permissions requested</p>
            <ul className="space-y-1">
              {scopes.map((s: string) => (
                <li key={s} className="flex items-center gap-2">
                  <span className="inline-block h-1.5 w-1.5 rounded-full bg-primary" />
                  <span>{scopeLabel(s)}</span>
                </li>
              ))}
            </ul>
            <p className="pt-1 text-[10px] text-muted-foreground/80">
              This does not bypass Rostr's permissions or backend policies.
            </p>
          </div>

          {error && (
            <div role="alert" className="text-xs rounded-lg border border-destructive/30 bg-destructive/10 text-destructive px-3 py-2">
              {error}
            </div>
          )}

          <div className="flex gap-2">
            <button
              disabled={busy !== null}
              onClick={() => decide(false)}
              className="flex-1 h-11 rounded-xl border border-border bg-surface hover:bg-surface-2 text-sm font-bold disabled:opacity-50 transition"
            >
              {busy === "deny" ? <Loader2 className="mx-auto h-4 w-4 animate-spin" /> : "Cancel connection"}
            </button>
            <button
              disabled={busy !== null}
              onClick={() => decide(true)}
              className="flex-1 h-11 rounded-xl bg-primary text-primary-foreground text-sm font-bold hover:opacity-90 disabled:opacity-50 transition"
            >
              {busy === "approve" ? <Loader2 className="mx-auto h-4 w-4 animate-spin" /> : "Approve"}
            </button>
          </div>
        </div>
      </div>
    </main>
  );
}

function scopeLabel(scope: string): string {
  switch (scope) {
    case "openid": return "Verify your Rostr identity";
    case "email": return "Share your email address";
    case "profile": return "Share your basic profile";
    default: return `Additional permission requested: ${scope}`;
  }
}
