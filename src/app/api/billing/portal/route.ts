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
    if (!process.env.STRIPE_SECRET_KEY) {
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

    const adminClient = createAdminClient();
    const { data: subRow } = await adminClient
      .from("subscriptions")
      .select("stripe_customer_id")
      .eq("team_id", teamId)
      .maybeSingle();

    if (!subRow?.stripe_customer_id) {
      return NextResponse.json({ error: "No billing account yet — upgrade first" }, { status: 400 });
    }

    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
    const session = await stripe.billingPortal.sessions.create({
      customer: subRow.stripe_customer_id,
      return_url: `${origin}/settings/`,
    });

    return NextResponse.json({ url: session.url });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Internal error" }, { status: 500 });
  }
}
