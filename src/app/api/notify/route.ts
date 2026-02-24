import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase-admin";
import { createServerSupabaseClient } from "@/lib/supabase-server";

export async function POST(request: NextRequest) {
  try {
    const { type, projectId, projectName, stageName, workerId } = await request.json();

    if (!type || !projectId) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    // Verify the caller is authenticated
    const supabase = await createServerSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Skip if no Resend API key configured
    if (!process.env.RESEND_API_KEY) {
      return NextResponse.json({ success: true, skipped: true, reason: "No RESEND_API_KEY configured" });
    }

    const adminClient = createAdminClient();

    if (type === "stage_complete") {
      // Get project clients' emails
      const { data: clientRows } = await adminClient
        .from("project_clients")
        .select("client_id")
        .eq("project_id", projectId);

      if (!clientRows || clientRows.length === 0) {
        return NextResponse.json({ success: true, skipped: true, reason: "No clients on project" });
      }

      const clientIds = clientRows.map((r: any) => r.client_id);
      const { data: profiles } = await adminClient
        .from("profiles")
        .select("email, display_name")
        .in("id", clientIds);

      const emails = (profiles || [])
        .map((p: any) => p.email)
        .filter(Boolean);

      if (emails.length === 0) {
        return NextResponse.json({ success: true, skipped: true, reason: "No client emails found" });
      }

      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: "Workflowz <noreply@projectstatus.app>",
          to: emails,
          subject: `Stage completed: ${stageName} — ${projectName}`,
          html: `<h2>Stage Completed</h2>
<p>The stage <strong>${stageName}</strong> in project <strong>${projectName}</strong> has been marked as completed.</p>
<p>Log in to your dashboard to see the latest progress.</p>`,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        console.warn("[notify] Resend error:", err);
      }

      return NextResponse.json({ success: true, emailed: emails.length });

    } else if (type === "worker_assigned") {
      if (!workerId) {
        return NextResponse.json({ error: "Missing workerId" }, { status: 400 });
      }

      const { data: profile } = await adminClient
        .from("profiles")
        .select("email, display_name")
        .eq("id", workerId)
        .single();

      if (!profile?.email) {
        return NextResponse.json({ success: true, skipped: true, reason: "No worker email found" });
      }

      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: "Workflowz <noreply@projectstatus.app>",
          to: profile.email,
          subject: `You've been assigned to: ${stageName} — ${projectName}`,
          html: `<h2>New Stage Assignment</h2>
<p>Hi${profile.display_name ? ` ${profile.display_name}` : ""},</p>
<p>You've been assigned to the stage <strong>${stageName}</strong> in project <strong>${projectName}</strong>.</p>
<p>Log in to your dashboard to get started.</p>`,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        console.warn("[notify] Resend error:", err);
      }

      return NextResponse.json({ success: true, emailed: 1 });

    } else {
      return NextResponse.json({ error: "Unknown notification type" }, { status: 400 });
    }
  } catch (err: any) {
    console.error("[notify] Error:", err);
    return NextResponse.json({ error: err.message || "Internal error" }, { status: 500 });
  }
}
