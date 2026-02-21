import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase-admin";
import { createServerSupabaseClient } from "@/lib/supabase-server";

export async function POST(request: NextRequest) {
  try {
    const { userId, teamId, role, name, email, phone, companyId } = await request.json();

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

    if (!callerMember || callerMember.role !== "owner") {
      return NextResponse.json({ error: "Only team owners can update members" }, { status: 403 });
    }

    // Update role/company_id on team_members
    const teamUpdates: Record<string, any> = {};
    if (role) teamUpdates.role = role;
    if (companyId !== undefined) teamUpdates.company_id = companyId;
    if (Object.keys(teamUpdates).length > 0) {
      const { error } = await adminClient
        .from("team_members")
        .update(teamUpdates)
        .eq("user_id", userId)
        .eq("team_id", teamId);
      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
    }

    // Update name/email/phone on profiles
    const profileUpdates: Record<string, string> = {};
    if (name) profileUpdates.display_name = name;
    if (email) profileUpdates.email = email;
    if (phone !== undefined) profileUpdates.phone = phone;
    if (Object.keys(profileUpdates).length > 0) {
      const { error } = await adminClient
        .from("profiles")
        .update(profileUpdates)
        .eq("id", userId);
      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Internal error" }, { status: 500 });
  }
}
