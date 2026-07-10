import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  type StripeEnv,
  createStripeClient,
  getStripeErrorMessage,
} from "@/lib/stripe.server";
import {
  resolveOrCreateCustomer,
  validatePriceId,
  validateStripeEnvironment,
} from "@/lib/payments.server";

type CheckoutSessionResult = { clientSecret: string } | { error: string };
type PortalSessionResult = { url: string } | { error: string };

export const createCheckoutSession = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: {
    priceId: string;
    quantity?: number;
    returnUrl: string;
    environment: StripeEnv;
    tournamentId?: string;
  }) => {
    validatePriceId(data.priceId);
    if (data.quantity !== undefined && (!Number.isInteger(data.quantity) || data.quantity < 1 || data.quantity > 99)) {
      throw new Error("Invalid quantity");
    }
    if (!data.returnUrl || !data.returnUrl.includes("{CHECKOUT_SESSION_ID}")) {
      throw new Error("Invalid return URL");
    }
    return { ...data, environment: validateStripeEnvironment(data.environment) };
  })
  .handler(async ({ data, context }): Promise<CheckoutSessionResult> => {
    try {
      const { userId, supabase } = context;
      const { data: { user } } = await supabase.auth.getUser();
      const customerEmail = user?.email ?? undefined;

      const stripe = createStripeClient(data.environment);

      const prices = await stripe.prices.list({ lookup_keys: [data.priceId] });
      if (!prices.data.length) throw new Error("Price not found");
      const stripePrice = prices.data[0];
      const isRecurring = stripePrice.type === "recurring";

      const customerId = await resolveOrCreateCustomer(stripe, {
        email: customerEmail,
        userId,
      });

      let productDescription: string | undefined;
      if (!isRecurring) {
        const productId =
          typeof stripePrice.product === "string"
            ? stripePrice.product
            : stripePrice.product.id;
        const product = await stripe.products.retrieve(productId);
        productDescription = product.name;
      }

      const metadata: Record<string, string> = { userId };
      if (data.tournamentId) metadata.tournamentId = data.tournamentId;

      const session = await stripe.checkout.sessions.create({
        line_items: [{ price: stripePrice.id, quantity: data.quantity || 1 }],
        mode: isRecurring ? "subscription" : "payment",
        ui_mode: "embedded_page",
        return_url: data.returnUrl,
        customer: customerId,
        // Omit payment_method_types entirely so Stripe uses the account's
        // enabled methods for the session's currency + mode. Forcing a set
        // was previously causing "checkout won't open" errors.
        ...(!isRecurring && {
          payment_intent_data: { description: productDescription, metadata },
        }),
        metadata,
        ...(isRecurring && { subscription_data: { metadata } }),
      });

      return { clientSecret: session.client_secret ?? "" };
    } catch (error) {
      return { error: getStripeErrorMessage(error) };
    }
  });

export const createPortalSession = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { returnUrl?: string; environment: StripeEnv }) => ({
    ...data,
    environment: validateStripeEnvironment(data.environment),
  }))
  .handler(async ({ data, context }): Promise<PortalSessionResult> => {
    try {
      const { supabase, userId } = context;
      const { data: sub, error: subError } = await supabase
        .from("subscriptions")
        .select("stripe_customer_id")
        .eq("user_id", userId)
        .eq("environment", data.environment)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (subError) throw subError;
      if (!sub?.stripe_customer_id) throw new Error("No subscription found");

      const stripe = createStripeClient(data.environment);
      const portal = await stripe.billingPortal.sessions.create({
        customer: sub.stripe_customer_id as string,
        ...(data.returnUrl && { return_url: data.returnUrl }),
      });
      return { url: portal.url };
    } catch (error) {
      return { error: getStripeErrorMessage(error) };
    }
  });
