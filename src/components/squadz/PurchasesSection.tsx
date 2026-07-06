import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Coins, Crown, Receipt, Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { getStripeEnvironment } from "@/lib/stripe";
import { useSubscription } from "@/hooks/use-subscription";
import { Skeleton } from "@/components/ui/skeleton";

type Grant = {
  id: string;
  price_id: string;
  amount_paid: number | null;
  currency: string | null;
  kind: string;
  tokens_granted: number | null;
  created_at: string;
};

function formatMoney(cents: number | null, currency: string | null) {
  if (!cents || !currency) return "—";
  const c = currency.toLowerCase();
  const zero = ["jpy", "krw", "vnd"].includes(c);
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: currency.toUpperCase(),
    minimumFractionDigits: zero ? 0 : 2,
  }).format(zero ? cents : cents / 100);
}

function labelForGrant(g: Grant) {
  if (g.kind === "tokens") return `${g.tokens_granted?.toLocaleString() ?? 0} tokens`;
  if (g.kind === "tournament_entry") return "Tournament entry";
  return g.price_id;
}

export function PurchasesSection({ userId }: { userId: string }) {
  const { isPro, subscription } = useSubscription();
  const [grants, setGrants] = useState<Grant[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    let env: ReturnType<typeof getStripeEnvironment>;
    try {
      env = getStripeEnvironment();
    } catch {
      setGrants([]);
      return;
    }
    (async () => {
      const { data } = await supabase
        .from("payment_grants")
        .select("id, price_id, amount_paid, currency, kind, tokens_granted, created_at")
        .eq("user_id", userId)
        .eq("environment", env)
        .order("created_at", { ascending: false })
        .limit(6);
      if (!cancelled) setGrants((data as Grant[]) ?? []);
    })();
    return () => {
      cancelled = true;
    };
  }, [userId]);

  const totalTokens = (grants ?? []).reduce((sum, g) => sum + (g.tokens_granted ?? 0), 0);
  const totalCount = grants?.length ?? 0;

  return (
    <div className="mt-6">
      <div className="flex items-center justify-between mb-3">
        <h2 className="font-display text-xl font-black flex items-center gap-2">
          <Receipt className="h-5 w-5 text-primary" /> Purchases
        </h2>
        <Link
          to="/pricing"
          className="text-xs font-bold uppercase tracking-widest text-primary hover:underline flex items-center gap-1"
        >
          <Sparkles className="h-3.5 w-3.5" /> Store
        </Link>
      </div>

      <div className="grid grid-cols-3 gap-2 mb-3">
        <Stat
          icon={<Crown className="h-4 w-4 text-amber-500" />}
          label="Plan"
          value={isPro ? (subscription?.price_id === "pro_yearly" ? "Pro · Yr" : "Pro") : "Free"}
          tone={isPro ? "accent" : "muted"}
        />
        <Stat
          icon={<Coins className="h-4 w-4 text-amber-400" />}
          label="Tokens bought"
          value={totalTokens.toLocaleString()}
          tone="muted"
        />
        <Stat
          icon={<Receipt className="h-4 w-4 text-primary" />}
          label="Receipts"
          value={String(totalCount)}
          tone="muted"
        />
      </div>

      {grants === null ? (
        <div className="rounded-2xl border border-border bg-surface p-3 space-y-2">
          <Skeleton className="h-4 w-28" />
          <Skeleton className="h-9 w-full rounded-xl" />
          <Skeleton className="h-9 w-full rounded-xl" />
        </div>
      ) : grants.length === 0 ? (
        <Link
          to="/pricing"
          className="block rounded-2xl border border-dashed border-border bg-surface p-4 text-center hover:border-primary/60 transition"
        >
          <p className="text-sm font-semibold">No purchases yet</p>
          <p className="text-xs text-muted-foreground mt-1">
            Grab a token pack, unlock Rostr Pro, or enter a paid cup.
          </p>
        </Link>
      ) : (
        <ul className="divide-y divide-border rounded-2xl border border-border bg-surface overflow-hidden">
          {grants.map((g) => (
            <li key={g.id} className="flex items-center justify-between gap-3 px-3 py-2.5">
              <div className="min-w-0">
                <p className="text-sm font-semibold truncate">{labelForGrant(g)}</p>
                <p className="text-[11px] text-muted-foreground">
                  {new Date(g.created_at).toLocaleDateString(undefined, {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                  })}
                </p>
              </div>
              <span className="text-sm tabular-nums font-bold">
                {formatMoney(g.amount_paid, g.currency)}
              </span>
            </li>
          ))}
        </ul>
      )}

      {isPro && subscription?.cancel_at_period_end && subscription.current_period_end && (
        <p className="mt-2 text-[11px] text-muted-foreground">
          Pro ends {new Date(subscription.current_period_end).toLocaleDateString()}.
        </p>
      )}
    </div>
  );
}

function Stat({
  icon,
  label,
  value,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  tone: "accent" | "muted";
}) {
  return (
    <div
      className={`rounded-2xl border p-2.5 ${
        tone === "accent"
          ? "border-amber-400/40 bg-amber-400/5"
          : "border-border bg-surface"
      }`}
    >
      <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">
        {icon} <span className="truncate">{label}</span>
      </div>
      <div className="font-display text-lg font-black mt-0.5 truncate">{value}</div>
    </div>
  );
}
