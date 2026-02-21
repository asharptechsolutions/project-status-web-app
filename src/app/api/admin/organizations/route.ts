import { NextResponse } from "next/server";
import { verifyPlatformAdmin } from "@/lib/admin-auth";
import { createAdminClient } from "@/lib/supabase-admin";

export async function GET() {
  const admin = await verifyPlatformAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 403 });

  const supabase = createAdminClient();

  const { data: teams, error } = await supabase
    .from("teams")
    .select("id, name, created_by, created_at")
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Get member and project counts
  const { data: memberRows } = await supabase.from("team_members").select("team_id");
  const { data: projectRows } = await supabase.from("projects").select("team_id");

  const counts = new Map<string, { members: number; projects: number }>();
  (memberRows || []).forEach((m: any) => {
    const entry = counts.get(m.team_id) || { members: 0, projects: 0 };
    entry.members++;
    counts.set(m.team_id, entry);
  });
  (projectRows || []).forEach((p: any) => {
    const entry = counts.get(p.team_id) || { members: 0, projects: 0 };
    entry.projects++;
    counts.set(p.team_id, entry);
  });

  const enriched = (teams || []).map((t: any) => ({
    ...t,
    memberCount: counts.get(t.id)?.members || 0,
    projectCount: counts.get(t.id)?.projects || 0,
  }));

  return NextResponse.json(enriched);
}
