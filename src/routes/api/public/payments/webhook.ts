import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import { type StripeEnv, verifyWebhook } from "@/lib/stripe.server";

let _supabase: any = null;
function getSupabase(): any {
  if (!_supabase) {
    _supabase = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
    );
  }
  return _supabase;
}

const TOKEN_GRANTS: Record<string, number> = {
  tokens_500: 500,
  tokens_1200: 1200,
  tokens_3000: 3000,
  tokens_7500: 7500,
};

function resolvePriceId(item: any): string | null {
  return (
    item?.price?.lookup_key ??
    item?.price?.metadata?.lovable_external_id ??
    item?.price?.id ??
    null
  );
}

async function handleCheckoutCompleted(session: any, env: StripeEnv) {
  if (session.mode !== "payment") return; // subscriptions handled by subscription.* events
  if (session.payment_status !== "paid") return;

  const userId = session.metadata?.userId;
  if (!userId) {
    console.error("checkout.session.completed missing userId");
    return;
  }

  // Idempotency check
  const supabase = getSupabase();
  const { data: existing } = await supabase
    .from("payment_grants")
    .select("id")
    .eq("stripe_session_id", session.id)
    .maybeSingle();
  if (existing) return;

  // Need line items to know the price
  // session.line_items isn't included by default in webhooks; we use display items
  // but Stripe typically expands on checkout.completed retrieved via API.
  // We re-fetch via API.
  const stripeMod = await import("@/lib/stripe.server");
  const stripe = stripeMod.createStripeClient(env);
  const full = await stripe.checkout.sessions.retrieve(session.id, {
    expand: ["line_items"],
  });
  const item = full.line_items?.data?.[0];
  const priceId = resolvePriceId(item);
  if (!priceId) {
    console.error("No priceId resolved for session", session.id);
    return;
  }

  const tournamentId = session.metadata?.tournamentId ?? null;
  const tokens = TOKEN_GRANTS[priceId] ?? 0;
  const kind = priceId.startsWith("tokens_")
    ? "tokens"
    : priceId.startsWith("entry_")
      ? "tournament_entry"
      : "other";

  // Record grant (idempotent on unique stripe_session_id)
  const { error: grantErr } = await supabase.from("payment_grants").insert({
    user_id: userId,
    stripe_session_id: session.id,
    price_id: priceId,
    amount_paid: session.amount_total ?? null,
    currency: session.currency ?? null,
    kind,
    tokens_granted: tokens,
    metadata: tournamentId ? { tournamentId } : {},
    environment: env,
  });
  if (grantErr) {
    if (grantErr.code === "23505") return; // race: already inserted
    console.error("Failed to insert grant", grantErr);
    return;
  }

  // Credit wallet for token packs
  if (tokens > 0) {
    const { data: wallet } = await supabase
      .from("wallets")
      .select("balance_points, lifetime_won")
      .eq("user_id", userId)
      .maybeSingle();
    const balance = ((wallet?.balance_points as number) ?? 0) + tokens;
    const lifetime = ((wallet?.lifetime_won as number) ?? 0) + tokens;
    await supabase
      .from("wallets")
      .upsert(
        { user_id: userId, balance_points: balance, lifetime_won: lifetime },
        { onConflict: "user_id" },
      );
  }

  // Tournament entry registration
  if (kind === "tournament_entry" && tournamentId) {
    await getSupabase()
      .from("tournament_entries")
      .insert({ tournament_id: tournamentId, user_id: userId })
      .then(() => undefined, (e: unknown) => console.error("tournament_entries insert failed", e));
  }
}

async function upsertSubscription(subscription: any, env: StripeEnv) {
  const userId = subscription.metadata?.userId;
  if (!userId) {
    console.error("subscription missing userId metadata", subscription.id);
    return;
  }
  const item = subscription.items?.data?.[0];
  const priceId = resolvePriceId(item);
  const productId =
    typeof item?.price?.product === "string" ? item.price.product : item?.price?.product?.id;
  const periodStart = item?.current_period_start ?? subscription.current_period_start;
  const periodEnd = item?.current_period_end ?? subscription.current_period_end;

  await getSupabase().from("subscriptions").upsert(
    {
      user_id: userId,
      stripe_subscription_id: subscription.id,
      stripe_customer_id: subscription.customer,
      product_id: productId ?? "",
      price_id: priceId ?? "",
      status: subscription.status,
      current_period_start: periodStart ? new Date(periodStart * 1000).toISOString() : null,
      current_period_end: periodEnd ? new Date(periodEnd * 1000).toISOString() : null,
      cancel_at_period_end: subscription.cancel_at_period_end ?? false,
      environment: env,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "stripe_subscription_id" },
  );
}

async function handleSubscriptionDeleted(subscription: any, env: StripeEnv) {
  await getSupabase()
    .from("subscriptions")
    .update({
      status: "canceled",
      cancel_at_period_end: subscription.cancel_at_period_end ?? false,
      updated_at: new Date().toISOString(),
    })
    .eq("stripe_subscription_id", subscription.id)
    .eq("environment", env);
}

async function handleWebhook(req: Request, env: StripeEnv) {
  const event = await verifyWebhook(req, env);
  switch (event.type) {
    case "checkout.session.completed":
      await handleCheckoutCompleted(event.data.object, env);
      break;
    case "customer.subscription.created":
    case "customer.subscription.updated":
      await upsertSubscription(event.data.object, env);
      break;
    case "customer.subscription.deleted":
      await handleSubscriptionDeleted(event.data.object, env);
      break;
    default:
      console.log("Unhandled event:", event.type);
  }
}

export const Route = createFileRoute("/api/public/payments/webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const rawEnv = new URL(request.url).searchParams.get("env");
        if (rawEnv !== "sandbox" && rawEnv !== "live") {
          console.error("Webhook invalid env:", rawEnv);
          return Response.json({ received: true, ignored: "invalid env" });
        }
        try {
          await handleWebhook(request, rawEnv as StripeEnv);
          return Response.json({ received: true });
        } catch (e) {
          console.error("Webhook error:", e);
          return new Response("Webhook error", { status: 400 });
        }
      },
    },
  },
});
