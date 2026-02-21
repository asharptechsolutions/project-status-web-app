import { NextResponse } from "next/server";
import { verifyPlatformAdmin } from "@/lib/admin-auth";
import { createAdminClient } from "@/lib/supabase-admin";

export async function GET() {
  const admin = await verifyPlatformAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 403 });

  const supabase = createAdminClient();

  const [teams, profiles, projects, teamMembers] = await Promise.all([
    supabase.from("teams").select("id", { count: "exact", head: true }),
    supabase.from("profiles").select("id", { count: "exact", head: true }),
    supabase.from("projects").select("id", { count: "exact", head: true }),
    supabase.from("team_members").select("user_id", { count: "exact", head: true }),
  ]);

  return NextResponse.json({
    totalOrgs: teams.count || 0,
    totalUsers: profiles.count || 0,
    totalProjects: projects.count || 0,
    totalMemberships: teamMembers.count || 0,
  });
}
