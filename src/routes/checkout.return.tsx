import { createFileRoute, Link } from "@tanstack/react-router";
import { CheckCircle2, Clock, XCircle } from "lucide-react";

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

function CheckoutReturn() {
  const { session_id: sessionId } = Route.useSearch();

  const hasSession = Boolean(sessionId);
  const Icon = hasSession ? CheckCircle2 : XCircle;

  return (
    <main className="min-h-screen bg-background px-4 py-10">
      <section className="mx-auto flex max-w-md flex-col items-center gap-4 rounded-2xl border border-border bg-card p-6 text-center shadow-sm">
        <Icon className={hasSession ? "h-10 w-10 text-primary" : "h-10 w-10 text-destructive"} />
        <div className="space-y-1">
          <h1 className="font-display text-2xl font-bold">
            {hasSession ? "Payment received" : "Checkout session missing"}
          </h1>
          <p className="text-sm text-muted-foreground">
            {hasSession
              ? "Your payment is being confirmed. Token packs and Pro access update automatically as soon as the payment webhook finishes."
              : "We could not find the checkout session in the return link. If you were charged, your account will still update from the verified payment webhook."}
          </p>
        </div>
        {hasSession && (
          <div className="inline-flex items-center gap-2 rounded-full bg-muted px-3 py-1 text-xs text-muted-foreground">
            <Clock className="h-3.5 w-3.5" /> Confirmation can take a few seconds
          </div>
        )}
        <div className="flex gap-2 pt-2">
          <Link to="/shop" className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground">
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