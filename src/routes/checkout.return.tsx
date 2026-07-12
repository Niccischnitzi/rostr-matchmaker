import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, Clock, XCircle, Loader2, Coins } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";

export const Route = createFileRoute("/checkout/return")({
  validateSearch: (search: Record<string, unknown>): { session_id?: string } => ({
    session_id: typeof search.session_id === "string" ? search.session_id : undefined,
  }),
  component: CheckoutReturn,
  head: () => ({
    meta: [
      { title: "Checkout Status — Rostr" },
      { name: "description", content: "Your Rostr checkout status and next steps." },
      { property: "og:title", content: "Checkout Status — Rostr" },
      { property: "og:description", content: "Your Rostr checkout status and next steps." },
      { property: "og:type", content: "website" },
    ],
  }),
});

type Status = "missing" | "pending" | "confirmed" | "timeout";

type Grant = {
  kind: string;
  tokens_granted: number | null;
  amount_paid: number | null;
  currency: string | null;
  created_at: string;
};

function CheckoutReturn() {
  const { session_id: sessionId } = Route.useSearch();
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [status, setStatus] = useState<Status>(sessionId ? "pending" : "missing");
  const [grant, setGrant] = useState<Grant | null>(null);
  const [attempts, setAttempts] = useState(0);

  // Poll payment_grants for the webhook to write our idempotent grant row.
  useEffect(() => {
    if (!sessionId || !user || authLoading) return;
    let cancelled = false;
    let n = 0;
    const MAX = 15; // ~30s at 2s intervals

    const tick = async () => {
      if (cancelled) return;
      n += 1;
      setAttempts(n);
      const { data } = await supabase
        .from("payment_grants")
        .select("kind, tokens_granted, amount_paid, currency, created_at")
        .eq("stripe_session_id", sessionId)
        .eq("user_id", user.id)
        .maybeSingle();
      if (cancelled) return;
      if (data) {
        setGrant(data as Grant);
        setStatus("confirmed");
        return;
      }
      if (n >= MAX) {
        setStatus("timeout");
        return;
      }
      setTimeout(tick, 2000);
    };
    tick();
    return () => {
      cancelled = true;
    };
  }, [sessionId, user, authLoading]);

  // Once confirmed, drift back to shop after a beat.
  useEffect(() => {
    if (status !== "confirmed") return;
    const t = setTimeout(() => navigate({ to: "/shop" }), 4000);
    return () => clearTimeout(t);
  }, [status, navigate]);

  const view = useMemo(() => {
    if (status === "missing") {
      return {
        Icon: XCircle,
        tone: "text-destructive",
        title: "Checkout session missing",
        body: "We couldn't find a checkout session in the return link. If you were charged, your account will still update from the verified payment webhook.",
      };
    }
    if (status === "confirmed") {
      return {
        Icon: CheckCircle2,
        tone: "text-emerald-500",
        title: "Payment confirmed",
        body:
          grant?.tokens_granted && grant.tokens_granted > 0
            ? `+${grant.tokens_granted.toLocaleString()} tokens have been added to your wallet.`
            : "Your purchase is active. Perks unlock automatically.",
      };
    }
    if (status === "timeout") {
      return {
        Icon: Clock,
        tone: "text-amber-500",
        title: "Still confirming…",
        body: "Your payment is taking longer than usual to confirm. It will apply automatically once the webhook lands — refresh in a minute or check your wallet.",
      };
    }
    return {
      Icon: Loader2,
      tone: "text-primary animate-spin",
      title: "Confirming payment",
      body: `Waiting for Stripe to notify us… (${attempts}/15)`,
    };
  }, [status, grant, attempts]);

  const { Icon, tone, title, body } = view;

  return (
    <main className="min-h-screen bg-background px-4 py-10">
      <section className="mx-auto flex max-w-md flex-col items-center gap-4 rounded-2xl border border-border bg-card p-6 text-center shadow-sm">
        <Icon className={`h-10 w-10 ${tone}`} />
        <div className="space-y-1">
          <h1 className="font-display text-2xl font-bold">{title}</h1>
          <p className="text-sm text-muted-foreground">{body}</p>
        </div>
        {grant && grant.amount_paid != null && (
          <div className="inline-flex items-center gap-2 rounded-full bg-muted px-3 py-1 text-xs text-muted-foreground">
            <Coins className="h-3.5 w-3.5" />
            {(grant.amount_paid / 100).toFixed(2)} {(grant.currency ?? "USD").toUpperCase()}
          </div>
        )}
        {status === "pending" && (
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
            <div
              className="h-full bg-primary transition-all"
              style={{ width: `${Math.min(100, (attempts / 15) * 100)}%` }}
            />
          </div>
        )}
        <div className="flex gap-2 pt-2">
          <Link
            to="/shop"
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
          >
            Back to shop
          </Link>
          <Link to="/pricing" className="rounded-md border border-border px-4 py-2 text-sm font-medium">
            Pricing
          </Link>
        </div>
      </section>
    </main>
  );
}
