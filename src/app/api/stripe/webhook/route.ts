import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { createAdminClient } from "@/lib/supabase-admin";

// current_period_end lives on the subscription in older API versions and on
// subscription items in newer ones — check both
function periodEnd(sub: Stripe.Subscription): string | null {
  const unix = (sub as any).current_period_end
    ?? sub.items?.data?.[0]?.current_period_end;
  return unix ? new Date(unix * 1000).toISOString() : null;
}

export async function POST(request: NextRequest) {
  if (!process.env.STRIPE_SECRET_KEY || !process.env.STRIPE_WEBHOOK_SECRET) {
    return NextResponse.json({ error: "Billing is not configured" }, { status: 503 });
  }

  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
  const signature = request.headers.get("stripe-signature");
  if (!signature) {
    return NextResponse.json({ error: "Missing signature" }, { status: 400 });
  }

  let event: Stripe.Event;
  try {
    // Signature is computed over the raw body — do not JSON.parse first
    const rawBody = await request.text();
    event = stripe.webhooks.constructEvent(rawBody, signature, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err: any) {
    return NextResponse.json({ error: `Invalid signature: ${err.message}` }, { status: 400 });
  }

  const adminClient = createAdminClient();

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        const teamId = session.client_reference_id;
        if (!teamId || session.mode !== "subscription") break;
        const subscriptionId = typeof session.subscription === "string"
          ? session.subscription
          : session.subscription?.id;
        if (!subscriptionId) break;
        const sub = await stripe.subscriptions.retrieve(subscriptionId);
        const { error } = await adminClient.from("subscriptions").upsert(
          {
            team_id: teamId,
            stripe_customer_id: typeof session.customer === "string" ? session.customer : session.customer?.id,
            stripe_subscription_id: sub.id,
            status: sub.status,
            plan: "pro",
            current_period_end: periodEnd(sub),
            updated_at: new Date().toISOString(),
          },
          { onConflict: "team_id" }
        );
        if (error) throw new Error(error.message);
        break;
      }

      case "customer.subscription.updated": {
        const sub = event.data.object as Stripe.Subscription;
        const teamId = sub.metadata?.team_id;
        const update = {
          stripe_subscription_id: sub.id,
          status: sub.status,
          plan: sub.status === "active" || sub.status === "trialing" ? "pro" : "free",
          current_period_end: periodEnd(sub),
          updated_at: new Date().toISOString(),
        };
        const query = adminClient.from("subscriptions").update(update);
        const { error } = teamId
          ? await query.eq("team_id", teamId)
          : await query.eq("stripe_customer_id", typeof sub.customer === "string" ? sub.customer : sub.customer.id);
        if (error) throw new Error(error.message);
        break;
      }

      case "customer.subscription.deleted": {
        const sub = event.data.object as Stripe.Subscription;
        const teamId = sub.metadata?.team_id;
        const update = {
          status: "canceled",
          plan: "free",
          stripe_subscription_id: null,
          current_period_end: null,
          updated_at: new Date().toISOString(),
        };
        const query = adminClient.from("subscriptions").update(update);
        const { error } = teamId
          ? await query.eq("team_id", teamId)
          : await query.eq("stripe_customer_id", typeof sub.customer === "string" ? sub.customer : sub.customer.id);
        if (error) throw new Error(error.message);
        break;
      }

      default:
        break;
    }

    return NextResponse.json({ received: true });
  } catch (err: any) {
    // Non-2xx makes Stripe retry the delivery
    return NextResponse.json({ error: err.message || "Webhook handler failed" }, { status: 500 });
  }
}
