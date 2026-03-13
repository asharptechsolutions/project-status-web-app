import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase-admin";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { renderEmail, getDefaultTemplate } from "@/lib/email-renderer";
import type { BrandingConfig, EmailLayout } from "@/lib/email-renderer";

export async function POST(request: NextRequest) {
  try {
    const { type, projectId, projectName, stageName, workerId, teamId } = await request.json();

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

    // Load org branding and custom email template
    const resolvedTeamId = teamId || null;
    let branding: BrandingConfig = { primary_color: "#2563eb", org_name: "ProjectStatus" };
    let customSubject: string | null = null;
    let customBody: string | null = null;
    let layout: EmailLayout = "classic";

    if (resolvedTeamId) {
      const [brandingRow, templateRow, teamRow] = await Promise.all([
        adminClient.from("org_branding").select("*").eq("team_id", resolvedTeamId).single(),
        adminClient.from("email_templates").select("*").eq("team_id", resolvedTeamId).eq("template_type", type).eq("is_active", true).single(),
        adminClient.from("teams").select("name").eq("id", resolvedTeamId).single(),
      ]);

      const orgName = teamRow.data?.name || "ProjectStatus";
      const emailColor = brandingRow.data?.email_accent_color || brandingRow.data?.primary_color || "#2563eb";
      branding = {
        logo_url: brandingRow.data?.logo_url || null,
        primary_color: emailColor,
        secondary_color: brandingRow.data?.secondary_color || null,
        org_name: orgName,
      };

      if (templateRow.data) {
        customSubject = templateRow.data.subject;
        customBody = templateRow.data.body;
        layout = (templateRow.data.layout || "classic") as EmailLayout;
      }
    }

    // Use custom template or fall back to defaults
    const defaults = getDefaultTemplate(type);
    const emailSubject = customSubject || defaults?.subject || "Notification";
    const emailBody = customBody || defaults?.body || "";

    if (type === "stage_complete") {
      // Get project clients' emails
      const { data: clientRows } = await adminClient
        .from("project_clients")
        .select("client_id")
        .eq("project_id", projectId);

      if (!clientRows || clientRows.length === 0) {
        return NextResponse.json({ success: true, skipped: true, reason: "No clients on project" });
      }

      let clientIds = clientRows.map((r: any) => r.client_id);

      // Filter out clients who have opted out of stage completion notifications
      const { data: optOutRows } = await adminClient
        .from("client_notification_preferences")
        .select("client_id")
        .eq("project_id", projectId)
        .eq("notify_stage_complete", false)
        .in("client_id", clientIds);

      if (optOutRows && optOutRows.length > 0) {
        const optedOutIds = new Set(optOutRows.map((r: any) => r.client_id));
        clientIds = clientIds.filter((id: string) => !optedOutIds.has(id));
      }

      if (clientIds.length === 0) {
        return NextResponse.json({ success: true, skipped: true, reason: "All clients opted out" });
      }

      const { data: profiles } = await adminClient
        .from("profiles")
        .select("email, display_name")
        .in("id", clientIds);

      const recipients = (profiles || []).filter((p: any) => p.email);

      if (recipients.length === 0) {
        return NextResponse.json({ success: true, skipped: true, reason: "No client emails found" });
      }

      // Send to each client with personalized name
      for (const recipient of recipients) {
        const variables: Record<string, string> = {
          recipient_name: (recipient as any).display_name || "",
          org_name: branding.org_name,
          project_name: projectName || "",
          stage_name: stageName || "",
        };

        const { subject, html } = renderEmail(emailSubject, emailBody, variables, branding, layout);

        await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            from: `${branding.org_name} <noreply@projectstatus.app>`,
            to: (recipient as any).email,
            subject,
            html,
          }),
        });
      }

      return NextResponse.json({ success: true, emailed: recipients.length });

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

      const variables: Record<string, string> = {
        recipient_name: profile.display_name || "",
        org_name: branding.org_name,
        project_name: projectName || "",
        stage_name: stageName || "",
      };

      const { subject, html } = renderEmail(emailSubject, emailBody, variables, branding, layout);

      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: `${branding.org_name} <noreply@projectstatus.app>`,
          to: profile.email,
          subject,
          html,
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
