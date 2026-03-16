import { NextRequest, NextResponse } from "next/server";
import { createHmac } from "crypto";
import { createAdminClient } from "@/lib/supabase-admin";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import type { Webhook } from "@/lib/types";

export async function POST(request: NextRequest) {
  try {
    const { webhookId, teamId } = await request.json();

    if (!webhookId || !teamId) {
      return NextResponse.json({ error: "Missing required fields: webhookId, teamId" }, { status: 400 });
    }

    // Verify the caller is authenticated
    const supabase = await createServerSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const adminClient = createAdminClient();

    // Load the webhook
    const { data: webhook, error: webhookError } = await adminClient
      .from("webhooks")
      .select("*")
      .eq("id", webhookId)
      .eq("team_id", teamId)
      .single();

    if (webhookError || !webhook) {
      return NextResponse.json({ error: "Webhook not found" }, { status: 404 });
    }

    const typedWebhook = webhook as Webhook;

    // Build test envelope
    const envelope = {
      event: "test",
      timestamp: new Date().toISOString(),
      data: {
        message: "This is a test webhook delivery from Workflowz",
        project_name: "Sample Project",
        stage_name: "Sample Stage",
      },
    };

    const body = JSON.stringify(envelope);
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      "X-Webhook-Event": "test",
    };

    // Add HMAC signature if webhook has a secret
    if (typedWebhook.secret) {
      const signature = createHmac("sha256", typedWebhook.secret)
        .update(body)
        .digest("hex");
      headers["X-Webhook-Signature"] = signature;
    }

    let statusCode: number | null = null;
    let responseBody: string | null = null;
    let success = false;
    let errorMessage: string | null = null;

    try {
      const res = await fetch(typedWebhook.url, {
        method: "POST",
        headers,
        body,
        signal: AbortSignal.timeout(10000),
      });
      statusCode = res.status;
      responseBody = await res.text().catch(() => null);
      success = res.ok;
    } catch (err: any) {
      errorMessage = err.message || "Request failed";
    }

    // Log the test delivery
    await adminClient.from("webhook_deliveries").insert({
      webhook_id: webhookId,
      team_id: teamId,
      event_type: "test",
      payload: envelope,
      status_code: statusCode,
      response_body: responseBody?.substring(0, 2000) || null,
      success,
      attempt: 1,
      error_message: errorMessage,
    });

    return NextResponse.json({
      success,
      status_code: statusCode,
      response_body: responseBody?.substring(0, 500) || null,
      error_message: errorMessage,
    });
  } catch (err: any) {
    console.error("[webhooks/test] Error:", err);
    return NextResponse.json({ error: err.message || "Internal error" }, { status: 500 });
  }
}
