import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase-admin";
import { createServerSupabaseClient } from "@/lib/supabase-server";

// A client accepts a quote. Clients are RLS read-only on invoices, so the
// status write goes through the admin client after verifying the caller is
// an assigned contact on the quote's project.
export async function POST(request: NextRequest) {
  try {
    const { invoiceId } = await request.json();
    if (!invoiceId) {
      return NextResponse.json({ error: "Missing invoiceId" }, { status: 400 });
    }

    const supabase = await createServerSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const admin = createAdminClient();
    const { data: invoice } = await admin
      .from("invoices")
      .select("id, project_id, kind, status")
      .eq("id", invoiceId)
      .single();

    if (!invoice || invoice.kind !== "quote") {
      return NextResponse.json({ error: "Quote not found" }, { status: 404 });
    }

    // Caller must be an assigned client on this project (or a team member)
    const { data: clientLink } = await admin
      .from("project_clients")
      .select("client_id")
      .eq("project_id", invoice.project_id)
      .eq("client_id", user.id)
      .maybeSingle();

    if (!clientLink) {
      return NextResponse.json({ error: "Not authorized for this quote" }, { status: 403 });
    }

    const { error } = await admin
      .from("invoices")
      .update({ status: "accepted", updated_at: new Date().toISOString() })
      .eq("id", invoiceId);
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Internal error" }, { status: 500 });
  }
}
