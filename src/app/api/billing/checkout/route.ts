import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { createAdminClient } from "@/lib/supabase-admin";
import { createServerSupabaseClient } from "@/lib/supabase-server";

export async function POST(request: NextRequest) {
  try {
    const { teamId } = await request.json();
    if (!teamId) {
      return NextResponse.json({ error: "Missing teamId" }, { status: 400 });
    }
    if (!process.env.STRIPE_SECRET_KEY || !process.env.STRIPE_PRICE_PRO) {
      return NextResponse.json({ error: "Billing is not configured" }, { status: 503 });
    }

    const origin = request.headers.get("origin")
      || `${request.headers.get("x-forwarded-proto") || "http"}://${request.headers.get("host")}`;

    // Only the team owner (super admin) can manage billing
    const supabase = await createServerSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const { data: callerMember } = await supabase
      .from("team_members")
      .select("role")
      .eq("user_id", user.id)
      .eq("team_id", teamId)
      .single();
    if (!callerMember || callerMember.role !== "owner") {
      return NextResponse.json({ error: "Only the team owner can manage billing" }, { status: 403 });
    }

    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
    const adminClient = createAdminClient();

    // Find or create the Stripe customer for this team
    const { data: subRow } = await adminClient
      .from("subscriptions")
      .select("stripe_customer_id")
      .eq("team_id", teamId)
      .maybeSingle();

    let customerId = subRow?.stripe_customer_id as string | null;
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email || undefined,
        metadata: { team_id: teamId },
      });
      customerId = customer.id;
      const { error: upsertError } = await adminClient
        .from("subscriptions")
        .upsert(
          { team_id: teamId, stripe_customer_id: customerId, updated_at: new Date().toISOString() },
          { onConflict: "team_id" }
        );
      if (upsertError) {
        return NextResponse.json({ error: upsertError.message }, { status: 500 });
      }
    }

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer: customerId,
      line_items: [{ price: process.env.STRIPE_PRICE_PRO, quantity: 1 }],
      client_reference_id: teamId,
      subscription_data: { metadata: { team_id: teamId } },
      success_url: `${origin}/settings/?billing=success`,
      cancel_url: `${origin}/settings/?billing=cancelled`,
    });

    return NextResponse.json({ url: session.url });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Internal error" }, { status: 500 });
  }
}
