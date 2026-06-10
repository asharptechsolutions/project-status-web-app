import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase-admin";
import { createServerSupabaseClient } from "@/lib/supabase-server";

export async function POST(request: NextRequest) {
  try {
    const { userId, teamId } = await request.json();

    if (!userId || !teamId) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    // Verify the caller is authenticated and is an owner of the team
    const supabase = await createServerSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const adminClient = createAdminClient();

    const { data: callerMember } = await adminClient
      .from("team_members")
      .select("role")
      .eq("user_id", user.id)
      .eq("team_id", teamId)
      .single();

    if (!callerMember || !["owner", "admin"].includes(callerMember.role)) {
      return NextResponse.json({ error: "Only admins can remove members" }, { status: 403 });
    }

    // Only the owner (super admin) may remove admins or project managers
    if (callerMember.role !== "owner") {
      const { data: targetMember } = await adminClient
        .from("team_members")
        .select("role")
        .eq("user_id", userId)
        .eq("team_id", teamId)
        .single();
      if (targetMember && ["owner", "admin"].includes(targetMember.role)) {
        return NextResponse.json({ error: "Only the team owner can remove admins or project managers" }, { status: 403 });
      }
    }

    // Prevent self-deletion
    if (userId === user.id) {
      return NextResponse.json({ error: "Cannot remove yourself" }, { status: 400 });
    }

    // Delete from team_members using admin client (bypasses RLS)
    const { error: deleteError } = await adminClient
      .from("team_members")
      .delete()
      .eq("user_id", userId)
      .eq("team_id", teamId);

    if (deleteError) {
      return NextResponse.json({ error: deleteError.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Internal error" }, { status: 500 });
  }
}
