import { updateProjectStage, updateProject } from "./data";
import type { AutomationSettings, ProjectStage, Project, StageDependency, WebhookEventType } from "./types";

/** Fire-and-forget webhook dispatch for an event */
export function dispatchWebhookEvent(
  event: WebhookEventType,
  teamId: string,
  payload: Record<string, unknown>
): void {
  fetch("/api/webhooks/dispatch", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ event, teamId, payload }),
  }).catch(() => {});
}

/** Default settings when no row exists yet (preserves existing behavior) */
export const AUTOMATION_DEFAULTS: Omit<AutomationSettings, "id" | "team_id" | "created_at" | "updated_at"> = {
  auto_start_next_stage: false,
  auto_complete_project: true,
  notify_client_stage_complete: false,
  notify_worker_on_assign: false,
  auto_advance_blocked_stages: false,
};

interface StageAutomationContext {
  settings: Omit<AutomationSettings, "id" | "team_id" | "created_at" | "updated_at"> | null;
  project: Project;
  stages: ProjectStage[];
  dependencies: StageDependency[];
  userId: string;
}

interface StageAutomationResult {
  updatedStages: ProjectStage[];
  projectCompleted: boolean;
}

/**
 * Run automations after a stage status change.
 * Called after the initial DB update for the changed stage.
 * Returns updated stages array and whether the project was completed.
 */
export async function runStageAutomations(
  changedStageId: string,
  newStatus: ProjectStage["status"],
  ctx: StageAutomationContext
): Promise<StageAutomationResult> {
  const s = ctx.settings ?? AUTOMATION_DEFAULTS;
  let updatedStages = [...ctx.stages];
  let projectCompleted = false;

  if (newStatus !== "completed") {
    return { updatedStages, projectCompleted };
  }

  const now = new Date().toISOString();

  // Dispatch webhook for stage completion
  const completedStageName = updatedStages.find((st) => st.id === changedStageId)?.name;
  dispatchWebhookEvent("stage_completed", ctx.project.team_id, {
    project_id: ctx.project.id,
    project_name: ctx.project.name,
    stage_id: changedStageId,
    stage_name: completedStageName || "",
    completed_at: now,
  });

  // 1. Auto-start next stage by position
  if (s.auto_start_next_stage) {
    const completedStage = updatedStages.find((st) => st.id === changedStageId);
    if (completedStage) {
      const nextStage = updatedStages
        .filter((st) => st.status === "pending" && st.position > completedStage.position)
        .sort((a, b) => a.position - b.position)[0];
      if (nextStage) {
        const updates: Partial<ProjectStage> = {
          status: "in_progress",
          started_at: now,
          started_by: ctx.userId,
        };
        await updateProjectStage(nextStage.id, updates);
        updatedStages = updatedStages.map((st) =>
          st.id === nextStage.id ? { ...st, ...updates } : st
        );
        dispatchWebhookEvent("stage_started", ctx.project.team_id, {
          project_id: ctx.project.id,
          project_name: ctx.project.name,
          stage_id: nextStage.id,
          stage_name: nextStage.name,
          started_at: now,
        });
      }
    }
  }

  // 2. Auto-advance dependent (blocked) stages
  if (s.auto_advance_blocked_stages) {
    // Find stages that depend on the completed stage
    const targetStageIds = ctx.dependencies
      .filter((d) => d.source_stage_id === changedStageId)
      .map((d) => d.target_stage_id);

    for (const targetId of targetStageIds) {
      const targetStage = updatedStages.find((st) => st.id === targetId);
      if (!targetStage || targetStage.status !== "pending") continue;

      // Check if ALL dependencies for this target are completed
      const allDepsForTarget = ctx.dependencies
        .filter((d) => d.target_stage_id === targetId)
        .map((d) => d.source_stage_id);
      const allDepsCompleted = allDepsForTarget.every((srcId) => {
        const src = updatedStages.find((st) => st.id === srcId);
        return src?.status === "completed";
      });

      if (allDepsCompleted) {
        const updates: Partial<ProjectStage> = {
          status: "in_progress",
          started_at: now,
          started_by: ctx.userId,
        };
        await updateProjectStage(targetId, updates);
        updatedStages = updatedStages.map((st) =>
          st.id === targetId ? { ...st, ...updates } : st
        );
        dispatchWebhookEvent("stage_started", ctx.project.team_id, {
          project_id: ctx.project.id,
          project_name: ctx.project.name,
          stage_id: targetId,
          stage_name: targetStage.name,
          started_at: now,
        });
      }
    }
  }

  // 3. Auto-complete project
  if (s.auto_complete_project) {
    const allDone = updatedStages.every((st) => st.status === "completed");
    if (allDone && ctx.project.status !== "completed") {
      await updateProject(ctx.project.id, { status: "completed" });
      projectCompleted = true;
      dispatchWebhookEvent("project_completed", ctx.project.team_id, {
        project_id: ctx.project.id,
        project_name: ctx.project.name,
        completed_at: now,
      });
    }
  }

  // 4. Notify clients on stage completion (fire-and-forget, clients control opt-out)
  {
    const completedStage = updatedStages.find((st) => st.id === changedStageId);
    if (completedStage) {
      fetch("/api/notify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "stage_complete",
          projectId: ctx.project.id,
          projectName: ctx.project.name,
          stageName: completedStage.name,
        }),
      }).catch(() => {});
    }
  }

  return { updatedStages, projectCompleted };
}

/**
 * Run automations after a worker is assigned to a stage.
 * Fire-and-forget email notification.
 */
export function runAssignmentAutomations(
  stageId: string,
  workerId: string,
  settings: Omit<AutomationSettings, "id" | "team_id" | "created_at" | "updated_at"> | null,
  context: { projectId: string; projectName: string; stageName: string }
): void {
  const s = settings ?? AUTOMATION_DEFAULTS;
  if (!s.notify_worker_on_assign) return;

  fetch("/api/notify", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      type: "worker_assigned",
      projectId: context.projectId,
      projectName: context.projectName,
      stageName: context.stageName,
      workerId,
    }),
  }).catch(() => {});
}
