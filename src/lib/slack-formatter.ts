import type { WebhookEventType } from "@/lib/types";

export function formatSlackMessage(event: WebhookEventType, payload: Record<string, unknown>): object {
  const timestamp = new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

  switch (event) {
    case "stage_completed":
      return {
        blocks: [
          { type: "header", text: { type: "plain_text", text: "\u2705 Stage Completed", emoji: true } },
          { type: "section", fields: [
            { type: "mrkdwn", text: `*Project:*\n${payload.project_name}` },
            { type: "mrkdwn", text: `*Stage:*\n${payload.stage_name}` },
          ]},
          { type: "context", elements: [{ type: "mrkdwn", text: `via Workflowz \u2022 ${timestamp}` }] },
        ],
      };
    case "stage_started":
      return {
        blocks: [
          { type: "header", text: { type: "plain_text", text: "\u25b6\ufe0f Stage Started", emoji: true } },
          { type: "section", fields: [
            { type: "mrkdwn", text: `*Project:*\n${payload.project_name}` },
            { type: "mrkdwn", text: `*Stage:*\n${payload.stage_name}` },
          ]},
          { type: "context", elements: [{ type: "mrkdwn", text: `via Workflowz \u2022 ${timestamp}` }] },
        ],
      };
    case "project_created":
      return {
        blocks: [
          { type: "header", text: { type: "plain_text", text: "\ud83d\udcc1 New Project Created", emoji: true } },
          { type: "section", text: { type: "mrkdwn", text: `*${payload.project_name}*\nCreated by ${payload.created_by_name || "a team member"}` } },
          { type: "context", elements: [{ type: "mrkdwn", text: `via Workflowz \u2022 ${timestamp}` }] },
        ],
      };
    case "project_completed":
      return {
        blocks: [
          { type: "header", text: { type: "plain_text", text: "\ud83c\udf89 Project Completed", emoji: true } },
          { type: "section", text: { type: "mrkdwn", text: `*${payload.project_name}* has been completed!` } },
          { type: "context", elements: [{ type: "mrkdwn", text: `via Workflowz \u2022 ${timestamp}` }] },
        ],
      };
    case "client_added":
      return {
        blocks: [
          { type: "header", text: { type: "plain_text", text: "\ud83d\udc64 Client Added to Project", emoji: true } },
          { type: "section", fields: [
            { type: "mrkdwn", text: `*Project:*\n${payload.project_name}` },
            { type: "mrkdwn", text: `*Client:*\n${payload.client_name || payload.client_email}` },
          ]},
          { type: "context", elements: [{ type: "mrkdwn", text: `via Workflowz \u2022 ${timestamp}` }] },
        ],
      };
    case "member_invited":
      return {
        blocks: [
          { type: "header", text: { type: "plain_text", text: "\ud83d\udce8 Team Member Invited", emoji: true } },
          { type: "section", fields: [
            { type: "mrkdwn", text: `*Name:*\n${payload.member_name || "\u2014"}` },
            { type: "mrkdwn", text: `*Role:*\n${payload.member_role}` },
          ]},
          { type: "context", elements: [{ type: "mrkdwn", text: `via Workflowz \u2022 ${timestamp}` }] },
        ],
      };
    default:
      return {
        blocks: [
          { type: "section", text: { type: "mrkdwn", text: `*Event:* ${event}` } },
          { type: "context", elements: [{ type: "mrkdwn", text: `via Workflowz \u2022 ${timestamp}` }] },
        ],
      };
  }
}
