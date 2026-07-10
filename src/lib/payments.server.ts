import { type StripeEnv, createStripeClient } from "@/lib/stripe.server";

const PRICE_ID_RE = /^[a-zA-Z0-9_-]+$/;

export function validatePriceId(priceId: string): string {
  if (!PRICE_ID_RE.test(priceId)) throw new Error("Invalid priceId");
  return priceId;
}

export function validateStripeEnvironment(environment: StripeEnv): StripeEnv {
  if (environment !== "sandbox" && environment !== "live") {
    throw new Error("Invalid Stripe environment");
  }
  return environment;
}

export async function resolveOrCreateCustomer(
  stripe: ReturnType<typeof createStripeClient>,
  options: { email?: string; userId?: string },
): Promise<string> {
  if (options.userId && !/^[a-zA-Z0-9_-]+$/.test(options.userId)) {
    throw new Error("Invalid userId");
  }

  if (options.userId) {
    const found = await stripe.customers.search({
      query: `metadata['userId']:'${options.userId}'`,
      limit: 1,
    });
    if (found.data.length) return found.data[0].id;
  }

  if (options.email) {
    const existing = await stripe.customers.list({ email: options.email, limit: 1 });
    if (existing.data.length) {
      const customer = existing.data[0];
      if (options.userId && customer.metadata?.userId !== options.userId) {
        await stripe.customers.update(customer.id, {
          metadata: { ...customer.metadata, userId: options.userId },
        });
      }
      return customer.id;
    }
  }

  const created = await stripe.customers.create({
    ...(options.email && { email: options.email }),
    ...(options.userId && { metadata: { userId: options.userId } }),
  });
  return created.id;
}