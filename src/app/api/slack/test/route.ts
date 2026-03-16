import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase-admin";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { formatSlackMessage } from "@/lib/slack-formatter";
import type { SlackIntegration } from "@/lib/types";

export async function POST(request: NextRequest) {
  try {
    const { teamId } = await request.json();

    if (!teamId) {
      return NextResponse.json({ error: "Missing required field: teamId" }, { status: 400 });
    }

    // Verify the caller is authenticated
    const supabase = await createServerSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const adminClient = createAdminClient();

    // Load the Slack integration
    const { data: slack, error: slackError } = await adminClient
      .from("slack_integrations")
      .select("*")
      .eq("team_id", teamId)
      .maybeSingle();

    if (slackError || !slack) {
      return NextResponse.json({ error: "Slack integration not found" }, { status: 404 });
    }

    const typedSlack = slack as SlackIntegration;

    if (!typedSlack.is_active) {
      return NextResponse.json({ error: "Slack integration is not active" }, { status: 400 });
    }

    // Format a test message
    const testPayload = {
      project_name: "Sample Project",
      stage_name: "Sample Stage",
      message: "This is a test message from Workflowz",
    };
    const slackMessage = formatSlackMessage("stage_completed", testPayload);

    // Send to Slack webhook URL
    const res = await fetch(typedSlack.webhook_url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(slackMessage),
      signal: AbortSignal.timeout(10000),
    });

    if (!res.ok) {
      const errorText = await res.text().catch(() => "Unknown error");
      return NextResponse.json({
        success: false,
        error: `Slack returned ${res.status}: ${errorText}`,
      }, { status: 502 });
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error("[slack/test] Error:", err);
    return NextResponse.json({ error: err.message || "Internal error" }, { status: 500 });
  }
}
