import type { Project, ProjectStage } from "./types";

export type ClientNotifyEvent =
  | "stage_started"
  | "stage_completed"
  | "approval_requested"
  | "photo_added"
  | "project_completed";

/**
 * Fire-and-forget proactive client notification. Posts to /api/notify,
 * which resolves recipients (assigned clients minus opt-outs), renders the
 * branded email, and sends via Resend. Safe to call with a null event
 * (no-op) so callers can pass a derived value directly.
 */
export function notifyClientStageEvent(
  project: Project,
  stage: ProjectStage | null,
  event: ClientNotifyEvent | null,
  extra?: { eta?: string | null }
): void {
  if (!event) return;
  fetch("/api/notify", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      type: "client_event",
      event,
      projectId: project.id,
      projectName: project.name,
      stageName: stage?.name || "",
      teamId: project.team_id,
      eta: extra?.eta || null,
    }),
  }).catch(() => {});
}

/** Same channel, project-level events (no stage). */
export function notifyClientProjectEvent(
  project: Project,
  event: ClientNotifyEvent,
  extra?: { eta?: string | null }
): void {
  notifyClientStageEvent(project, null, event, extra);
}
