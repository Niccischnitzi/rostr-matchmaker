import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import type { StripeEnv } from "@/lib/stripe.server";

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
  if (session.mode === "subscription") {
    // Subscription webhooks are the source of truth, but checkout completion can
    // arrive first in test mode. Upsert here too so Pro unlocks quickly.
    if (session.subscription) {
      const stripeMod = await import("@/lib/stripe.server");
      const stripe = stripeMod.createStripeClient(env);
      const subscription = await stripe.subscriptions.retrieve(session.subscription, {
        expand: ["items.data.price"],
      });
      await upsertSubscription(subscription, env);
    }
    return;
  }
  if (session.mode !== "payment") return;
  if (session.payment_status !== "paid") return;

  const userId = session.metadata?.userId;
  if (!userId) {
    console.error("checkout.session.completed missing userId");
    return;
  }

  const supabase = getSupabase();

  // Need line items to know the lookup_key-backed price id. Webhook payloads do
  // not reliably include line_items, so re-fetch through the shared gateway.
  const stripeMod = await import("@/lib/stripe.server");
  const stripe = stripeMod.createStripeClient(env);
  const full = await stripe.checkout.sessions.retrieve(session.id, {
    expand: ["line_items.data.price"],
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

  // Atomically records the payment grant and credits wallet tokens once.
  const { data: inserted, error: grantErr } = await supabase.rpc("process_payment_grant", {
    p_user_id: userId,
    p_stripe_session_id: session.id,
    p_price_id: priceId,
    p_amount_paid: session.amount_total ?? null,
    p_currency: session.currency ?? null,
    p_kind: kind,
    p_tokens_granted: tokens,
    p_metadata: tournamentId ? { tournamentId } : {},
    p_environment: env,
  });
  if (grantErr) {
    console.error("Failed to process payment grant", grantErr);
    throw grantErr;
  }
  if (!inserted) return;

  // Tournament entry registration is also idempotent on (tournament_id,user_id).
  if (kind === "tournament_entry" && tournamentId) {
    const { error: entryError } = await getSupabase()
      .from("tournament_entries")
      .upsert({ tournament_id: tournamentId, user_id: userId }, { onConflict: "tournament_id,user_id" });
    if (entryError) {
      console.error("tournament_entries upsert failed", entryError);
      throw entryError;
    }
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

  const { error } = await getSupabase().from("subscriptions").upsert(
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
  if (error) {
    console.error("subscription upsert failed", error);
    throw error;
  }
}

async function handleSubscriptionDeleted(subscription: any, env: StripeEnv) {
  const { error } = await getSupabase()
    .from("subscriptions")
    .update({
      status: "canceled",
      cancel_at_period_end: subscription.cancel_at_period_end ?? false,
      updated_at: new Date().toISOString(),
    })
    .eq("stripe_subscription_id", subscription.id)
    .eq("environment", env);
  if (error) {
    console.error("subscription delete update failed", error);
    throw error;
  }
}

async function handleWebhook(req: Request, env: StripeEnv) {
  const { verifyWebhook } = await import("@/lib/stripe.server");
  const event = await verifyWebhook(req, env);
  switch (event.type) {
    case "checkout.session.completed":
      await handleCheckoutCompleted(event.data.object, env);
      break;
    case "checkout.session.async_payment_succeeded":
      await handleCheckoutCompleted(event.data.object, env);
      break;
    case "checkout.session.async_payment_failed":
      console.warn("Checkout async payment failed", event.data.object?.id);
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
