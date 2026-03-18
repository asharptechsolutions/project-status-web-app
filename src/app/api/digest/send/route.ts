import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase-admin";
import { renderDigestEmail } from "@/lib/digest-renderer";
import type { DigestData, DigestProject } from "@/lib/digest-renderer";
import type { BrandingConfig, EmailLayout } from "@/lib/email-renderer";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    // Authenticate — either Vercel Cron secret or manual trigger with secret
    const authHeader = request.headers.get("authorization");
    const cronSecret = process.env.CRON_SECRET;
    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!process.env.RESEND_API_KEY) {
      return NextResponse.json({ success: true, skipped: true, reason: "No RESEND_API_KEY configured" });
    }

    const adminClient = createAdminClient();
    const now = new Date();
    const currentDay = now.getUTCDay(); // 0=Sun, 1=Mon, ...
    const currentHour = now.getUTCHours();

    // Find all teams that should receive digest now
    // Default: enabled=true, day=1 (Monday), hour=9
    // Include teams with no settings row (default is on)
    const { data: allTeams } = await adminClient.from("teams").select("id, name");
    if (!allTeams || allTeams.length === 0) {
      return NextResponse.json({ success: true, processed: 0 });
    }

    const teamIds = allTeams.map((t) => t.id);
    const { data: digestRows } = await adminClient
      .from("digest_settings")
      .select("*")
      .in("team_id", teamIds);

    const settingsMap = new Map<string, any>();
    (digestRows || []).forEach((r: any) => settingsMap.set(r.team_id, r));

    // Filter teams whose digest should fire now
    const eligibleTeams = allTeams.filter((team) => {
      const s = settingsMap.get(team.id);
      const enabled = s ? s.weekly_digest_enabled : true; // default: on
      const day = s ? s.digest_day : 1; // default: Monday
      const hour = s ? s.digest_hour : 9; // default: 9am UTC
      if (!enabled) return false;
      if (day !== currentDay || hour !== currentHour) return false;
      // Skip if already sent within the last 23 hours
      if (s?.last_sent_at) {
        const lastSent = new Date(s.last_sent_at).getTime();
        if (now.getTime() - lastSent < 23 * 60 * 60 * 1000) return false;
      }
      return true;
    });

    if (eligibleTeams.length === 0) {
      return NextResponse.json({ success: true, processed: 0, reason: "No teams due for digest" });
    }

    const eligibleIds = eligibleTeams.map((t) => t.id);

    // Batch fetch all data
    const [projectsResult, brandingResult] = await Promise.all([
      adminClient.from("projects").select("*").in("team_id", eligibleIds).eq("status", "active"),
      adminClient.from("org_branding").select("*").in("team_id", eligibleIds),
    ]);

    const projects = projectsResult.data || [];
    const brandingRows = brandingResult.data || [];

    if (projects.length === 0) {
      return NextResponse.json({ success: true, processed: 0, reason: "No active projects" });
    }

    const projectIds = projects.map((p) => p.id);
    const [stagesResult, clientsResult, templateResult] = await Promise.all([
      adminClient.from("project_stages").select("*").in("project_id", projectIds),
      adminClient.from("project_clients").select("*").in("project_id", projectIds),
      adminClient.from("email_templates").select("*").eq("template_type", "weekly_digest").eq("is_active", true),
    ]);

    const allStages = stagesResult.data || [];
    const allProjectClients = clientsResult.data || [];
    const customTemplates = templateResult.data || [];

    // Get all unique client IDs
    const clientIds = [...new Set(allProjectClients.map((pc: any) => pc.client_id))];
    if (clientIds.length === 0) {
      return NextResponse.json({ success: true, processed: 0, reason: "No clients assigned to projects" });
    }

    const { data: profiles } = await adminClient
      .from("profiles")
      .select("id, email, display_name")
      .in("id", clientIds);
    const profileMap = new Map<string, any>();
    (profiles || []).forEach((p: any) => profileMap.set(p.id, p));

    // Build maps for efficient lookup
    const brandingMap = new Map<string, any>();
    brandingRows.forEach((b: any) => brandingMap.set(b.team_id, b));

    const teamNameMap = new Map<string, string>();
    allTeams.forEach((t) => teamNameMap.set(t.id, t.name));

    const templateMap = new Map<string, any>();
    customTemplates.forEach((t: any) => templateMap.set(t.team_id, t));

    // Week boundaries for "recently completed" detection
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    let totalEmails = 0;
    const errors: string[] = [];
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(".supabase.co", "") || "https://projectstatus.app";

    for (const team of eligibleTeams) {
      const teamProjects = projects.filter((p) => p.team_id === team.id);
      if (teamProjects.length === 0) continue;

      const brandingRow = brandingMap.get(team.id);
      const emailColor = brandingRow?.email_accent_color || brandingRow?.primary_color || "#2563eb";
      const branding: BrandingConfig = {
        logo_url: brandingRow?.logo_url || null,
        primary_color: emailColor,
        secondary_color: brandingRow?.secondary_color || null,
        org_name: team.name || "ProjectStatus",
      };
      const tmpl = templateMap.get(team.id);
      const layout: EmailLayout = (tmpl?.layout || "classic") as EmailLayout;

      // Build per-project digest data
      const projectDigests: Map<string, DigestProject> = new Map();
      for (const proj of teamProjects) {
        const stages = allStages.filter((s: any) => s.project_id === proj.id);
        const completed = stages.filter((s: any) => s.status === "completed");
        const inProgress = stages.filter((s: any) => s.status === "in_progress");
        const recentlyCompleted = completed
          .filter((s: any) => s.completed_at && new Date(s.completed_at) > weekAgo)
          .map((s: any) => s.name);
        const currentStage = inProgress.length > 0
          ? inProgress.sort((a: any, b: any) => a.position - b.position)[0].name
          : null;

        projectDigests.set(proj.id, {
          name: proj.name,
          totalStages: stages.length,
          completedStages: completed.length,
          inProgressStages: inProgress.length,
          recentlyCompleted,
          currentStage,
        });
      }

      // Get client→project mapping for this team
      const teamProjectIds = new Set(teamProjects.map((p) => p.id));
      const teamClientLinks = allProjectClients.filter((pc: any) => teamProjectIds.has(pc.project_id));

      // Group by client
      const clientProjectMap = new Map<string, string[]>();
      teamClientLinks.forEach((link: any) => {
        const existing = clientProjectMap.get(link.client_id) || [];
        existing.push(link.project_id);
        clientProjectMap.set(link.client_id, existing);
      });

      // Report period
      const periodEnd = new Date(now);
      const periodStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      const reportPeriod = `${periodStart.toLocaleDateString("en-US", { month: "short", day: "numeric" })} - ${periodEnd.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`;

      // Send to each client
      for (const [clientId, projectIdList] of clientProjectMap.entries()) {
        const profile = profileMap.get(clientId);
        if (!profile?.email) continue;

        const clientProjects = projectIdList
          .map((pid) => projectDigests.get(pid))
          .filter(Boolean) as DigestProject[];

        if (clientProjects.length === 0) continue;

        // Skip if nothing happened this week (no recently completed stages across all projects)
        const hasActivity = clientProjects.some(
          (p) => p.recentlyCompleted.length > 0 || p.inProgressStages > 0
        );
        if (!hasActivity) continue;

        const digestData: DigestData = {
          recipientName: profile.display_name || "",
          orgName: branding.org_name,
          reportPeriod,
          projects: clientProjects,
          trackingUrl: `${appUrl}/track`,
        };

        try {
          const { subject, html } = renderDigestEmail(digestData, branding, layout);

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
            errors.push(`Failed for ${profile.email}: ${JSON.stringify(err)}`);
          } else {
            totalEmails++;
          }
        } catch (err: any) {
          errors.push(`Error for ${profile.email}: ${err.message}`);
        }
      }

      // Update last_sent_at
      await adminClient
        .from("digest_settings")
        .upsert(
          { team_id: team.id, weekly_digest_enabled: true, digest_day: settingsMap.get(team.id)?.digest_day ?? 1, digest_hour: settingsMap.get(team.id)?.digest_hour ?? 9, last_sent_at: now.toISOString(), updated_at: now.toISOString() },
          { onConflict: "team_id" }
        );
    }

    return NextResponse.json({
      success: true,
      teams: eligibleTeams.length,
      emails: totalEmails,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (err: any) {
    console.error("[digest] Error:", err);
    return NextResponse.json({ error: err.message || "Internal error" }, { status: 500 });
  }
}
