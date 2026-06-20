import { useMemo, useState } from "react";
import { EmbeddedCheckoutProvider, EmbeddedCheckout } from "@stripe/react-stripe-js";
import { getStripe, getStripeEnvironment } from "@/lib/stripe";
import { createCheckoutSession } from "@/lib/payments.functions";
import { AlertTriangle } from "lucide-react";

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
  const stripePromise = useMemo(() => {
    try { return getStripe(); } catch (e) {
      setFatal(e instanceof Error ? e.message : "Stripe not configured");
      return null;
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

  if (fatal || !stripePromise) {
    return (
      <div className="rounded-2xl border border-destructive/40 bg-destructive/5 p-5 text-center">
        <AlertTriangle className="h-6 w-6 text-destructive mx-auto mb-2" />
        <p className="text-sm font-bold">Checkout unavailable</p>
        <p className="text-xs text-muted-foreground mt-1 break-words">{fatal ?? "Stripe is not configured for this build."}</p>
      </div>
    );
  }

  return (
    <div id="checkout">
      <EmbeddedCheckoutProvider stripe={stripePromise} options={options}>
        <EmbeddedCheckout />
      </EmbeddedCheckoutProvider>
    </div>
  );
}
