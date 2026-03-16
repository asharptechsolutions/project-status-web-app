import { NextRequest, NextResponse } from "next/server";
import { createHmac } from "crypto";
import { createAdminClient } from "@/lib/supabase-admin";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { formatSlackMessage } from "@/lib/slack-formatter";
import type { WebhookEventType, Webhook, SlackIntegration } from "@/lib/types";

export async function POST(request: NextRequest) {
  try {
    const { event, teamId, payload } = await request.json();

    if (!event || !teamId) {
      return NextResponse.json({ error: "Missing required fields: event, teamId" }, { status: 400 });
    }

    // Verify the caller is authenticated
    const supabase = await createServerSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const adminClient = createAdminClient();

    // Fetch active webhooks and Slack integration for this team in parallel
    const [webhooksResult, slackResult] = await Promise.all([
      adminClient
        .from("webhooks")
        .select("*")
        .eq("team_id", teamId)
        .eq("is_active", true),
      adminClient
        .from("slack_integrations")
        .select("*")
        .eq("team_id", teamId)
        .eq("is_active", true)
        .maybeSingle(),
    ]);

    const webhooks = (webhooksResult.data || []) as Webhook[];
    const slackIntegration = slackResult.data as SlackIntegration | null;

    // Filter webhooks that subscribe to this event
    const matchingWebhooks = webhooks.filter((w) => w.events.includes(event as WebhookEventType));

    // Build the envelope
    const envelope = {
      event,
      timestamp: new Date().toISOString(),
      data: payload || {},
    };

    const deliveryResults: { webhookId: string; success: boolean }[] = [];

    // Dispatch to each matching webhook
    for (const webhook of matchingWebhooks) {
      const body = JSON.stringify(envelope);
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
        "X-Webhook-Event": event,
      };

      // Add HMAC signature if webhook has a secret
      if (webhook.secret) {
        const signature = createHmac("sha256", webhook.secret)
          .update(body)
          .digest("hex");
        headers["X-Webhook-Signature"] = signature;
      }

      let success = false;
      let statusCode: number | null = null;
      let responseBody: string | null = null;
      let errorMessage: string | null = null;
      let attempt = 1;

      // First attempt
      try {
        const res = await fetch(webhook.url, {
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

      // Retry once on failure
      if (!success) {
        attempt = 2;
        try {
          const res = await fetch(webhook.url, {
            method: "POST",
            headers,
            body,
            signal: AbortSignal.timeout(10000),
          });
          statusCode = res.status;
          responseBody = await res.text().catch(() => null);
          success = res.ok;
          if (success) errorMessage = null;
        } catch (err: any) {
          errorMessage = err.message || "Retry failed";
        }
      }

      // Log delivery to webhook_deliveries
      await adminClient.from("webhook_deliveries").insert({
        webhook_id: webhook.id,
        team_id: teamId,
        event_type: event,
        payload: envelope,
        status_code: statusCode,
        response_body: responseBody?.substring(0, 2000) || null,
        success,
        attempt,
        error_message: errorMessage,
      });

      deliveryResults.push({ webhookId: webhook.id, success });
    }

    // Dispatch to Slack integration if it subscribes to this event
    if (slackIntegration && slackIntegration.events.includes(event as WebhookEventType)) {
      try {
        const slackMessage = formatSlackMessage(event as WebhookEventType, payload || {});
        await fetch(slackIntegration.webhook_url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(slackMessage),
          signal: AbortSignal.timeout(10000),
        });
      } catch (err: any) {
        console.error("[webhooks/dispatch] Slack delivery error:", err.message);
      }
    }

    return NextResponse.json({
      success: true,
      webhooks_dispatched: deliveryResults.length,
      slack_dispatched: slackIntegration?.events.includes(event as WebhookEventType) || false,
      deliveries: deliveryResults,
    });
  } catch (err: any) {
    console.error("[webhooks/dispatch] Error:", err);
    return NextResponse.json({ error: err.message || "Internal error" }, { status: 500 });
  }
}
