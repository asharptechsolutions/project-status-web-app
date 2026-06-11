import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase-admin";
import { createServerSupabaseClient } from "@/lib/supabase-server";

// Client sign-off on an approval-gated stage. Clients are RLS read-only on
// project_stages, so the write goes through the admin client after verifying
// the caller is an assigned contact on the stage's project. Approving also
// completes the stage; requesting changes flags it back to the team.
export async function POST(request: NextRequest) {
  try {
    const { stageId, approve, note } = await request.json();
    if (!stageId || typeof approve !== "boolean") {
      return NextResponse.json({ error: "Missing fields" }, { status: 400 });
    }

    const supabase = await createServerSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const admin = createAdminClient();
    const { data: stage } = await admin
      .from("project_stages")
      .select("id, project_id, requires_client_approval, approval_status")
      .eq("id", stageId)
      .single();

    if (!stage || !stage.requires_client_approval) {
      return NextResponse.json({ error: "Stage not found or not gated" }, { status: 404 });
    }

    const { data: clientLink } = await admin
      .from("project_clients")
      .select("client_id")
      .eq("project_id", stage.project_id)
      .eq("client_id", user.id)
      .maybeSingle();
    if (!clientLink) {
      return NextResponse.json({ error: "Not authorized for this stage" }, { status: 403 });
    }

    const now = new Date().toISOString();
    const updates = approve
      ? { approval_status: "approved", approved_by: user.id, approved_at: now, approval_note: note || null, status: "completed", completed_at: now }
      : { approval_status: "changes_requested", approval_note: note || null };

    const { error } = await admin.from("project_stages").update(updates).eq("id", stageId);
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Internal error" }, { status: 500 });
  }
}
