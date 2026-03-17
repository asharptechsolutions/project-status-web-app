import { logActivity } from "./data";
import type { ActivityAction, ActivityEntityType } from "./types";

interface TrackParams {
  teamId: string;
  actorId: string;
  actorName: string;
  action: ActivityAction;
  entityType: ActivityEntityType;
  entityId?: string | null;
  entityName?: string;
  projectId?: string | null;
  metadata?: Record<string, unknown>;
}

export function trackActivity(params: TrackParams): void {
  logActivity({
    team_id: params.teamId,
    actor_id: params.actorId,
    actor_name: params.actorName,
    action: params.action,
    entity_type: params.entityType,
    entity_id: params.entityId ?? null,
    entity_name: params.entityName ?? "",
    project_id: params.projectId ?? null,
    metadata: params.metadata ?? {},
  }).catch(() => {}); // truly fire-and-forget
}
