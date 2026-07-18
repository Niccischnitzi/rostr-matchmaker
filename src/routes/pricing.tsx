import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Coins, Crown, ArrowLeft, Loader2 } from "lucide-react";
import { StripeEmbeddedCheckout } from "@/components/StripeEmbeddedCheckout";
import { PaymentTestModeBanner } from "@/components/PaymentTestModeBanner";
import { useSubscription } from "@/hooks/use-subscription";
import { useAuth } from "@/hooks/use-auth";
import { createPortalSession } from "@/lib/payments.functions";
import { getStripeEnvironment } from "@/lib/stripe";

export const Route = createFileRoute("/pricing")({
  component: PricingPage,
  errorComponent: () => <div className="p-6">Failed to load pricing.</div>,
  notFoundComponent: () => <div className="p-6">Not found.</div>,
  head: () => ({
    meta: [
      { title: "Pricing & Power-ups — Rostr" },
      {
        name: "description",
        content:
          "Power up your gaming with Rostr Pro and Shard packs for LFG boosts and cosmetics. No real-money wagers — Rostr is 16+ and cash-out free.",
      },
      { property: "og:title", content: "Pricing & Power-ups — Rostr" },
      {
        property: "og:description",
        content: "Rostr Pro and Shard packs. In-app currency only — no real-money wagers.",
      },
      { property: "og:url", content: "https://rostr-matchmaker.lovable.app/pricing" },
      { property: "og:type", content: "website" },
    ],
    links: [{ rel: "canonical", href: "https://rostr-matchmaker.lovable.app/pricing" }],
  }),
});

type Tab = "shards" | "pro";

// Shards are Rostr's in-app currency. No cash value, no cash-out, cannot buy
// tournament entries. Real-money tournament tiers were removed as part of the
// 16+ age gate + anti-gambling pass.
const SHARD_PACKS = [
  { priceId: "tokens_500", shards: 500, price: "$4.99" },
  { priceId: "tokens_1200", shards: 1200, price: "$9.99", badge: "Popular" },
  { priceId: "tokens_3000", shards: 3000, price: "$19.99" },
  { priceId: "tokens_7500", shards: 7500, price: "$39.99", badge: "Best value" },
];

function PricingPage() {
  const { user, loading: authLoading } = useAuth();
  const { isPro, subscription } = useSubscription();
  const [tab, setTab] = useState<Tab>("shards");
  const [activePrice, setActivePrice] = useState<string | null>(null);
  const [portalLoading, setPortalLoading] = useState(false);
  const createPortal = useServerFn(createPortalSession);

  const openPortal = async () => {
    setPortalLoading(true);
    try {
      const res = await createPortal({
        data: { environment: getStripeEnvironment(), returnUrl: window.location.href },
      });
      if ("error" in res) throw new Error(res.error);
      window.open(res.url, "_blank");
    } catch (e: any) {
      alert(e?.message ?? "Could not open billing portal");
    } finally {
      setPortalLoading(false);
    }
  };

  if (activePrice) {
    return (
      <div className="min-h-screen bg-background">
        <PaymentTestModeBanner />
        <div className="max-w-2xl mx-auto p-4">
          <button
            onClick={() => setActivePrice(null)}
            className="mb-4 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" /> Back to plans
          </button>
          <div className="rounded-2xl border border-border bg-card overflow-hidden">
            <StripeEmbeddedCheckout priceId={activePrice} />
          </div>
        </div>
      </div>
    );
  }

  if (authLoading) {
    return (
      <div className="min-h-screen bg-background">
        <PaymentTestModeBanner />
        <div className="mx-auto max-w-5xl space-y-6 px-4 py-10">
          <div className="h-9 w-48 animate-pulse rounded-lg bg-muted" />
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-48 animate-pulse rounded-2xl bg-muted" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <div className="max-w-sm text-center space-y-3">
          <h1 className="text-xl font-semibold">Sign in to access pricing</h1>
          <Link to="/auth" className="inline-block rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground">
            Sign in
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <PaymentTestModeBanner />
      <header className="max-w-5xl mx-auto px-4 pt-6 pb-2 flex items-center justify-between">
        <Link to="/" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Back
        </Link>
        {isPro && (
          <button
            onClick={openPortal}
            disabled={portalLoading}
            className="inline-flex items-center gap-2 rounded-md border border-border bg-card px-3 py-1.5 text-sm hover:bg-muted disabled:opacity-50"
          >
            {portalLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Manage subscription
          </button>
        )}
      </header>

      <div className="max-w-5xl mx-auto px-4 py-8 space-y-8">
        <div className="text-center space-y-2">
          <h1 className="font-display text-4xl md:text-5xl font-bold tracking-tight">Power up your Rostr</h1>
          <p className="text-muted-foreground">Tokens, Pro perks, and paid cups — all in one place.</p>
        </div>

        <div className="flex justify-center">
          <div className="inline-flex rounded-full bg-muted p-1">
            {([
              ["tokens", "Tokens", Coins],
              ["pro", "Pro", Crown],
              ["tournaments", "Cups", Trophy],
            ] as const).map(([id, label, Icon]) => (
              <button
                key={id}
                onClick={() => setTab(id)}
                className={`inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition ${
                  tab === id
                    ? "bg-background shadow text-foreground"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <Icon className="h-4 w-4" /> {label}
              </button>
            ))}
          </div>
        </div>

        {tab === "tokens" && (
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {TOKEN_PACKS.map((p) => (
              <div
                key={p.priceId}
                className="relative rounded-2xl border border-border bg-card p-6 flex flex-col gap-3 hover:border-primary/60 transition"
              >
                {p.badge && (
                  <span className="absolute -top-2 right-4 rounded-full bg-primary text-primary-foreground text-[10px] uppercase tracking-wide px-2 py-0.5">
                    {p.badge}
                  </span>
                )}
                <Coins className="h-6 w-6 text-primary" />
                <div className="font-display text-3xl font-bold">{p.tokens.toLocaleString()}</div>
                <div className="text-sm text-muted-foreground">tokens</div>
                <div className="mt-auto pt-4 flex items-center justify-between">
                  <span className="font-semibold">{p.price}</span>
                  <button
                    onClick={() => setActivePrice(p.priceId)}
                    className="rounded-md bg-primary text-primary-foreground px-3 py-1.5 text-sm font-medium hover:opacity-90"
                  >
                    Buy
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {tab === "pro" && (
          <div className="grid md:grid-cols-2 gap-4 max-w-3xl mx-auto">
            {[
              { priceId: "pro_monthly", price: "$7.99", per: "/month", label: "Monthly" },
              { priceId: "pro_yearly", price: "$59.99", per: "/year", label: "Yearly", save: "Save 37%" },
            ].map((plan) => {
              const current = subscription?.price_id === plan.priceId && isPro;
              return (
                <div
                  key={plan.priceId}
                  className="relative rounded-2xl border border-border bg-card p-6 flex flex-col gap-4"
                >
                  {plan.save && (
                    <span className="absolute -top-2 right-4 rounded-full bg-emerald-500 text-white text-[10px] uppercase tracking-wide px-2 py-0.5">
                      {plan.save}
                    </span>
                  )}
                  <div className="flex items-center gap-2">
                    <Crown className="h-5 w-5 text-amber-500" />
                    <span className="font-semibold">Rostr Pro · {plan.label}</span>
                  </div>
                  <div>
                    <span className="font-display text-4xl font-bold">{plan.price}</span>
                    <span className="text-muted-foreground">{plan.per}</span>
                  </div>
                  <ul className="text-sm text-muted-foreground space-y-1.5">
                    <li>• Pro badge on profile & battlecard</li>
                    <li>• Free monthly LFG boosts + bigger login bonus</li>
                    <li>• Premium themes, animated avatars, custom cards</li>
                    <li>• Higher limits on linked accounts, clips, crews</li>
                  </ul>
                  <button
                    disabled={current}
                    onClick={() => setActivePrice(plan.priceId)}
                    className="mt-auto rounded-md bg-primary text-primary-foreground px-4 py-2 text-sm font-medium hover:opacity-90 disabled:opacity-50"
                  >
                    {current ? "Current plan" : "Subscribe"}
                  </button>
                </div>
              );
            })}
          </div>
        )}

        {tab === "tournaments" && (
          <div className="grid sm:grid-cols-3 gap-4 max-w-4xl mx-auto">
            {ENTRY_TIERS.map((t) => (
              <div key={t.priceId} className="rounded-2xl border border-border bg-card p-6 flex flex-col gap-3">
                <Trophy className="h-6 w-6 text-amber-500" />
                <div className="font-semibold">{t.label}</div>
                <div className="font-display text-3xl font-bold">{t.price}</div>
                <p className="text-xs text-muted-foreground">{t.blurb}</p>
                <button
                  onClick={() => t.priceId === "entry_free" ? alert("Free cups open in the Tournaments tab.") : setActivePrice(t.priceId)}
                  className="mt-auto rounded-md border border-primary text-primary px-3 py-1.5 text-sm font-medium hover:bg-primary hover:text-primary-foreground transition"
                >
                  {t.cta}
                </button>
              </div>
            ))}
          </div>
        )}

        {isPro && subscription?.cancel_at_period_end && subscription.current_period_end && (
          <p className="text-center text-sm text-muted-foreground">
            Pro access ends {new Date(subscription.current_period_end).toLocaleDateString()}.
          </p>
        )}
      </div>
    </div>
  );
}
