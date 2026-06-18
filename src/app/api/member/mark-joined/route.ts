import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase-admin";
import { createServerSupabaseClient } from "@/lib/supabase-server";

// Marks the signed-in user's pending team memberships as joined (sets
// joined_at). Run on first login. This must use the admin client: RLS on
// team_members doesn't let a member update their own row, so the browser-side
// update silently affected 0 rows and invited users stayed "pending" forever.
export async function POST() {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const admin = createAdminClient();
    const { error } = await admin
      .from("team_members")
      .update({ joined_at: new Date().toISOString() })
      .eq("user_id", user.id)
      .is("joined_at", null);
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Internal error" }, { status: 500 });
  }
}
