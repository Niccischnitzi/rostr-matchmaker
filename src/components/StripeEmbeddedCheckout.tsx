import { useMemo, useState } from "react";
import { EmbeddedCheckoutProvider, EmbeddedCheckout } from "@stripe/react-stripe-js";
import { getStripe, getStripeEnvironment } from "@/lib/stripe";
import { createCheckoutSession } from "@/lib/payments.functions";
import { AlertTriangle } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

interface Props {
  priceId: string;
  quantity?: number;
  tournamentId?: string;
  returnUrl?: string;
}

export function StripeEmbeddedCheckout({ priceId, quantity, tournamentId, returnUrl }: Props) {
  const [fatal, setFatal] = useState<string | null>(null);

  // Memoize so EmbeddedCheckoutProvider doesn't remount and throw
  // "You cannot change the client secret after creation".
  const stripeState = useMemo(() => {
    try {
      return { stripePromise: getStripe(), configError: null as string | null };
    } catch (e) {
      return {
        stripePromise: null,
        configError: e instanceof Error ? e.message : "Stripe not configured",
      };
    }
  }, []);

  const options = useMemo(() => ({
    fetchClientSecret: async (): Promise<string> => {
      try {
        const result = await createCheckoutSession({
          data: {
            priceId,
            quantity,
            tournamentId,
            returnUrl:
              returnUrl ||
              `${window.location.origin}/checkout/return?session_id={CHECKOUT_SESSION_ID}`,
            environment: getStripeEnvironment(),
          },
        });
        if ("error" in result) throw new Error(result.error);
        if (!result.clientSecret) throw new Error("Stripe did not return a client secret");
        return result.clientSecret;
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Checkout unavailable";
        setFatal(msg);
        throw e;
      }
    },
  }), [priceId, quantity, tournamentId, returnUrl]);

  if (fatal || stripeState.configError || !stripeState.stripePromise) {
    return (
      <div className="rounded-2xl border border-destructive/40 bg-destructive/5 p-5 text-center">
        <AlertTriangle className="h-6 w-6 text-destructive mx-auto mb-2" />
        <p className="text-sm font-bold">Checkout unavailable</p>
        <p className="text-xs text-muted-foreground mt-1 break-words">
          {fatal ?? stripeState.configError ?? "Stripe is not configured for this build."}
        </p>
      </div>
    );
  }

  return (
    <div id="checkout" className="relative min-h-[620px]">
      <div className="absolute inset-0 -z-10 space-y-3 p-4" aria-hidden>
        <Skeleton className="h-10 w-40" />
        <Skeleton className="h-14 w-full rounded-xl" />
        <Skeleton className="h-14 w-full rounded-xl" />
        <Skeleton className="h-40 w-full rounded-xl" />
      </div>
      <EmbeddedCheckoutProvider stripe={stripeState.stripePromise} options={options}>
        <EmbeddedCheckout />
      </EmbeddedCheckoutProvider>
    </div>
  );
}
