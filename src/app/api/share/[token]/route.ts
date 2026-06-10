import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase-admin";

// Resolves a share token to minimal display info for the OTP login screen.
// Callers may be unauthenticated, so this uses the admin client — it must
// never return project data beyond the name. Access to the tracking view
// itself is enforced by project_clients + RLS after OTP verification.
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params;
    if (!token || token.length < 10) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const adminClient = createAdminClient();
    const { data: project } = await adminClient
      .from("projects")
      .select("id, name, team_id, share_enabled")
      .eq("share_token", token)
      .single();

    if (!project || !project.share_enabled) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const { data: team } = await adminClient
      .from("teams")
      .select("name")
      .eq("id", project.team_id)
      .single();

    return NextResponse.json({
      projectId: project.id,
      projectName: project.name,
      orgName: team?.name || "",
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Internal error" }, { status: 500 });
  }
}
